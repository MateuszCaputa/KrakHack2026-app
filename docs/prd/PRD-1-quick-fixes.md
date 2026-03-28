# PRD-1: Quick Fixes

**Owner:** Mateusz
**Est:** 20 min
**Priority:** P0 — do first, unblocks everything
**Status:** pending

---

## Why

Audit found 3 issues that are easy to spot by judges or would silently corrupt data. All trivial to fix.

## Tasks

### 1A. Fix "AI Generated" badge (misleading)

**File:** `frontend/src/components/bpmn-viewer.tsx` (~line 361)

**Problem:** "AI Generated" badge with pulsing green dot shows unconditionally on BPMN tab — even when Gemini API key is not set and everything is rule-based. If a judge asks "what AI generated this?" we're caught.

**Fix:** Change badge text to "Generated Workflow" — truthful in all cases. The workflow IS generated from discovered process data. If we have time, add conditional: show "AI-Enhanced" only when Gemini API key was used (check if recommendations have LLM-style reasoning vs template).

### 1B. Fix negative duration bug (data corruption)

**File:** `backend/pipeline/discovery.py` (~line 63)

**Problem:** `wait_seconds` computed from timestamp differences is not clipped to 0. If timestamps are out of order (data quality issue), negative values flow into `avg_duration_seconds` on ProcessEdge, producing nonsense metrics in the process map.

**Note:** `bottlenecks.py` already correctly uses `.clip(lower=0)` — this file forgot to.

**Fix:** Add `.clip(lower=0)` after `.dt.total_seconds()`:
```python
transitions["wait_seconds"] = (
    transitions["next_timestamp"] - transitions[TIMESTAMP_COL]
).dt.total_seconds().clip(lower=0)
```

### 1C. Remove unused import (code cleanliness)

**File:** `frontend/src/components/tooltip.tsx`

**Fix:** Remove `useCallback` from the import — it's imported but never used.

## Verification

- Restart API server
- `curl -s -X POST "http://localhost:8000/api/run-local?max_files=3"` — check response
- Verify no negative `avg_duration_seconds` in process map edges
- BPMN tab shows "Generated Workflow" not "AI Generated"
- `cd frontend && npm run build` passes
