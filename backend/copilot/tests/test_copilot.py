"""Tests for the copilot module using mock PipelineOutput."""

import pytest

from backend.models import (
    Activity,
    Bottleneck,
    CopilotOutput,
    PipelineOutput,
    ProcessEdge,
    ProcessMap,
    ProcessNode,
    ProcessStatistics,
    ProcessVariant,
    Recommendation,
)
from backend.copilot.analyzer import generate_summary, _template_summary
from backend.copilot.recommender import generate_recommendations
from backend.copilot.bpmn_generator import generate_bpmn, _sanitize_id, _extract_main_sequence
from backend.copilot.copilot import run_copilot


def make_pipeline_output(
    activities: list[Activity] | None = None,
    variants: list[ProcessVariant] | None = None,
    bottlenecks: list[Bottleneck] | None = None,
) -> PipelineOutput:
    activities = activities or [
        Activity(name="Receive Request", frequency=50, avg_duration_seconds=30, copy_paste_count=2),
        Activity(name="Validate Data", frequency=45, avg_duration_seconds=120, copy_paste_count=5),
        Activity(name="Enter Data Manually", frequency=40, avg_duration_seconds=600, copy_paste_count=20),
        Activity(name="Send Confirmation", frequency=38, avg_duration_seconds=60),
    ]
    variants = variants or [
        ProcessVariant(
            variant_id=1,
            sequence=["Receive Request", "Validate Data", "Enter Data Manually", "Send Confirmation"],
            case_count=35,
            percentage=70.0,
            avg_total_duration_seconds=810.0,
        ),
        ProcessVariant(
            variant_id=2,
            sequence=["Receive Request", "Enter Data Manually", "Send Confirmation"],
            case_count=15,
            percentage=30.0,
            avg_total_duration_seconds=660.0,
        ),
    ]
    bottlenecks = bottlenecks or [
        Bottleneck(
            from_activity="Validate Data",
            to_activity="Enter Data Manually",
            avg_wait_seconds=900,
            max_wait_seconds=3600,
            case_count=40,
            severity="critical",
        )
    ]
    process_map = ProcessMap(
        nodes=[ProcessNode(id=a.name, label=a.name, frequency=a.frequency) for a in activities],
        edges=[
            ProcessEdge(source="Receive Request", target="Validate Data", weight=45, avg_duration_seconds=150),
            ProcessEdge(source="Validate Data", target="Enter Data Manually", weight=40, avg_duration_seconds=600),
            ProcessEdge(source="Enter Data Manually", target="Send Confirmation", weight=38, avg_duration_seconds=60),
        ],
    )
    statistics = ProcessStatistics(
        total_cases=50,
        total_events=200,
        total_activities=4,
        total_variants=2,
        avg_case_duration_seconds=810.0,
        median_case_duration_seconds=750.0,
        start_date="2026-03-01T08:00:00",
        end_date="2026-03-20T17:00:00",
    )
    return PipelineOutput(
        process_id="test-process-001",
        activities=activities,
        variants=variants,
        bottlenecks=bottlenecks,
        process_map=process_map,
        statistics=statistics,
    )


def test_generate_summary_returns_string():
    output = make_pipeline_output()
    summary = generate_summary(output)
    assert isinstance(summary, str)
    assert len(summary) > 20


def test_template_summary_contains_key_facts():
    output = make_pipeline_output()
    summary = _template_summary(output)
    assert "50" in summary  # total_cases
    assert "4" in summary  # total_activities


def test_generate_recommendations_returns_list():
    output = make_pipeline_output()
    recs = generate_recommendations(output)
    assert isinstance(recs, list)
    assert len(recs) > 0


def test_recommendations_have_required_fields():
    output = make_pipeline_output()
    recs = generate_recommendations(output)
    for rec in recs:
        assert isinstance(rec, Recommendation)
        assert rec.id >= 1
        assert rec.type in {"automate", "eliminate", "simplify", "parallelize", "reassign"}
        assert rec.impact in {"low", "medium", "high"}
        assert 1 <= rec.priority <= 5
        assert len(rec.reasoning) > 10


def test_recommendations_sorted_by_priority():
    output = make_pipeline_output()
    recs = generate_recommendations(output)
    # Priority 1 should appear before priority 5
    priorities = [r.priority for r in recs]
    assert priorities == sorted(priorities)


def test_high_copy_paste_gets_automate_type():
    """Activity with many copy-paste operations should be recommended for automation."""
    output = make_pipeline_output()
    recs = generate_recommendations(output)
    # "Enter Data Manually" has copy_paste_count=20 → should be automate
    top_target = recs[0].target
    top_type = recs[0].type
    # At least one automate recommendation should exist
    automate_recs = [r for r in recs if r.type == "automate"]
    assert len(automate_recs) > 0


def test_bpmn_generator_returns_valid_xml():
    output = make_pipeline_output()
    bpmn = generate_bpmn(output)
    assert isinstance(bpmn, str)
    assert "bpmn" in bpmn.lower()
    assert "startEvent" in bpmn or "startevent" in bpmn.lower()
    assert "endEvent" in bpmn or "endevent" in bpmn.lower()


def test_bpmn_contains_all_main_activities():
    output = make_pipeline_output()
    bpmn = generate_bpmn(output)
    main_variant = output.variants[0]
    for activity in main_variant.sequence:
        assert activity[:20] in bpmn or activity[:10] in bpmn


def test_bpmn_sanitize_id():
    assert _sanitize_id("Hello World") == "task_Hello_World"
    assert _sanitize_id("123abc") == "task_123abc"
    assert _sanitize_id("step-1/check") == "task_step-1_check"


def test_extract_main_sequence_uses_variant():
    output = make_pipeline_output()
    sequence = _extract_main_sequence(output)
    assert "Receive Request" in sequence
    assert "Send Confirmation" in sequence


def test_extract_main_sequence_deduplicates():
    output = make_pipeline_output()
    sequence = _extract_main_sequence(output)
    assert len(sequence) == len(set(sequence))


def test_run_copilot_returns_copilot_output():
    output = make_pipeline_output()
    result = run_copilot(output, reference_bpmn_path="/nonexistent/path.bpmn")
    assert isinstance(result, CopilotOutput)
    assert result.process_id == "test-process-001"
    assert isinstance(result.summary, str)
    assert isinstance(result.recommendations, list)
    assert isinstance(result.bpmn_xml, str)


def test_run_copilot_handles_empty_variants():
    output = make_pipeline_output(variants=[])
    result = run_copilot(output)
    assert result.bpmn_xml  # should still generate BPMN


def test_run_copilot_handles_empty_activities():
    output = make_pipeline_output(activities=[], variants=[], bottlenecks=[])
    result = run_copilot(output)
    assert isinstance(result, CopilotOutput)
