"""Main copilot entry point: orchestrates all copilot components."""

import os

from backend.models import CopilotOutput, PipelineOutput
from backend.copilot.analyzer import generate_summary
from backend.copilot.recommender import generate_recommendations
from backend.copilot.bpmn_generator import generate_bpmn
from backend.copilot.comparison import compare_with_reference


DEFAULT_REFERENCE_BPMN = os.path.join(
    "Process-to-Automation Copilot Challenge",
    "Dataset",
    "model (67).bpmn",
)


def run_copilot(
    pipeline_output: PipelineOutput,
    reference_bpmn_path: str | None = None,
) -> CopilotOutput:
    """Run full copilot analysis on a pipeline output. Returns CopilotOutput."""
    summary = generate_summary(pipeline_output)
    recommendations = generate_recommendations(pipeline_output)
    bpmn_xml = generate_bpmn(pipeline_output)

    reference_comparison = None
    bpmn_path = reference_bpmn_path or DEFAULT_REFERENCE_BPMN
    if os.path.exists(bpmn_path):
        reference_comparison = compare_with_reference(pipeline_output, bpmn_path)

    return CopilotOutput(
        process_id=pipeline_output.process_id,
        summary=summary,
        recommendations=recommendations,
        bpmn_xml=bpmn_xml,
        reference_bpmn_comparison=reference_comparison,
    )
