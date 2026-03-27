"""Process analyzer: generate natural language summary from PipelineOutput."""

from backend.models import PipelineOutput
from backend.copilot.llm import call_llm


def generate_summary(pipeline_output: PipelineOutput) -> str:
    """Generate a natural language summary of the discovered process."""
    stats = pipeline_output.statistics
    activities = pipeline_output.activities[:5]
    bottlenecks = pipeline_output.bottlenecks[:3]
    main_variant = pipeline_output.variants[0] if pipeline_output.variants else None

    structured = _build_structured_summary(pipeline_output)

    llm_response = call_llm(
        prompt=f"""Analyze this business process and write a concise 3-4 sentence executive summary.
Focus on: what the process does, key inefficiencies, and automation potential.

{structured}""",
        system="You are a process automation consultant. Write clear, actionable business insights.",
        max_tokens=512,
    )

    if llm_response:
        return llm_response

    return _template_summary(pipeline_output)


def _build_structured_summary(pipeline_output: PipelineOutput) -> str:
    """Build structured text description of the process for LLM or template use."""
    stats = pipeline_output.statistics
    activities = pipeline_output.activities
    bottlenecks = pipeline_output.bottlenecks

    top_activities = ", ".join(a.name for a in activities[:5])

    bottleneck_text = ""
    if bottlenecks:
        critical = [b for b in bottlenecks if b.severity in ("critical", "high")]
        if critical:
            b = critical[0]
            bottleneck_text = f"Critical bottleneck: {b.from_activity} → {b.to_activity} (avg {b.avg_wait_seconds:.0f}s wait)"

    main_variant = pipeline_output.variants[0] if pipeline_output.variants else None
    variant_text = ""
    if main_variant:
        variant_text = f"Most common path ({main_variant.percentage:.1f}% of cases): {' → '.join(main_variant.sequence[:5])}"

    return f"""Process Analysis:
- Total cases analyzed: {stats.total_cases}
- Total events: {stats.total_events}
- Unique activities: {stats.total_activities}
- Process variants discovered: {stats.total_variants}
- Date range: {stats.start_date} to {stats.end_date}
- Top activities: {top_activities}
- {bottleneck_text}
- {variant_text}
- Average case duration: {(stats.avg_case_duration_seconds or 0) / 60:.1f} minutes"""


def _template_summary(pipeline_output: PipelineOutput) -> str:
    """Generate summary without LLM."""
    stats = pipeline_output.statistics
    bottlenecks = pipeline_output.bottlenecks

    critical_count = sum(1 for b in bottlenecks if b.severity in ("critical", "high"))
    top_activity = pipeline_output.activities[0].name if pipeline_output.activities else "unknown"

    avg_duration_min = (stats.avg_case_duration_seconds or 0) / 60

    return (
        f"Process analysis discovered {stats.total_cases} cases across {stats.total_activities} "
        f"unique activities with {stats.total_variants} distinct process variants. "
        f"The most frequent activity is '{top_activity}', and the average case duration is "
        f"{avg_duration_min:.1f} minutes. "
        f"Analysis identified {len(bottlenecks)} bottleneck transitions"
        f"{f', including {critical_count} critical/high-severity delays' if critical_count else ''}, "
        f"indicating significant automation potential in this process."
    )
