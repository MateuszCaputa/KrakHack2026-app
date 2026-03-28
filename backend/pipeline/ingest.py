"""CSV ingestion for Activity Sequence Export files into a cleaned pandas DataFrame."""

import glob
import os
from datetime import datetime

import pandas as pd
import pm4py

ACTIVITY_COL = "Process step"
CASE_COL = "Business ID"
TIMESTAMP_COL = "Process step start"
USER_COL = "User name"
DURATION_COL = "Activity duration (ms)"
USER_UUID_COL = "User UUID"
APP_COL = "Application name"
COPY_COL = "Copy No."
PASTE_COL = "Paste No."
CLICKS_COL = "Clicks No."
TEXT_COL = "Text entries No."

REQUIRED_COLUMNS = {ACTIVITY_COL, CASE_COL, TIMESTAMP_COL, USER_COL, DURATION_COL}


def load_activity_sequence_csvs(directory: str, max_files: int | None = None) -> pd.DataFrame:
    """Load and merge Activity Sequence Export CSV files from a directory.

    Args:
        directory: Path to folder containing Activity Sequence Export CSV files.
        max_files: If set, load only the N smallest files. Useful for demos and tests
                   to avoid loading the full 1.6 GB dataset.
    """
    pattern = os.path.join(directory, "Activity Sequence Export*.csv")
    paths = sorted(glob.glob(pattern), key=os.path.getsize)
    if not paths:
        raise FileNotFoundError(f"No Activity Sequence Export CSVs found in: {directory}")

    if max_files is not None:
        paths = paths[:max_files]

    frames = []
    for path in paths:
        df = pd.read_csv(path, dtype=str)
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns {missing} in file: {path}")
        frames.append(df)

    return pd.concat(frames, ignore_index=True)


def ingest_sample(directory: str, max_files: int = 3) -> pd.DataFrame:
    """Load a fast sample from the dataset (smallest N files). Use for demos and tests."""
    raw = load_activity_sequence_csvs(directory, max_files=max_files)
    return prepare_dataframe(raw)


def _resolve_case_ids(df: pd.DataFrame) -> pd.Series:
    """Vectorized case ID resolution: Business ID with User UUID fallback."""
    bid = df[CASE_COL].fillna("").str.strip()
    invalid = bid.isin(["", "NOT_FOUND"]) | (bid == "nan")

    uuid = df[USER_UUID_COL].fillna("").str.strip() if USER_UUID_COL in df.columns else pd.Series("", index=df.index)
    uuid_case = "session-" + uuid.where(uuid != "", other="unknown")

    return bid.where(~invalid, other=uuid_case)


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw CSV data and produce a standard event log DataFrame.

    Output columns used by the rest of the pipeline:
        case:concept:name  — case identifier
        concept:name       — activity name
        time:timestamp     — parsed datetime
        org:resource       — user performing the activity
        duration_ms        — activity duration in milliseconds
        copy_count         — number of copy operations in this step
        paste_count        — number of paste operations in this step
    """
    df = df.copy()

    df["case:concept:name"] = _resolve_case_ids(df)
    df["concept:name"] = df[ACTIVITY_COL].str.strip()
    df["time:timestamp"] = pd.to_datetime(df[TIMESTAMP_COL], errors="coerce", utc=False)
    df = df.dropna(subset=["time:timestamp", "concept:name"])
    df["org:resource"] = df[USER_COL].fillna("").str.strip()
    df["application_name"] = df[APP_COL].fillna("").str.strip() if APP_COL in df.columns else ""
    df["duration_ms"] = pd.to_numeric(df[DURATION_COL], errors="coerce").fillna(0)
    df["copy_count"] = pd.to_numeric(df.get(COPY_COL, 0), errors="coerce").fillna(0)
    df["paste_count"] = pd.to_numeric(df.get(PASTE_COL, 0), errors="coerce").fillna(0)
    df["clicks_no"] = pd.to_numeric(df.get(CLICKS_COL, 0), errors="coerce").fillna(0)
    df["text_entries_no"] = pd.to_numeric(df.get(TEXT_COL, 0), errors="coerce").fillna(0)

    df = df.sort_values(["case:concept:name", "time:timestamp"]).reset_index(drop=True)
    return df


def to_pm4py_log(df: pd.DataFrame) -> pm4py.objects.log.obj.EventLog:
    """Convert a prepared DataFrame to a pm4py EventLog (slow — use only when needed)."""
    formatted = pm4py.format_dataframe(
        df,
        case_id="case:concept:name",
        activity_key="concept:name",
        timestamp_key="time:timestamp",
    )
    return pm4py.convert_to_event_log(formatted)


def load_activity_heatmap_csvs(directory: str) -> pd.DataFrame:
    """Load Activity Heatmap Export CSV files (copy-paste flow data).

    Returns DataFrame with columns: source_app, target_app, count.
    Returns empty DataFrame if no heatmap files found.
    """
    pattern = os.path.join(directory, "Activity Heatmap Export*.csv")
    paths = sorted(glob.glob(pattern))
    if not paths:
        return pd.DataFrame(columns=["source_app", "target_app", "count"])

    frames = []
    for path in paths:
        df = pd.read_csv(path, dtype=str)
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)

    copy_col = "Application(Copy&Cut)"
    paste_col = "Application(Paste)"
    count_col = "Count"

    if copy_col not in combined.columns or paste_col not in combined.columns:
        return pd.DataFrame(columns=["source_app", "target_app", "count"])

    result = pd.DataFrame({
        "source_app": combined[copy_col].fillna("").str.strip(),
        "target_app": combined[paste_col].fillna("").str.strip(),
        "count": pd.to_numeric(combined[count_col], errors="coerce").fillna(0).astype(int),
    })
    return result[result["count"] > 0]


def ingest(directory: str) -> pd.DataFrame:
    """Load Activity Sequence CSVs from directory and return a cleaned event log DataFrame."""
    raw = load_activity_sequence_csvs(directory)
    return prepare_dataframe(raw)
