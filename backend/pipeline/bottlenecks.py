"""Bottleneck detection: identify slow transitions between activities."""

import pandas as pd

from backend.models import Bottleneck

CASE_COL = "case:concept:name"
ACTIVITY_COL = "concept:name"
TIMESTAMP_COL = "time:timestamp"

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

    A bottleneck is a transition (A → B) with high average wait time.
    Also considers copy-paste count as a signal for manual effort.
    """
    df = df.sort_values([CASE_COL, TIMESTAMP_COL])

    shifted = df[[CASE_COL, ACTIVITY_COL, TIMESTAMP_COL]].copy()
    shifted["next_activity"] = shifted.groupby(CASE_COL)[ACTIVITY_COL].shift(-1)
    shifted["next_timestamp"] = shifted.groupby(CASE_COL)[TIMESTAMP_COL].shift(-1)
    transitions = shifted.dropna(subset=["next_activity"]).copy()

    transitions["wait_seconds"] = (
        transitions["next_timestamp"] - transitions[TIMESTAMP_COL]
    ).dt.total_seconds().clip(lower=0)

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
