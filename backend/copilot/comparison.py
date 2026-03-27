"""Reference BPMN comparison: compare discovered process against provided reference model."""

import os
import xml.etree.ElementTree as ET

from backend.models import PipelineOutput

BPMN_NAMESPACES = {
    "bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL",
    "bpmn2": "http://www.omg.org/spec/BPMN/20100524/MODEL",
}


def compare_with_reference(
    pipeline_output: PipelineOutput,
    reference_bpmn_path: str,
) -> str:
    """Compare discovered process against reference BPMN. Returns analysis text."""
    if not os.path.exists(reference_bpmn_path):
        return f"Reference BPMN not found at: {reference_bpmn_path}"

    reference_tasks = _parse_bpmn_tasks(reference_bpmn_path)
    discovered_activities = {a.name for a in pipeline_output.activities}

    if not reference_tasks:
        return "Could not extract tasks from reference BPMN model."

    in_reference_not_discovered = reference_tasks - discovered_activities
    discovered_not_in_reference = discovered_activities - reference_tasks
    common = reference_tasks & discovered_activities

    lines = [
        f"Reference BPMN Comparison:",
        f"  Reference model tasks: {len(reference_tasks)}",
        f"  Discovered activities: {len(discovered_activities)}",
        f"  Matching steps: {len(common)}",
        "",
    ]

    if common:
        lines.append(f"Common steps ({len(common)}): {', '.join(sorted(common)[:10])}")

    if in_reference_not_discovered:
        lines.append(
            f"\nIn reference but NOT discovered ({len(in_reference_not_discovered)}): "
            f"{', '.join(sorted(in_reference_not_discovered)[:10])}"
        )
        lines.append(
            "  → These steps may be rarely executed or outside the recorded time window."
        )

    if discovered_not_in_reference:
        lines.append(
            f"\nDiscovered but NOT in reference ({len(discovered_not_in_reference)}): "
            f"{', '.join(sorted(discovered_not_in_reference)[:10])}"
        )
        lines.append(
            "  → These are informal/shadow steps not captured in the formal process model — "
            "candidates for process standardization."
        )

    coverage = (len(common) / len(reference_tasks) * 100) if reference_tasks else 0
    lines.append(f"\nProcess coverage: {coverage:.1f}% of reference steps discovered in data.")

    return "\n".join(lines)


def _parse_bpmn_tasks(bpmn_path: str) -> set[str]:
    """Extract task/activity names from a BPMN XML file."""
    try:
        tree = ET.parse(bpmn_path)
        root = tree.getroot()
    except ET.ParseError:
        return set()

    tasks: set[str] = set()
    task_tags = {"task", "userTask", "serviceTask", "manualTask", "scriptTask", "sendTask", "receiveTask"}

    for elem in root.iter():
        local_tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        if local_tag in task_tags:
            name = elem.get("name", "").strip()
            if name:
                tasks.add(name)

    return tasks
