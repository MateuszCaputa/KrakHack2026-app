"""BPMN 2.0 XML generator with color-coded insights from process analysis."""

import re
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from xml.dom import minidom

from backend.models import PipelineOutput, Recommendation

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
DI_NS = "http://www.omg.org/spec/DD/20100524/DI"
BIOC_NS = "http://bpmn.io/schema/bpmn/biocolor/1.0"

TASK_WIDTH = 160
TASK_HEIGHT = 72
TASK_H_GAP = 60
TASK_V_GAP = 90
START_X = 60
START_Y = 80
EVENT_SIZE = 36
MAX_PER_ROW = 4
MAX_TASKS = 12

# Color palette: fill, stroke
COLOR_AUTOMATION = {"fill": "#dcfce7", "stroke": "#16a34a"}
COLOR_BOTTLENECK = {"fill": "#fff1f2", "stroke": "#e11d48"}
COLOR_COPY_PASTE = {"fill": "#eff6ff", "stroke": "#2563eb"}
COLOR_DEFAULT = {"fill": "#f8fafc", "stroke": "#64748b"}
COLOR_START = {"fill": "#dcfce7", "stroke": "#16a34a"}
COLOR_END = {"fill": "#fef2f2", "stroke": "#dc2626"}


def generate_bpmn(
    pipeline_output: PipelineOutput,
    recommendations: list[Recommendation] | None = None,
) -> str:
    """Generate BPMN 2.0 XML with color-coded automation and bottleneck insights."""
    sequence = _extract_sequence(pipeline_output)
    color_map = _build_color_map(pipeline_output, recommendations or [])
    task_type_map = _build_task_type_map(pipeline_output, recommendations or [])
    activity_metrics = _build_activity_metrics(pipeline_output)
    gateway_points = _find_gateway_points(pipeline_output, sequence)
    return _build_bpmn_xml(
        sequence, pipeline_output.process_id, color_map, task_type_map,
        activity_metrics, gateway_points,
    )


# --- Sequence extraction ---

def _extract_sequence(pipeline_output: PipelineOutput) -> list[str]:
    """Extract main activity sequence: process map topology → top variant → activities."""
    if pipeline_output.process_map and pipeline_output.process_map.edges:
        seq = _topological_sequence(pipeline_output)
        if len(seq) >= 3:
            return seq[:MAX_TASKS]

    if pipeline_output.variants:
        best = max(pipeline_output.variants, key=lambda v: v.case_count)
        seen: set[str] = set()
        clean = [s for s in best.sequence if s not in seen and not seen.add(s) and _is_clean_name(s)]  # type: ignore[func-returns-value]
        if len(clean) >= 3:
            return clean[:MAX_TASKS]

    if pipeline_output.activities:
        by_freq = sorted(pipeline_output.activities, key=lambda a: a.frequency, reverse=True)
        clean = [a.name for a in by_freq if _is_clean_name(a.name)]
        if len(clean) >= 3:
            return clean[:MAX_TASKS]

    return ["Start Process", "Process Step", "Complete"]


def _topological_sequence(pipeline_output: PipelineOutput) -> list[str]:
    """Walk the process map in topological order, following highest-weight edges."""
    pm = pipeline_output.process_map
    node_labels = {n.id: n.label for n in pm.nodes}

    outgoing: dict[str, list[tuple[str, int]]] = defaultdict(list)
    in_degree: dict[str, int] = defaultdict(int)
    for edge in pm.edges:
        outgoing[edge.source].append((edge.target, edge.weight))
        in_degree[edge.target] += 1

    roots = [nid for nid in node_labels if in_degree[nid] == 0]
    if not roots:
        roots = [max(node_labels, key=lambda n: len(outgoing[n]))]

    queue: deque[str] = deque(roots)
    visited: set[str] = set()
    result: list[str] = []

    while queue:
        nid = queue.popleft()
        if nid in visited:
            continue
        visited.add(nid)
        label = node_labels.get(nid, nid)
        if _is_clean_name(label):
            result.append(label)
        for child_id, _ in sorted(outgoing[nid], key=lambda x: x[1], reverse=True):
            if child_id not in visited:
                queue.append(child_id)

    return result


