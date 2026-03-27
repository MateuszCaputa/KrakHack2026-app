"""BPMN 2.0 XML generator from PipelineOutput process map."""

import re
import xml.etree.ElementTree as ET
from xml.dom import minidom

from backend.models import PipelineOutput, ProcessMap

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
DI_NS = "http://www.omg.org/spec/DD/20100524/DI"

TASK_WIDTH = 120
TASK_HEIGHT = 60
TASK_GAP = 40
START_X = 80
START_Y = 200
ROW_HEIGHT = 130


def generate_bpmn(pipeline_output: PipelineOutput) -> str:
    """Generate valid BPMN 2.0 XML from the discovered process."""
    sequence = _extract_main_sequence(pipeline_output)
    return _build_bpmn_xml(sequence, pipeline_output.process_id)


def _extract_main_sequence(pipeline_output: PipelineOutput) -> list[str]:
    """Extract the main activity sequence for BPMN generation."""
    if pipeline_output.variants:
        raw_sequence = pipeline_output.variants[0].sequence
    elif pipeline_output.activities:
        raw_sequence = [a.name for a in pipeline_output.activities[:15]]
    else:
        return ["Start Process", "Process Step", "Complete"]

    # Deduplicate while preserving order (cycles become single nodes)
    seen: set[str] = set()
    sequence = []
    for step in raw_sequence:
        if step not in seen:
            seen.add(step)
            sequence.append(step)

    return sequence[:15]  # cap at 15 tasks for readability


def _sanitize_id(name: str, prefix: str = "task") -> str:
    """Convert any string to a valid XML ID."""
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    return f"{prefix}_{sanitized}"[:64]


def _build_bpmn_xml(sequence: list[str], process_id: str) -> str:
    """Build BPMN 2.0 XML string from an activity sequence."""
    ET.register_namespace("bpmn", BPMN_NS)
    ET.register_namespace("bpmndi", BPMNDI_NS)
    ET.register_namespace("dc", DC_NS)
    ET.register_namespace("di", DI_NS)

    definitions = ET.Element(f"{{{BPMN_NS}}}definitions")
    definitions.set("id", f"definitions_{process_id}")
    definitions.set("targetNamespace", "http://bpmn.io/schema/bpmn")
    definitions.set(f"xmlns:bpmn", BPMN_NS)
    definitions.set(f"xmlns:bpmndi", BPMNDI_NS)
    definitions.set(f"xmlns:dc", DC_NS)
    definitions.set(f"xmlns:di", DI_NS)

    process_elem = ET.SubElement(definitions, f"{{{BPMN_NS}}}process")
    process_elem.set("id", f"process_{process_id}")
    process_elem.set("isExecutable", "false")

    # Start event
    start_id = "start_event_1"
    start_elem = ET.SubElement(process_elem, f"{{{BPMN_NS}}}startEvent")
    start_elem.set("id", start_id)
    start_elem.set("name", "Start")

    # Tasks
    task_ids = []
    for step_name in sequence:
        task_id = _sanitize_id(step_name)
        task_elem = ET.SubElement(process_elem, f"{{{BPMN_NS}}}userTask")
        task_elem.set("id", task_id)
        task_elem.set("name", step_name[:50])  # truncate long names
        task_ids.append(task_id)

    # End event
    end_id = "end_event_1"
    end_elem = ET.SubElement(process_elem, f"{{{BPMN_NS}}}endEvent")
    end_elem.set("id", end_id)
    end_elem.set("name", "End")

    # Sequence flows
    all_ids = [start_id] + task_ids + [end_id]
    for i in range(len(all_ids) - 1):
        flow_elem = ET.SubElement(process_elem, f"{{{BPMN_NS}}}sequenceFlow")
        flow_elem.set("id", f"flow_{i + 1}")
        flow_elem.set("sourceRef", all_ids[i])
        flow_elem.set("targetRef", all_ids[i + 1])

    # BPMN DI (diagram interchange for rendering)
    diagram = ET.SubElement(definitions, f"{{{BPMNDI_NS}}}BPMNDiagram")
    diagram.set("id", "diagram_1")
    plane = ET.SubElement(diagram, f"{{{BPMNDI_NS}}}BPMNPlane")
    plane.set("id", "plane_1")
    plane.set("bpmnElement", f"process_{process_id}")

    # Layout: start event
    _add_shape(plane, start_id, START_X, START_Y + 15, 36, 36, is_event=True)

    # Layout tasks in rows of 4
    tasks_per_row = 4
    for i, task_id in enumerate(task_ids):
        row = i // tasks_per_row
        col = i % tasks_per_row
        x = START_X + 80 + col * (TASK_WIDTH + TASK_GAP)
        y = START_Y - TASK_HEIGHT // 2 + row * ROW_HEIGHT
        _add_shape(plane, task_id, x, y, TASK_WIDTH, TASK_HEIGHT)

    # End event
    last_row = (len(task_ids) - 1) // tasks_per_row if task_ids else 0
    last_col = ((len(task_ids) - 1) % tasks_per_row + 1) if task_ids else 0
    end_x = START_X + 80 + last_col * (TASK_WIDTH + TASK_GAP)
    if last_col == 0:
        end_x = START_X + 80
    end_y = START_Y + last_row * ROW_HEIGHT

    _add_shape(plane, end_id, end_x, end_y + 15, 36, 36, is_event=True)

    # Sequence flow edges (simplified — just waypoints)
    for i in range(len(all_ids) - 1):
        _add_edge(plane, f"flow_{i + 1}", all_ids[i], all_ids[i + 1])

    xml_str = ET.tostring(definitions, encoding="unicode")
    return _pretty_print(xml_str)


def _add_shape(
    plane: ET.Element,
    element_id: str,
    x: float,
    y: float,
    width: float,
    height: float,
    is_event: bool = False,
) -> None:
    shape = ET.SubElement(plane, f"{{{BPMNDI_NS}}}BPMNShape")
    shape.set("id", f"shape_{element_id}")
    shape.set("bpmnElement", element_id)
    if is_event:
        shape.set("bioc:stroke", "#000000")

    bounds = ET.SubElement(shape, f"{{{DC_NS}}}Bounds")
    bounds.set("x", str(x))
    bounds.set("y", str(y))
    bounds.set("width", str(width))
    bounds.set("height", str(height))


def _add_edge(plane: ET.Element, flow_id: str, source_id: str, target_id: str) -> None:
    edge = ET.SubElement(plane, f"{{{BPMNDI_NS}}}BPMNEdge")
    edge.set("id", f"edge_{flow_id}")
    edge.set("bpmnElement", flow_id)


def _pretty_print(xml_str: str) -> str:
    """Format XML string with indentation."""
    try:
        reparsed = minidom.parseString(xml_str.encode("utf-8"))
        return reparsed.toprettyxml(indent="  ", encoding=None)
    except Exception:
        return xml_str
