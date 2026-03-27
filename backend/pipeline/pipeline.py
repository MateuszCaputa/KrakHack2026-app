"""Main pipeline entry point: runs all stages and returns PipelineOutput."""

import uuid

import pandas as pd

from backend.models import PipelineOutput, ProcessStatistics
from backend.pipeline.ingest import ingest
from backend.pipeline.discovery import discover_activities, discover_process_map
from backend.pipeline.variants import discover_variants
from backend.pipeline.bottlenecks import detect_bottlenecks

CASE_COL = "case:concept:name"
TIMESTAMP_COL = "time:timestamp"
ACTIVITY_COL = "concept:name"


def run_pipeline(dataset_directory: str, process_id: str | None = None) -> PipelineOutput:
    """Run the full pipeline on Activity Sequence CSV files in the given directory."""
    if process_id is None:
        process_id = str(uuid.uuid4())

    df = ingest(dataset_directory)
    activities = discover_activities(df)
    variants = discover_variants(df)
    bottlenecks = detect_bottlenecks(df)
    process_map = discover_process_map(df)
    statistics = _compute_statistics(df, variants)

    return PipelineOutput(
        process_id=process_id,
        activities=activities,
        variants=variants,
        bottlenecks=bottlenecks,
        process_map=process_map,
        statistics=statistics,
    )


def _compute_statistics(df: pd.DataFrame, variants: list) -> ProcessStatistics:
    """Compute summary statistics for the event log."""
    case_times = df.groupby(CASE_COL)[TIMESTAMP_COL].agg(["min", "max"])
    case_durations = (case_times["max"] - case_times["min"]).dt.total_seconds()

    return ProcessStatistics(
        total_cases=df[CASE_COL].nunique(),
        total_events=len(df),
        total_activities=df[ACTIVITY_COL].nunique(),
        total_variants=len(variants),
        avg_case_duration_seconds=float(case_durations.mean()),
        median_case_duration_seconds=float(case_durations.median()),
        start_date=str(df[TIMESTAMP_COL].min().isoformat()),
        end_date=str(df[TIMESTAMP_COL].max().isoformat()),
    )
