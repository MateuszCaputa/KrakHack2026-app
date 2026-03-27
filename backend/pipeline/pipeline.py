"""Main pipeline entry point: runs all stages and returns PipelineOutput."""

import uuid

import pandas as pd

from backend.models import PipelineOutput, ProcessStatistics, ApplicationUsage
from backend.pipeline.ingest import ingest
from backend.pipeline.discovery import discover_activities, discover_process_map
from backend.pipeline.variants import discover_variants
from backend.pipeline.bottlenecks import detect_bottlenecks

CASE_COL = "case:concept:name"
TIMESTAMP_COL = "time:timestamp"
ACTIVITY_COL = "concept:name"
RESOURCE_COL = "org:resource"
APP_COL = "application_name"
DURATION_COL = "duration_ms"
ACTIVE_STATUS = "Active"
STATUS_COL = "Activity Status"


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
    application_usage = _compute_application_usage(df)

    return PipelineOutput(
        process_id=process_id,
        activities=activities,
        variants=variants,
        bottlenecks=bottlenecks,
        process_map=process_map,
        statistics=statistics,
        application_usage=application_usage,
    )


def _compute_statistics(df: pd.DataFrame, variants: list) -> ProcessStatistics:
    """Compute summary statistics for the event log."""
    case_times = df.groupby(CASE_COL)[TIMESTAMP_COL].agg(["min", "max"])
    case_durations = (case_times["max"] - case_times["min"]).dt.total_seconds()

    total_users = df[RESOURCE_COL].nunique() if RESOURCE_COL in df.columns else 0
    total_applications = df[APP_COL].nunique() if APP_COL in df.columns else 0

    return ProcessStatistics(
        total_cases=df[CASE_COL].nunique(),
        total_events=len(df),
        total_activities=df[ACTIVITY_COL].nunique(),
        total_variants=len(variants),
        total_users=int(total_users),
        total_applications=int(total_applications),
        avg_case_duration_seconds=float(case_durations.mean()),
        median_case_duration_seconds=float(case_durations.median()),
        start_date=str(df[TIMESTAMP_COL].min().isoformat()),
        end_date=str(df[TIMESTAMP_COL].max().isoformat()),
    )


def _compute_application_usage(df: pd.DataFrame) -> list[ApplicationUsage]:
    """Compute time spent per application broken down by active/passive."""
    if APP_COL not in df.columns or DURATION_COL not in df.columns:
        return []

    has_status = STATUS_COL in df.columns

    grouped = df.groupby(APP_COL)
    result = []
    for app, group in grouped:
        if not str(app).strip():
            continue
        total = float(group[DURATION_COL].sum()) / 1000.0
        if has_status:
            active = float(group.loc[group[STATUS_COL] == ACTIVE_STATUS, DURATION_COL].sum()) / 1000.0
        else:
            active = total
        passive = total - active
        result.append(ApplicationUsage(
            application=str(app),
            total_duration_seconds=total,
            active_duration_seconds=active,
            passive_duration_seconds=passive,
        ))

    return sorted(result, key=lambda a: a.total_duration_seconds, reverse=True)
