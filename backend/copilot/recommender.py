"""Automation recommender: score activities and generate actionable recommendations."""

from backend.models import Activity, Bottleneck, PipelineOutput, Recommendation
from backend.copilot.llm import call_llm

MAX_RECOMMENDATIONS = 10

AUTOMATION_TYPE_LABELS = {
    "automate": "Full automation (RPA/script)",
    "eliminate": "Eliminate (pure waste/rework)",
    "simplify": "Simplify (reduce steps)",
    "parallelize": "Parallelize (concurrent execution)",
    "reassign": "Reassign (delegate to system)",
}


def generate_recommendations(pipeline_output: PipelineOutput) -> list[Recommendation]:
    """Generate ranked automation recommendations from pipeline output."""
    bottleneck_severity_map = _build_bottleneck_map(pipeline_output.bottlenecks)
    frequency_median = _median_frequency(pipeline_output.activities)

    scored = []
    for activity in pipeline_output.activities:
        score = _score_activity(activity, bottleneck_severity_map, frequency_median)
        automation_type = _determine_automation_type(activity, bottleneck_severity_map)
        scored.append((score, activity, automation_type))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:MAX_RECOMMENDATIONS]

    recommendations = []
    for rank, (score, activity, automation_type) in enumerate(top, start=1):
        reasoning = _generate_reasoning(activity, automation_type, bottleneck_severity_map, score)
        impact = _determine_impact(score)
        priority = _score_to_priority(score)
        time_saved = _estimate_time_saved(activity, automation_type)

        recommendations.append(Recommendation(
            id=rank,
            type=automation_type,
            target=activity.name,
            reasoning=reasoning,
            impact=impact,
            priority=priority,
            estimated_time_saved_seconds=time_saved,
            affected_cases_percentage=_estimate_affected_cases(activity, pipeline_output),
            automation_type=AUTOMATION_TYPE_LABELS.get(automation_type),
        ))

    return recommendations


def _build_bottleneck_map(bottlenecks: list[Bottleneck]) -> dict[str, float]:
    """Map activity name → max normalized severity score (0-1)."""
    severity_values = {"critical": 1.0, "high": 0.75, "medium": 0.4, "low": 0.1}
    result: dict[str, float] = {}

    for b in bottlenecks:
        value = severity_values.get(b.severity, 0.0)
        for name in (b.from_activity, b.to_activity):
            result[name] = max(result.get(name, 0.0), value)

    return result


def _median_frequency(activities: list[Activity]) -> float:
    if not activities:
        return 1.0
    freqs = sorted(a.frequency for a in activities)
    mid = len(freqs) // 2
    return float(freqs[mid])


def _score_activity(
    activity: Activity,
    bottleneck_map: dict[str, float],
    frequency_median: float,
) -> float:
    """Score an activity for automation potential (0–100)."""
    score = 0.0

    # Copy-paste = manual data transfer = prime RPA candidate
    if activity.copy_paste_count > 10:
        score += 35
    elif activity.copy_paste_count > 3:
        score += 20
    elif activity.copy_paste_count > 0:
        score += 10

    # Long duration = high manual effort
    avg_sec = activity.avg_duration_seconds
    if avg_sec > 600:
        score += 25
    elif avg_sec > 120:
        score += 15
    elif avg_sec > 30:
        score += 5

    # High frequency = repetitive = good automation ROI
    if frequency_median > 0:
        freq_ratio = activity.frequency / frequency_median
        if freq_ratio > 3:
            score += 20
        elif freq_ratio > 1.5:
            score += 10
        elif freq_ratio > 1:
            score += 5

    # Bottleneck involvement = process friction
    severity_score = bottleneck_map.get(activity.name, 0.0)
    score += severity_score * 25

    # Manual interactions = manual effort
    if activity.manual_interaction_count > 50:
        score += 10
    elif activity.manual_interaction_count > 10:
        score += 5

    return min(score, 100.0)


def _determine_automation_type(
    activity: Activity,
    bottleneck_map: dict[str, float],
) -> str:
    """Determine the most appropriate automation type."""
    is_bottleneck = bottleneck_map.get(activity.name, 0.0) > 0.5
    has_copy_paste = activity.copy_paste_count > 0
    is_long = activity.avg_duration_seconds > 300
    is_frequent = activity.frequency > 10
    many_performers = len(activity.performers) > 3

    if has_copy_paste and is_frequent:
        return "automate"  # RPA for data transfer
    if is_bottleneck and not is_long:
        return "eliminate"  # bottleneck with short steps = rework/waste
    if is_bottleneck and is_long:
        return "automate"  # bottleneck with long steps = automate the wait
    if is_long and not is_frequent:
        return "simplify"   # rare but slow = simplify the steps
    if many_performers and is_frequent:
        return "reassign"   # many people doing same thing = reassign to system
    if is_frequent and not is_long:
        return "automate"   # frequent short tasks = script/macro
    return "simplify"


def _generate_reasoning(
    activity: Activity,
    automation_type: str,
    bottleneck_map: dict[str, float],
    score: float,
) -> str:
    """Generate rule-based reasoning text for a recommendation."""
    reasons = []

    if activity.copy_paste_count > 0:
        reasons.append(
            f"This step involves {activity.copy_paste_count} copy-paste operations, "
            "indicating manual data transfer between systems — a classic RPA target."
        )

    if activity.avg_duration_seconds > 300:
        minutes = activity.avg_duration_seconds / 60
        reasons.append(
            f"Average duration of {minutes:.1f} minutes represents significant manual effort "
            "that could be eliminated through automation."
        )

    if activity.frequency > 20:
        reasons.append(
            f"High occurrence frequency ({activity.frequency} times) means automation ROI "
            "compounds quickly — even small time savings multiply across all cases."
        )

    severity = bottleneck_map.get(activity.name, 0.0)
    if severity > 0.5:
        reasons.append(
            "This step is a bottleneck in the process flow, causing downstream delays "
            "that affect overall throughput."
        )

    if not reasons:
        reasons.append(
            f"This step has automation potential (score: {score:.0f}/100) based on "
            "its frequency, duration, and position in the process flow."
        )

    return " ".join(reasons)


def _determine_impact(score: float) -> str:
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def _score_to_priority(score: float) -> int:
    if score >= 75:
        return 1
    if score >= 55:
        return 2
    if score >= 35:
        return 3
    if score >= 15:
        return 4
    return 5


def _estimate_time_saved(activity: Activity, automation_type: str) -> float:
    """Estimate seconds saved per case if this step is automated."""
    base = activity.avg_duration_seconds
    savings_ratio = {
        "automate": 0.9,
        "eliminate": 1.0,
        "simplify": 0.5,
        "parallelize": 0.4,
        "reassign": 0.7,
    }
    return base * savings_ratio.get(automation_type, 0.5)


def _estimate_affected_cases(activity: Activity, pipeline_output: PipelineOutput) -> float:
    """Estimate what % of cases include this activity."""
    total_cases = pipeline_output.statistics.total_cases
    if total_cases == 0:
        return 0.0
    # Frequency / total_cases gives approximate case coverage
    # (frequency = number of times this activity appears = roughly # cases that hit it)
    return round(min(100.0, (activity.frequency / total_cases) * 100), 1)
