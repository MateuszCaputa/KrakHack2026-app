"""Process discovery: extract activities, transitions, and process map from event log DataFrame."""

import pandas as pd
import networkx as nx

from backend.models import Activity, ProcessMap, ProcessNode, ProcessEdge

CASE_COL = "case:concept:name"
ACTIVITY_COL = "concept:name"
TIMESTAMP_COL = "time:timestamp"
RESOURCE_COL = "org:resource"
DURATION_COL = "duration_ms"
APP_COL = "application_name"
COPY_COL = "copy_count"
PASTE_COL = "paste_count"
CLICKS_COL = "clicks_no"
TEXT_COL = "text_entries_no"


ACTIVITY_CATEGORIES: dict[str, list[str]] = {
    "Communication": [
        "Use Teams Application", "Use Outlook Application", "Use LinkedIn",
        "New Feed read LinkedIn", "New notification", "Use Hubspot",
    ],
    "Development": [
        "Working on kyp-backend", "Develop kyp-frontend application",
        "Shell scripting", "Use GitLab", "IntelliJOcr", "Use Database Client",
        "pgAdmin", "Browse Repository", "Querying data",
    ],
    "Web & Research": [
        "Browsing in Chrome", "Searching Google", "AI Searching",
        "Use Microsoft Edge", "Use Google Chrome", "Use DeepL",
    ],
    "Documentation": [
        "Create notes", "Creating notes", "Read Confluence",
        "Working on text document", "Working on Excel Sheet",
        "Working on shared files", "Create screenshot", "Work on Presentation",
    ],
    "Project Management": [
        "View Agile Board", "View Issue List", "Update working progress",
        "Dashboard review", "Use kyp.ai", "DevOps Multi Team",
    ],
    "Admin & Config": [
        "Configure Anonymization & Data Masking", "Configure Applications",
        "Configure General Settings", "Configure Organization Management",
        "Configure Process Assignment", "Configure Process Matching",
        "Configure Process Step Naming Rule", "Configure Task Level",
        "Admin Space", "Discovery Space",
    ],
    "File & System": [
        "View Files", "View Downloads  Files", "Windows Explorer",
        "Remote connection", "Remote Host Access", "Use Finder",
        "Use Kyp repository", "Working with Discovery Environment",
    ],
}

_STEP_TO_CATEGORY: dict[str, str] = {}
for _cat, _steps in ACTIVITY_CATEGORIES.items():
    for _step in _steps:
        _STEP_TO_CATEGORY[_step] = _cat


def _categorize_activity(name: str) -> str | None:
    return _STEP_TO_CATEGORY.get(name)


def _compute_context_switches(df: pd.DataFrame) -> dict[str, int]:
    """Count application switches per activity across all cases.

    Counts switches two ways and takes the max per activity:
    1. Switches landing on the activity (consecutive events in same case, different app)
    2. Unique apps used within the activity minus 1 (multi-app activities)
    """
    if APP_COL not in df.columns:
        return {}
    sorted_df = df.sort_values([CASE_COL, TIMESTAMP_COL]).copy()

    # Method 1: consecutive event switches landing on this activity
    prev_app = sorted_df.groupby(CASE_COL)[APP_COL].shift(1)
    is_switch = (sorted_df[APP_COL] != prev_app) & prev_app.notna()
    sorted_df["_is_switch"] = is_switch.astype(int)
    landing_switches = sorted_df.groupby(ACTIVITY_COL)["_is_switch"].sum()

    # Method 2: count unique apps per (case, activity) pair, sum (unique_apps - 1)
    apps_per_case_act = sorted_df.groupby([ACTIVITY_COL, CASE_COL])[APP_COL].nunique()
    multi_app_switches = (apps_per_case_act - 1).clip(lower=0).groupby(level=0).sum()

    result: dict[str, int] = {}
    for act in set(landing_switches.index) | set(multi_app_switches.index):
        v1 = int(landing_switches.get(act, 0))
        v2 = int(multi_app_switches.get(act, 0))
        result[str(act)] = max(v1, v2)
    return result


