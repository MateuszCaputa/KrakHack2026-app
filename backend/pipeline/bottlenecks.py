"""Bottleneck detection: identify slow transitions between activities."""

import pandas as pd

from backend.models import Bottleneck

CASE_COL = "case:concept:name"
ACTIVITY_COL = "concept:name"
TIMESTAMP_COL = "time:timestamp"

# Transitions longer than this are cross-session gaps (overnight, weekends),
# not real process bottlenecks — exclude them from analysis.
MAX_INTRA_SESSION_SECONDS = 4 * 3600  # 4 hours

SEVERITY_THRESHOLDS = {
    "critical": 3600,   # > 1 hour
    "high": 600,        # > 10 minutes
    "medium": 120,      # > 2 minutes
    "low": 0,
}


def _assign_severity(avg_wait_seconds: float) -> str:
    """Assign severity label based on average wait time."""
    for severity, threshold in SEVERITY_THRESHOLDS.items():
        if avg_wait_seconds > threshold:
            return severity
    return "low"


def detect_bottlenecks(df: pd.DataFrame) -> list[Bottleneck]:
    """Detect bottlenecks by computing wait times between consecutive activities.

    Cross-session transitions (gaps > 4 hours) are excluded — they represent
    overnight breaks or weekends, not real process delays.
    """
    df = df.sort_values([CASE_COL, TIMESTAMP_COL])

    shifted = df[[CASE_COL, ACTIVITY_COL, TIMESTAMP_COL]].copy()
    shifted["next_activity"] = shifted.groupby(CASE_COL)[ACTIVITY_COL].shift(-1)
    shifted["next_timestamp"] = shifted.groupby(CASE_COL)[TIMESTAMP_COL].shift(-1)
    transitions = shifted.dropna(subset=["next_activity"]).copy()

    transitions["wait_seconds"] = (
        transitions["next_timestamp"] - transitions[TIMESTAMP_COL]
    ).dt.total_seconds().clip(lower=0)

    # Drop cross-session gaps
    transitions = transitions[transitions["wait_seconds"] <= MAX_INTRA_SESSION_SECONDS]

    stats = (
        transitions
        .groupby([ACTIVITY_COL, "next_activity"])
        .agg(
            avg_wait_seconds=("wait_seconds", "mean"),
            max_wait_seconds=("wait_seconds", "max"),
            case_count=(ACTIVITY_COL, "count"),
        )
        .reset_index()
    )

    stats = stats[stats["avg_wait_seconds"] > 0].copy()
    stats = stats.sort_values("avg_wait_seconds", ascending=False)

    bottlenecks = []
    for _, row in stats.iterrows():
        severity = _assign_severity(row["avg_wait_seconds"])
        bottlenecks.append(Bottleneck(
            from_activity=str(row[ACTIVITY_COL]),
            to_activity=str(row["next_activity"]),
            avg_wait_seconds=float(row["avg_wait_seconds"]),
            max_wait_seconds=float(row["max_wait_seconds"]),
            case_count=int(row["case_count"]),
            severity=severity,
        ))

    return bottlenecks
