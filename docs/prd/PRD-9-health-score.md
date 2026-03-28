# PRD-9: Process Health Score

**Owner:** overnight agent
**Est:** 20 min
**Priority:** P1 — memorable single number, easy to explain
**Status:** pending

---

## Why

One big memorable number. "Your process health is 62 out of 100." Judges quote this. It frames the entire analysis. Every consulting firm uses health scores for exactly this reason.

## Design

Large prominent score display at the very top of the Overview tab (above date range stat cards).

### Computation (frontend-only, from PipelineOutput)

Three sub-scores, averaged:

```
standardization = max(0, 100 - total_variants * 3)
  // 1 variant = 97, 10 = 70, 33 = 1 → fewer variants = more standardized

bottleneck_health = max(0, 100 - critical_count * 25 - high_count * 10 - medium_count * 3)
  // 0 critical, 0 high = 100 → clean process

automation_burden = max(0, 100 - (total_copy_paste / max(total_events, 1)) * 300)
  // low copy-paste ratio = healthy, high = burdened

health_score = Math.round((standardization + bottleneck_health + automation_burden) / 3)
```

### UI

```
┌─────────────────────────────────────────────────────┐
│  PROCESS HEALTH                                      │
│  ████████████████████░░░░░░░░░░  62 / 100           │
│  Standardization: 73  Bottlenecks: 45  Automation: 68│
└─────────────────────────────────────────────────────┘
```

- Large horizontal progress bar with score number
- Color: green (>70), amber (40-70), red (<40)
- Three small sub-score labels below the bar
- Tooltip on `?` explaining the methodology
- Takes full width of the overview, before the 3-column stat cards

### Styling
- Distinct from stat cards — larger, with a colored progress bar
- bg-zinc-900 border, but the bar itself uses the health color
- Score number in 3xl font, bold

## Files
- `frontend/src/components/health-score.tsx` (NEW)
- `frontend/src/components/process-tabs.tsx` — add above stat cards in Overview

## Verification
- Overview tab shows health score bar at top
- Score changes with different data (not hardcoded)
- Color coding works (test mentally: 0 variants = high score, many = low)
- `cd frontend && npm run build` passes
