"""Smoke test — verify models and sample data load correctly."""

import csv
from pathlib import Path

from backend.models import PipelineOutput, ProcessVariant, Activity


SAMPLE_CSV = Path(__file__).parents[3] / "data" / "sample_event_log.csv"


def test_sample_csv_exists_and_parses():
    assert SAMPLE_CSV.exists(), f"Sample CSV not found at {SAMPLE_CSV}"
    with open(SAMPLE_CSV) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) > 0
    assert "case_id" in rows[0]
    assert "activity" in rows[0]
    assert "timestamp" in rows[0]


def test_pipeline_output_model_roundtrip():
    output = PipelineOutput(
        process_id="test-001",
        activities=[
            Activity(name="Submit", frequency=8, avg_duration_seconds=0),
        ],
        variants=[
            ProcessVariant(
                variant_id=1,
                sequence=["Submit", "Review", "Close"],
                case_count=5,
                percentage=62.5,
            ),
        ],
        bottlenecks=[],
        process_map={"nodes": [], "edges": []},
        statistics={
            "total_cases": 8,
            "total_events": 55,
            "total_activities": 9,
            "total_variants": 4,
        },
    )
    data = output.model_dump()
    restored = PipelineOutput.model_validate(data)
    assert restored.process_id == "test-001"
    assert len(restored.activities) == 1