# --- Color and type mapping ---

def _build_color_map(
    pipeline_output: PipelineOutput,
    recommendations: list[Recommendation],
) -> dict[str, dict[str, str]]:
    """Assign colors to activities based on analysis insights."""
    automation_targets = {
        rec.target.lower()
        for rec in recommendations
        if rec.type == "automate" or rec.automation_type
    }
    bottleneck_activities: set[str] = set()
    for b in pipeline_output.bottlenecks:
        if b.severity in ("critical", "high"):
            bottleneck_activities.add(b.from_activity.lower())
            bottleneck_activities.add(b.to_activity.lower())

    copy_paste_activities = {
        act.name.lower()
        for act in pipeline_output.activities
        if act.copy_paste_count and act.copy_paste_count > 2
    }

    color_map: dict[str, dict[str, str]] = {}
    for act in pipeline_output.activities:
        name_lower = act.name.lower()
        if name_lower in automation_targets:
            color_map[act.name] = COLOR_AUTOMATION
        elif name_lower in bottleneck_activities:
            color_map[act.name] = COLOR_BOTTLENECK
        elif name_lower in copy_paste_activities:
            color_map[act.name] = COLOR_COPY_PASTE
        else:
            color_map[act.name] = COLOR_DEFAULT
    return color_map


def _build_task_type_map(
    pipeline_output: PipelineOutput,
    recommendations: list[Recommendation],
) -> dict[str, str]:
    """Map activity names to BPMN task element types."""
    automation_targets = {
        rec.target.lower()
        for rec in recommendations
        if rec.type == "automate" or rec.automation_type
    }
    task_types: dict[str, str] = {}
    for act in pipeline_output.activities:
        if act.name.lower() in automation_targets:
            task_types[act.name] = "serviceTask"
        elif act.copy_paste_count and act.copy_paste_count > 2:
            task_types[act.name] = "manualTask"
        else:
            task_types[act.name] = "userTask"
    return task_types


def _build_activity_metrics(pipeline_output: PipelineOutput) -> dict[str, str]:
    """Build per-activity metric annotations for BPMN task labels."""
    metrics: dict[str, str] = {}
    for act in pipeline_output.activities:
        parts = []
        if act.avg_duration_seconds > 0:
            dur = act.avg_duration_seconds
            if dur < 60:
                parts.append(f"{dur:.0f}s avg")
            elif dur < 3600:
                parts.append(f"{dur / 60:.0f}m avg")
            else:
                parts.append(f"{dur / 3600:.1f}h avg")
        parts.append(f"×{act.frequency}")
        if act.copy_paste_count > 0:
            parts.append(f"📋{act.copy_paste_count}")
        metrics[act.name] = " · ".join(parts)
    return metrics


def _find_gateway_points(
    pipeline_output: PipelineOutput, sequence: list[str],
) -> list[tuple[int, list[str]]]:
    """Find points in the sequence where top variants diverge.

    Returns list of (index_after_which_to_insert_gateway, [branch_target_names]).
    """
    if len(pipeline_output.variants) < 2 or len(sequence) < 3:
        return []

    sorted_variants = sorted(pipeline_output.variants, key=lambda v: v.case_count, reverse=True)[:3]
    top_seq = sorted_variants[0].sequence

    gateways: list[tuple[int, list[str]]] = []
    seq_set = set(sequence)

    for i, step in enumerate(sequence[:-1]):
        if step not in top_seq:
            continue
        idx_in_top = -1
        for j, s in enumerate(top_seq):
            if s == step:
                idx_in_top = j
                break
        if idx_in_top < 0 or idx_in_top >= len(top_seq) - 1:
            continue

        next_in_top = top_seq[idx_in_top + 1]
        branches: set[str] = set()
        for var in sorted_variants[1:]:
            if step not in var.sequence:
                continue
            var_idx = var.sequence.index(step)
            if var_idx < len(var.sequence) - 1:
                alt = var.sequence[var_idx + 1]
                if alt != next_in_top and alt in seq_set:
                    branches.add(alt)

        if branches:
            gateways.append((i, list(branches)[:2]))
            break  # one gateway is enough for demo

    return gateways


