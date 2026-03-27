# Pipeline Module

**Owner:** pipeline-owner
**Purpose:** Ingest Task Mining data from KYP.ai exports and produce structured process analysis (PipelineOutput).

## Understanding The Data

This is **Task Mining** data, NOT traditional process mining. The data captures individual user interactions (clicks, keystrokes, app switches) at a software company. It comes from KYP.ai (hackathon sponsor).

### Key Data Files

The dataset lives in `Process-to-Automation Copilot Challenge/Dataset/` (gitignored, 1.6GB total). Each teammate must have it locally.

| File Type | What It Is | Key For |
|-----------|------------|---------|
| **Activity Sequence CSVs** (22 files) | Raw user interactions with timestamps, apps, process steps | Core analysis — this is the main data |
| **PRM Export** | Process Resource Matrix — who uses what apps, how long | User/app analysis |
| **Activity Heatmap** | Copy/paste patterns between apps | Finding automation opportunities |
| **Tool use (aggregated + over time)** | Time per application | App usage analysis |
| **Process Distribution** | Time per process per day | Process overview |
| **Headcount Coverage** | Daily user counts | Context |
| **PDD Export (.docx)** | Process Definition Document | Business context |
| **model (67).bpmn** | Reference BPMN from iGrafx | Compare discovered vs reference |

### Activity Sequence Columns (the main data)

```
User name          — UUID of the user (anonymized)
Process step       — High-level step name (e.g. "Working on kyp-backend", "Communication")
Application name   — App being used (IntelliJ, Teams, Chrome, etc.)
Activity Status    — Active or Passive
Process step start — ISO timestamp
Process step end   — ISO timestamp
Activity duration (ms) — Duration of single interaction
Activity type      — mouse, keyboard, activity-change
Business ID        — Case identifier (OFTEN "NOT_FOUND" — must handle this)
Process Name       — Process category
Clicks No.         — Number of clicks in this step
Text entries No.   — Number of text inputs
Copy/Paste/Cut No. — Copy-paste counts (key for RPA detection)
```

### Critical Data Quirks
- **Business ID is often NOT_FOUND** — you cannot rely on it as case_id. Group by User + time windows instead.
- **Files are HUGE** (up to 163MB each) — use chunked pandas reading: `pd.read_csv(f, chunksize=10000)`
- **22 separate Activity Sequence files** — each likely represents a different process or export. Start with the smallest one (4.4MB) for development.
- **The data is very granular** — individual mouse clicks. You must aggregate up to meaningful process steps.

## What To Build (Priority Order)

### P0 — Must have for demo
1. **Data Ingestion** — Load Activity Sequence CSVs with chunked reading. Parse timestamps, handle missing Business IDs. Start with the smallest file for dev. File: `ingest.py`
2. **Step Aggregation** — Group raw interactions into meaningful process steps. Use the `Process step` column as the primary grouping. Calculate duration, interaction counts per step. File: `aggregation.py`
3. **Case Construction** — Since Business ID is often missing, construct "cases" by grouping user sessions (same user, continuous activity within a time threshold, e.g. 30 min gap = new case). File: `case_builder.py`
4. **Process Discovery** — From constructed cases, discover the process flow using pm4py. Extract step frequencies, transitions, variants. File: `discovery.py`
5. **Bottleneck Detection** — Calculate wait times between consecutive steps. Flag transitions with high wait times. File: `bottlenecks.py`

### P1 — Nice to have
6. **Application Usage Analysis** — Which apps are used in which steps, active vs passive time. File: `app_analysis.py`
7. **Copy-Paste Pattern Analysis** — Use the heatmap data to find repetitive copy-paste between apps (prime RPA candidates). File: `copypaste_analysis.py`
8. **Variant Analysis** — Identify different paths through the process, sort by frequency. File: `variants.py`

### P2 — Stretch goals
9. **Process Map Graph** — NetworkX graph of the discovered process. File: `process_map.py`
10. **Statistics Dashboard Data** — Aggregate stats for the frontend. File: `statistics.py`

## Output Contract

Your module produces a `PipelineOutput` (defined in `backend/models.py`). See `contracts/pipeline_output.json` for the full schema.

## Key Libraries
- `pm4py` — process mining (discovery after you've constructed cases)
- `pandas` — data loading and aggregation (USE CHUNKED READING for large files)
- `networkx` — graph construction
- `python-docx` — reading the PDD .docx file (if needed)

## Testing
- `pytest backend/pipeline/tests/ -x`
- Use `data/sample_event_log.csv` for basic model tests
- For real data tests, load only the smallest Activity Sequence file (4.4MB)
- Test edge cases: missing Business ID, empty process steps, single-user sessions
