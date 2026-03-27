"""Tests for pipeline ingest module."""

import pytest
import pandas as pd
from backend.pipeline.ingest import load_activity_sequence_csvs, prepare_dataframe, ingest

DATASET_DIR = "Process-to-Automation Copilot Challenge/Dataset"


def test_load_csvs_returns_dataframe():
    df = load_activity_sequence_csvs(DATASET_DIR)
    assert isinstance(df, pd.DataFrame)
    assert len(df) > 0
    assert "Process step" in df.columns
    assert "Business ID" in df.columns
    assert "Process step start" in df.columns


def test_prepare_dataframe_has_standard_columns():
    raw = load_activity_sequence_csvs(DATASET_DIR)
    df = prepare_dataframe(raw)
    for col in ["case:concept:name", "concept:name", "time:timestamp", "org:resource", "duration_ms"]:
        assert col in df.columns, f"Missing column: {col}"


def test_prepare_dataframe_no_null_timestamps():
    raw = load_activity_sequence_csvs(DATASET_DIR)
    df = prepare_dataframe(raw)
    assert df["time:timestamp"].isna().sum() == 0


def test_prepare_dataframe_has_real_case_ids():
    raw = load_activity_sequence_csvs(DATASET_DIR)
    df = prepare_dataframe(raw)
    cases = df["case:concept:name"].unique()
    assert len(cases) > 1


def test_ingest_end_to_end():
    df = ingest(DATASET_DIR)
    assert isinstance(df, pd.DataFrame)
    assert len(df) > 0


def test_load_raises_on_missing_directory():
    with pytest.raises(FileNotFoundError):
        load_activity_sequence_csvs("/nonexistent/path")
