# PRD-2: Context Switch Detection & Display

**Owner:** Mateusz
**Est:** 30 min
**Priority:** P0 — PDF mentions context switches 2x, currently zero implementation
**Status:** pending
**Depends on:** PRD-1 (pipeline restart)

---

## Why

The task PDF explicitly requires "detecting bottlenecks, delays, and **frequent context switches between applications**." The other Claude's assessment flags this as the highest-priority gap — mentioned twice in the PDF criteria. We already track `applications` per activity but never compute or display a dedicated context switch metric.

## Background

A context switch = when a user moves from one application to another within a case. Raw data has `application_name` per event. By sorting events chronologically within a case and counting where `app[i] != app[i-1]`, we get context switch counts attributable to each activity (process step).

## Tasks

### 2A. Add field to Activity model

**File:** `backend/models.py`

Add to the `Activity` class:
```python
context_switch_count: int = 0
```

### 2B. Compute context switches in pipeline

**File:** `backend/pipeline/discovery.py`

In `discover_activities()`, after grouping events by activity name:
1. Sort all events by `[case:concept:name, time:timestamp]`
2. Add a shifted column: `prev_app = df.groupby(CASE_COL)['application_name'].shift(1)`
3. Mark switches: `is_switch = (df['application_name'] != prev_app) & prev_app.notna()`
4. Group by activity name, sum `is_switch` → that's the context_switch_count

Attach to each Activity object in the output.

### 2C. Add TypeScript type

**File:** `frontend/src/lib/types.ts`

Add to `Activity` interface:
```typescript
context_switch_count: number;
```

### 2D. Add column to activities table

**File:** `frontend/src/components/process-tabs.tsx`

Add "Ctx Switches" column to the Top Activities table header and body.
- Header: `<InlineTooltip text="Application switches detected — frequent switching indicates manual cross-system work, a prime automation target">Ctx Switches</InlineTooltip>`
- Body: show count, highlight orange if > 20

### 2E. Add to recommender scoring

**File:** `backend/copilot/recommender.py`

Add to `_score_activity()`:
```python
# Context switches = cross-app manual work
if activity.context_switch_count > 20:
    score += 15
elif activity.context_switch_count > 5:
    score += 8
```

### 2F. Add stat card (optional, if time)

Add context switch total to the top stat cards row or the Overview tab:
"Context Switches: X total" with tooltip "Total application switches across all activities — indicates manual cross-system work volume"

## Verification

- Run pipeline: `curl -s -X POST "http://localhost:8000/api/run-local?max_files=3"`
- Check response: activities should have `context_switch_count > 0` for multi-app activities
- Frontend: Overview tab activities table shows "Ctx Switches" column
- `cd frontend && npm run build` passes
