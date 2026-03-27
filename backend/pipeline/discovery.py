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


def discover_activities(df: pd.DataFrame) -> list[Activity]:
    """Extract activity statistics from event log DataFrame."""
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
    ).dt.total_seconds()
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
