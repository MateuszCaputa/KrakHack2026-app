"""Shared Pydantic models matching the contract schemas in contracts/."""

from pydantic import BaseModel


# --- Raw Data Models (Task Mining input) ---

class RawActivity(BaseModel):
    """Single row from Activity Sequence CSV."""
    user_name: str
    process_step: str
    application_name: str
    activity_status: str  # Active, Passive
    process_step_start: str  # ISO timestamp
    process_step_end: str  # ISO timestamp
    activity_duration_ms: int
    activity_type: str  # mouse, keyboard, activity-change
    business_id: str | None = None
    process_name: str | None = None
    clicks_no: int = 0
    text_entries_no: int = 0
    copy_no: int = 0
    paste_no: int = 0


# --- Pipeline Output Models ---

class Activity(BaseModel):
    """An aggregated activity/process step."""
    name: str
    frequency: int
    avg_duration_seconds: float
    min_duration_seconds: float | None = None
    max_duration_seconds: float | None = None
    applications: list[str] = []
    performers: list[str] = []
    manual_interaction_count: int = 0
    copy_paste_count: int = 0
    context_switch_count: int = 0
    category: str | None = None


# Keep alias for frontend compatibility
ProcessStep = Activity


class ProcessVariant(BaseModel):
    variant_id: int
    sequence: list[str]
    case_count: int
    percentage: float
    avg_total_duration_seconds: float | None = None


class Bottleneck(BaseModel):
    from_activity: str
    to_activity: str
    avg_wait_seconds: float
    max_wait_seconds: float | None = None
    case_count: int | None = None
    severity: str  # low, medium, high, critical


class ProcessNode(BaseModel):
    id: str
    label: str
    frequency: int | None = None


class ProcessEdge(BaseModel):
    source: str
    target: str
    weight: int
    avg_duration_seconds: float | None = None


class ProcessMap(BaseModel):
    nodes: list[ProcessNode]
    edges: list[ProcessEdge]


class ProcessStatistics(BaseModel):
    total_cases: int
    total_events: int
    total_activities: int
    total_variants: int
    total_users: int = 0
    total_applications: int = 0
    avg_case_duration_seconds: float | None = None
    median_case_duration_seconds: float | None = None
    start_date: str | None = None
    end_date: str | None = None


class ApplicationUsage(BaseModel):
    """Time spent per application."""
    application: str
    total_duration_seconds: float
    active_duration_seconds: float
    passive_duration_seconds: float


class CopyPasteFlow(BaseModel):
    """Copy-paste data flow between two applications from Activity Heatmap data."""
    source_app: str
    target_app: str
    count: int


class PerformerStats(BaseModel):
    """Per-user aggregated performance metrics."""
    user: str
    total_events: int
    total_duration_seconds: float
    avg_activity_duration_seconds: float
    top_applications: list[str] = []
    activity_count: int = 0


class PipelineOutput(BaseModel):
    process_id: str
    activities: list[Activity]
    variants: list[ProcessVariant]
    bottlenecks: list[Bottleneck]
    process_map: ProcessMap
    statistics: ProcessStatistics
    application_usage: list[ApplicationUsage] = []
    copy_paste_flows: list[CopyPasteFlow] = []
    performer_stats: list[PerformerStats] = []


# --- Copilot Output Models ---

class Recommendation(BaseModel):
    id: int
    type: str  # automate, eliminate, simplify, parallelize, reassign
    target: str
    reasoning: str
    impact: str  # low, medium, high
    priority: int  # 1-5
    estimated_time_saved_seconds: float | None = None
    affected_cases_percentage: float | None = None
    automation_type: str | None = None


class DecisionRule(BaseModel):
    rule_id: str
    condition: str
    action: str
    description: str | None = None


class ProcessVariable(BaseModel):
    name: str
    type: str  # string, number, boolean, date
    description: str | None = None
    source_step: str | None = None


class AutomationStep(BaseModel):
    action: str
    description: str
    target_app: str | None = None


class AutomationBlueprint(BaseModel):
    blueprint_id: str
    name: str
    target_activity: str
    automation_type: str
    trigger_description: str
    steps: list[AutomationStep]
    technology_stack: list[str] = []
    complexity: str = "medium"
    estimated_dev_hours: float = 8.0
    prerequisites: list[str] = []


class CopilotOutput(BaseModel):
    process_id: str
    summary: str
    recommendations: list[Recommendation]
    bpmn_xml: str
    decision_rules: list[DecisionRule] = []
    process_variables: list[ProcessVariable] = []
    reference_bpmn_comparison: str | None = None
    blueprints: list[AutomationBlueprint] = []