def discover_activities(df: pd.DataFrame) -> list[Activity]:
    """Extract activity statistics from event log DataFrame."""
    context_switches = _compute_context_switches(df)
    grouped = df.groupby(ACTIVITY_COL)

    activities = []
    for name, group in grouped:
        duration_sec = group[DURATION_COL] / 1000.0
        performers = group[RESOURCE_COL].dropna().unique().tolist()

        applications = []
        if APP_COL in group.columns:
            applications = group[APP_COL].dropna().unique().tolist()

        copy_paste = 0
        if COPY_COL in group.columns and PASTE_COL in group.columns:
            copy_paste = int(group[COPY_COL].sum() + group[PASTE_COL].sum())

        manual_interactions = 0
        if CLICKS_COL in group.columns and TEXT_COL in group.columns:
            manual_interactions = int(group[CLICKS_COL].sum() + group[TEXT_COL].sum())

        activities.append(Activity(
            name=str(name),
            frequency=len(group),
            avg_duration_seconds=float(duration_sec.mean()),
            min_duration_seconds=float(duration_sec.min()),
            max_duration_seconds=float(duration_sec.max()),
            performers=performers,
            applications=applications,
            copy_paste_count=copy_paste,
            manual_interaction_count=manual_interactions,
            context_switch_count=int(context_switches.get(str(name), 0)),
            category=_categorize_activity(str(name)),
        ))

    return sorted(activities, key=lambda a: a.frequency, reverse=True)


def _build_transitions(df: pd.DataFrame) -> pd.DataFrame:
    """Build a DataFrame of consecutive activity transitions per case."""
    df = df.sort_values([CASE_COL, TIMESTAMP_COL])
    df = df[[CASE_COL, ACTIVITY_COL, TIMESTAMP_COL]].copy()
    df["next_activity"] = df.groupby(CASE_COL)[ACTIVITY_COL].shift(-1)
    df["next_timestamp"] = df.groupby(CASE_COL)[TIMESTAMP_COL].shift(-1)
    transitions = df.dropna(subset=["next_activity"]).copy()
    transitions["wait_seconds"] = (
        transitions["next_timestamp"] - transitions[TIMESTAMP_COL]
    ).dt.total_seconds().clip(lower=0)
    return transitions


def discover_process_map(df: pd.DataFrame) -> ProcessMap:
    """Build a process map graph from activity transitions."""
    transitions = _build_transitions(df)

    edge_stats = (
        transitions
        .groupby([ACTIVITY_COL, "next_activity"])
        .agg(weight=(ACTIVITY_COL, "count"), avg_duration_seconds=("wait_seconds", "mean"))
        .reset_index()
    )

    activity_freq = df.groupby(ACTIVITY_COL).size().to_dict()

    nodes = [
        ProcessNode(id=name, label=name, frequency=int(freq))
        for name, freq in activity_freq.items()
    ]

    edges = [
        ProcessEdge(
            source=str(row[ACTIVITY_COL]),
            target=str(row["next_activity"]),
            weight=int(row["weight"]),
            avg_duration_seconds=float(row["avg_duration_seconds"]),
        )
        for _, row in edge_stats.iterrows()
    ]

    return ProcessMap(nodes=nodes, edges=edges)


def build_nx_graph(process_map: ProcessMap) -> nx.DiGraph:
    """Convert ProcessMap to a NetworkX directed graph for further analysis."""
    G = nx.DiGraph()
    for node in process_map.nodes:
        G.add_node(node.id, frequency=node.frequency or 0)
    for edge in process_map.edges:
        G.add_edge(edge.source, edge.target, weight=edge.weight, avg_duration_seconds=edge.avg_duration_seconds or 0)
    return G
