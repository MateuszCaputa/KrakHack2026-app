"""Tests for pipeline bottleneck detection module."""

import pytest
from backend.pipeline.ingest import ingest
from backend.pipeline.bottlenecks import detect_bottlenecks
from backend.models import Bottleneck

DATASET_DIR = "Process-to-Automation Copilot Challenge/Dataset"
VALID_SEVERITIES = {"low", "medium", "high", "critical"}


@pytest.fixture(scope="module")
def event_log():
    return ingest(DATASET_DIR)


def test_detect_bottlenecks_returns_list(event_log):
    bottlenecks = detect_bottlenecks(event_log)
    assert isinstance(bottlenecks, list)
    assert len(bottlenecks) > 0
    assert all(isinstance(b, Bottleneck) for b in bottlenecks)


def test_bottlenecks_sorted_by_wait_time(event_log):
    bottlenecks = detect_bottlenecks(event_log)
    waits = [b.avg_wait_seconds for b in bottlenecks]
    assert waits == sorted(waits, reverse=True)


def test_bottlenecks_have_valid_severity(event_log):
    bottlenecks = detect_bottlenecks(event_log)
    for b in bottlenecks:
        assert b.severity in VALID_SEVERITIES


def test_bottlenecks_wait_times_non_negative(event_log):
    bottlenecks = detect_bottlenecks(event_log)
    for b in bottlenecks:
        assert b.avg_wait_seconds >= 0
        assert b.max_wait_seconds >= b.avg_wait_seconds
