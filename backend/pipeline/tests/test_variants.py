"""Tests for pipeline variant analysis module."""

import pytest
from backend.pipeline.ingest import ingest
from backend.pipeline.variants import discover_variants
from backend.models import ProcessVariant

DATASET_DIR = "Process-to-Automation Copilot Challenge/Dataset"


@pytest.fixture(scope="module")
def event_log():
    return ingest(DATASET_DIR)


def test_discover_variants_returns_list(event_log):
    variants = discover_variants(event_log)
    assert isinstance(variants, list)
    assert len(variants) > 0
    assert all(isinstance(v, ProcessVariant) for v in variants)


def test_variants_sorted_by_frequency(event_log):
    variants = discover_variants(event_log)
    counts = [v.case_count for v in variants]
    assert counts == sorted(counts, reverse=True)


def test_variants_percentage_sums_to_100(event_log):
    variants = discover_variants(event_log)
    total = sum(v.percentage for v in variants)
    assert total <= 100.01


def test_variants_have_non_empty_sequences(event_log):
    variants = discover_variants(event_log)
    for v in variants:
        assert len(v.sequence) > 0


def test_variant_ids_are_sequential(event_log):
    variants = discover_variants(event_log)
    ids = [v.variant_id for v in variants]
    assert ids == list(range(1, len(ids) + 1))
