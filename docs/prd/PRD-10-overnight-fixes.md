# PRD-10: Fix Issues from First Overnight Run

**Owner:** overnight agent
**Est:** 15 min
**Priority:** P0 — broken stuff from first agent run
**Status:** pending

---

## Why

The first overnight agent run (feat/overnight-sprint) introduced several UI issues that need fixing before these changes can ship.

## Fixes

### 10A. Variant UI fixes
**File:** `frontend/src/components/process-tabs.tsx` (VariantCard area)

1. **Remove "Happy Path" badge** — it causes misalignment with the percentage number. Instead, add a subtle green left border on the first variant card (`border-l-2 border-l-green-500`).
2. **Fix amber deviation text** — currently yellow text on amber background is unreadable. Change deviation step text to `text-zinc-200` (white) while keeping the amber border/background on the pill.
3. **Don't show "N deviations" for single-step variants** — showing "1 deviation" on a single-step variant like "Create notes" is meaningless. Only show deviation count when sequence length > 3.

### 10B. Fix Live Monitor timestamps
**File:** `frontend/src/components/live-monitor.tsx`

Replace fake `09:00:00` incrementing timestamps with actual timestamps from `pipeline.statistics.start_date`. Parse the start_date, then increment by realistic intervals (e.g., random 1-30 seconds between events) to simulate real event replay.

### 10C. Fix "0 automation recommendations" in Live Monitor
The final "Analysis complete" alert shows "0 automation recommendations" because it reads from copilot data that may not be loaded yet. Fix: use `recommendations?.length ?? 'pending'` or only show this alert if copilot data exists.

### 10D. Fix Top Bottleneck stat card overflow
**File:** `frontend/src/components/process-tabs.tsx`

The "Top Bottleneck" card text overflows when activity names are long. Fix:
- Truncate activity names to ~15 chars each with ellipsis
- Use smaller font (text-lg instead of text-2xl) for this card specifically
- Or: show just the severity + wait time as the value, transition name as `sub`

### 10E. Investigate context switches all showing dashes
Check if `context_switch_count` is actually being computed in the pipeline. The column shows all `—` which means every activity has count=0. Likely the pipeline discovery code needs to compute switches from raw events where application_name changes between consecutive events in the same case, not just within the same activity grouping.

## Verification
- Variant tab: no badge misalignment, readable text, no "1 deviation" on short variants
- Live Monitor: realistic timestamps, correct recommendation count
- Overview: Top Bottleneck card doesn't overflow
- Context Switches column shows actual numbers for multi-app activities
- `cd frontend && npm run build` passes