# --- BPMN XML construction ---

def _build_bpmn_xml(
    sequence: list[str],
    process_id: str,
    color_map: dict[str, dict[str, str]],
    task_type_map: dict[str, str],
    activity_metrics: dict[str, str] | None = None,
    gateway_points: list[tuple[int, list[str]]] | None = None,
) -> str:
    """Build complete BPMN 2.0 XML with DI layout and bioc color annotations."""
    ET.register_namespace("bpmn", BPMN_NS)
    ET.register_namespace("bpmndi", BPMNDI_NS)
    ET.register_namespace("dc", DC_NS)
    ET.register_namespace("di", DI_NS)
    ET.register_namespace("bioc", BIOC_NS)

    definitions = ET.Element(f"{{{BPMN_NS}}}definitions")
    definitions.set("id", f"def_{process_id}")
    definitions.set("targetNamespace", "http://bpmn.io/schema/bpmn")
    definitions.set("xmlns:bioc", BIOC_NS)

    process_elem = ET.SubElement(definitions, f"{{{BPMN_NS}}}process")
    process_elem.set("id", f"proc_{process_id}")
    process_elem.set("isExecutable", "true")

    activity_metrics = activity_metrics or {}
    gateway_points = gateway_points or []

    start_id = "ev_start"
    start_el = ET.SubElement(process_elem, f"{{{BPMN_NS}}}startEvent")
    start_el.set("id", start_id)
    start_el.set("name", "Start")

    task_ids: list[tuple[str, str]] = []
    for name in sequence:
        tid = _sanitize_id(name)
        ttype = task_type_map.get(name, "userTask")
        task_el = ET.SubElement(process_elem, f"{{{BPMN_NS}}}{ttype}")
        task_el.set("id", tid)
        label = name[:45]
        metric = activity_metrics.get(name)
        if metric:
            label = f"{label}\n[{metric}]"
        task_el.set("name", label)
        task_ids.append((tid, name))

    # Add XOR gateways
    gateway_ids: dict[int, str] = {}
    for seq_idx, branches in gateway_points:
        gw_id = f"gw_xor_{seq_idx}"
        gw_el = ET.SubElement(process_elem, f"{{{BPMN_NS}}}exclusiveGateway")
        gw_el.set("id", gw_id)
        gw_el.set("name", "")
        gateway_ids[seq_idx] = gw_id

    end_id = "ev_end"
    end_el = ET.SubElement(process_elem, f"{{{BPMN_NS}}}endEvent")
    end_el.set("id", end_id)
    end_el.set("name", "End")

    # Build flow — insert gateways where divergence is found
    all_ids = [start_id] + [tid for tid, _ in task_ids] + [end_id]

    # Insert gateway IDs after their respective task indices
    gw_insert_offsets: dict[int, str] = {}
    for seq_idx, gw_id in gateway_ids.items():
        # gateway goes after task at seq_idx (offset by 1 for start event)
        insert_pos = seq_idx + 2  # +1 for start, +1 for after
        gw_insert_offsets[insert_pos] = gw_id

    expanded_ids: list[str] = []
    for i, eid in enumerate(all_ids):
        expanded_ids.append(eid)
        if i in gw_insert_offsets:
            expanded_ids.append(gw_insert_offsets[i])

    flow_idx = 0
    for i in range(len(expanded_ids) - 1):
        flow_idx += 1
        sf = ET.SubElement(process_elem, f"{{{BPMN_NS}}}sequenceFlow")
        sf.set("id", f"sf_{flow_idx}")
        sf.set("sourceRef", expanded_ids[i])
        sf.set("targetRef", expanded_ids[i + 1])

    # DI
    diagram = ET.SubElement(definitions, f"{{{BPMNDI_NS}}}BPMNDiagram")
    diagram.set("id", "diag_1")
    plane = ET.SubElement(diagram, f"{{{BPMNDI_NS}}}BPMNPlane")
    plane.set("id", "plane_1")
    plane.set("bpmnElement", f"proc_{process_id}")

    positions = _compute_positions(task_ids, start_id, end_id)

    # Add gateway positions (between task and next task)
    gw_size = 42
    for seq_idx, gw_id in gateway_ids.items():
        task_id = task_ids[seq_idx][0]
        tx, ty = positions[task_id]
        # Place gateway to the right of the task, centered vertically
        positions[gw_id] = (tx + TASK_WIDTH + TASK_H_GAP // 2 - gw_size // 2, ty + (TASK_HEIGHT - gw_size) // 2)

    # Shapes
    sx, sy = positions[start_id]
    _add_shape(plane, start_id, sx, sy, EVENT_SIZE, EVENT_SIZE, colors=COLOR_START)

    for tid, name in task_ids:
        tx, ty = positions[tid]
        _add_shape(plane, tid, tx, ty, TASK_WIDTH, TASK_HEIGHT, colors=color_map.get(name, COLOR_DEFAULT))

    for gw_id in gateway_ids.values():
        gx, gy = positions[gw_id]
        _add_shape(plane, gw_id, gx, gy, gw_size, gw_size)

    ex, ey = positions[end_id]
    _add_shape(plane, end_id, ex, ey, EVENT_SIZE, EVENT_SIZE, colors=COLOR_END)

    # Edges
    all_positioned = expanded_ids
    flow_idx_di = 0
    for i in range(len(all_positioned) - 1):
        flow_idx_di += 1
        src, tgt = all_positioned[i], all_positioned[i + 1]
        sw = _element_size(src, start_id, end_id, gateway_ids)[0]
        sh = _element_size(src, start_id, end_id, gateway_ids)[1]
        tw = _element_size(tgt, start_id, end_id, gateway_ids)[0]
        th = _element_size(tgt, start_id, end_id, gateway_ids)[1]
        _add_edge(plane, f"sf_{flow_idx_di}", src, tgt, positions[src], sw, sh, positions[tgt], tw, th)

    return _pretty_print(ET.tostring(definitions, encoding="unicode"))


# --- Layout ---

def _grid_xy(index: int) -> tuple[float, float]:
    """Return top-left (x, y) for task at grid index."""
    row = index // MAX_PER_ROW
    col = index % MAX_PER_ROW
    x = START_X + EVENT_SIZE + TASK_H_GAP + col * (TASK_WIDTH + TASK_H_GAP)
    y = START_Y + row * (TASK_HEIGHT + TASK_V_GAP)
    return (x, y)


def _compute_positions(
    task_ids: list[tuple[str, str]],
    start_id: str,
    end_id: str,
) -> dict[str, tuple[float, float]]:
    positions: dict[str, tuple[float, float]] = {}

    first_x, first_y = _grid_xy(0)
    positions[start_id] = (
        first_x - TASK_H_GAP - EVENT_SIZE,
        first_y + (TASK_HEIGHT - EVENT_SIZE) / 2,
    )

    for i, (tid, _) in enumerate(task_ids):
        positions[tid] = _grid_xy(i)

    n = len(task_ids)
    ex, ey = _grid_xy(n)
    positions[end_id] = (ex, ey + (TASK_HEIGHT - EVENT_SIZE) / 2)

    return positions


def _element_size(
    eid: str, start_id: str, end_id: str, gateway_ids: dict[int, str],
) -> tuple[float, float]:
    """Return (width, height) for any element type."""
    if eid == start_id or eid == end_id:
        return (EVENT_SIZE, EVENT_SIZE)
    if eid in gateway_ids.values():
        return (42, 42)
    return (TASK_WIDTH, TASK_HEIGHT)


# --- Shapes and edges ---

def _add_shape(
    plane: ET.Element,
    eid: str,
    x: float,
    y: float,
    w: float,
    h: float,
    colors: dict[str, str] | None = None,
) -> None:
    shape = ET.SubElement(plane, f"{{{BPMNDI_NS}}}BPMNShape")
    shape.set("id", f"s_{eid}")
    shape.set("bpmnElement", eid)
    if colors:
        shape.set("bioc:fill", colors["fill"])
        shape.set("bioc:stroke", colors["stroke"])
    bounds = ET.SubElement(shape, f"{{{DC_NS}}}Bounds")
    bounds.set("x", str(round(x)))
    bounds.set("y", str(round(y)))
    bounds.set("width", str(round(w)))
    bounds.set("height", str(round(h)))


def _add_edge(
    plane: ET.Element,
    flow_id: str,
    src_id: str,
    tgt_id: str,
    src_pos: tuple[float, float],
    src_w: float,
    src_h: float,
    tgt_pos: tuple[float, float],
    tgt_w: float,
    tgt_h: float,
) -> None:
    edge = ET.SubElement(plane, f"{{{BPMNDI_NS}}}BPMNEdge")
    edge.set("id", f"e_{flow_id}")
    edge.set("bpmnElement", flow_id)

    waypoints = _compute_waypoints(src_pos, src_w, src_h, tgt_pos, tgt_w, tgt_h)
    for wx, wy in waypoints:
        wp = ET.SubElement(edge, f"{{{DI_NS}}}waypoint")
        wp.set("x", str(round(wx)))
        wp.set("y", str(round(wy)))


def _compute_waypoints(
    src_pos: tuple[float, float],
    src_w: float,
    src_h: float,
    tgt_pos: tuple[float, float],
    tgt_w: float,
    tgt_h: float,
) -> list[tuple[float, float]]:
    """Compute clean waypoints: straight for same row, elbow for row wrap."""
    src_right = src_pos[0] + src_w
    src_cy = src_pos[1] + src_h / 2
    tgt_left = tgt_pos[0]
    tgt_cy = tgt_pos[1] + tgt_h / 2

    # Same horizontal level → straight line
    if abs(src_cy - tgt_cy) < 5 and tgt_left >= src_right - 2:
        return [(src_right, src_cy), (tgt_left, tgt_cy)]

    # Target is lower (row wrap or end event below) → bottom-exit elbow
    if tgt_cy > src_cy:
        src_cx = src_pos[0] + src_w / 2
        tgt_cx = tgt_pos[0] + tgt_w / 2
        src_bottom = src_pos[1] + src_h
        tgt_top = tgt_pos[1]
        mid_y = src_bottom + (tgt_top - src_bottom) / 2
        return [
            (src_cx, src_bottom),
            (src_cx, mid_y),
            (tgt_cx, mid_y),
            (tgt_cx, tgt_top),
        ]

    # Fallback: right-to-left direct
    return [(src_right, src_cy), (tgt_left, tgt_cy)]


# --- Helpers ---

def _is_clean_name(name: str) -> bool:
    if len(name) > 45:
        return False
    if "://" in name or "http" in name.lower():
        return False
    if "?" in name and "=" in name:
        return False
    if name.count("/") > 1:
        return False
    if any(c in name for c in ["&", "=", "#"]):
        return False
    if re.match(r"^[0-9a-f]{8,}$", name.lower()):
        return False
    return True


def _sanitize_id(name: str, prefix: str = "task") -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    s = re.sub(r"_+", "_", s).strip("_")
    return f"{prefix}_{s}"[:64]


def _pretty_print(xml_str: str) -> str:
    try:
        return minidom.parseString(xml_str.encode("utf-8")).toprettyxml(indent="  ", encoding=None)
    except Exception:
        return xml_str
