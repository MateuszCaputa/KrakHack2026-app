"""Variant analysis: identify unique process paths per case and their frequencies."""

import pandas as pd

from backend.models import ProcessVariant

CASE_COL = "case:concept:name"
ACTIVITY_COL = "concept:name"
TIMESTAMP_COL = "time:timestamp"

MAX_VARIANTS = 50


def discover_variants(df: pd.DataFrame) -> list[ProcessVariant]:
    """Discover unique process variants sorted by frequency.

    A variant is the ordered sequence of activities within a single case.
    """
    df = df.sort_values([CASE_COL, TIMESTAMP_COL])

    case_sequences = (
        df.groupby(CASE_COL)[ACTIVITY_COL]
        .apply(list)
        .reset_index()
        .rename(columns={ACTIVITY_COL: "sequence"})
    )
    # Collapse consecutive duplicate activities (e.g. [A,A,A,B,B,A] → [A,B,A])
    case_sequences["sequence"] = case_sequences["sequence"].apply(_collapse_consecutive)
    case_sequences["sequence_key"] = case_sequences["sequence"].apply(tuple)

    case_durations = _compute_case_durations(df)
    case_sequences = case_sequences.merge(case_durations, on=CASE_COL, how="left")

    variant_groups = case_sequences.groupby("sequence_key")
    total_cases = len(case_sequences)

    variants = []
    for variant_id, (sequence_key, group) in enumerate(
        sorted(variant_groups, key=lambda x: -len(x[1])), start=1
    ):
        if variant_id > MAX_VARIANTS:
            break
        case_count = len(group)
        avg_duration = group["duration_seconds"].mean() if "duration_seconds" in group.columns else None
        variants.append(ProcessVariant(
            variant_id=variant_id,
            sequence=list(sequence_key),
            case_count=case_count,
            percentage=round(100.0 * case_count / total_cases, 2),
            avg_total_duration_seconds=float(avg_duration) if avg_duration is not None else None,
        ))

    return variants


def _collapse_consecutive(seq: list[str]) -> list[str]:
    """Remove consecutive duplicate activities: [A,A,B,B,A] → [A,B,A]."""
    if not seq:
        return seq
    result = [seq[0]]
    for item in seq[1:]:
        if item != result[-1]:
            result.append(item)
    return result


def _compute_case_durations(df: pd.DataFrame) -> pd.DataFrame:
    """Compute total duration in seconds for each case (last event - first event)."""
    case_times = df.groupby(CASE_COL)[TIMESTAMP_COL].agg(["min", "max"]).reset_index()
    case_times["duration_seconds"] = (
        case_times["max"] - case_times["min"]
    ).dt.total_seconds()
    return case_times[[CASE_COL, "duration_seconds"]]
