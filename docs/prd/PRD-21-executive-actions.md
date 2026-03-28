# PRD-21: Executive Action Card — "What To Do Monday Morning"

**Owner:** Mateusz
**Est:** 20 min
**Priority:** P0 — makes the product immediately actionable

---

## Why

The audit found: "A CFO can understand the process is unhealthy and will save $Y, but CANNOT immediately decide which recommendation to fund first." We need a single card that answers: "What are the 3 things I should do Monday morning?"

## Design

A prominent card at the top of the AI Analysis tab (above everything else) or on the Overview tab:

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Recommended Actions                                     │
│                                                             │
│  1. QUICK WIN — Automate Teams reporting                    │
│     811 manual data transfers/month into Teams              │
│     Saves: ~12 hrs/month | Effort: 1-2 weeks               │
│     → Deploy automated digest bot from Excel/SharePoint     │
│                                                             │
│  2. HIGH IMPACT — RPA for data entry activities             │
│     13 activities with heavy copy-paste (2,474 ops total)   │
│     Saves: ~28 hrs/month | Effort: 2-4 weeks               │
│     → Start with top 3: Searching Google, AI Searching,     │
│       New Feed read LinkedIn                                │
│                                                             │
│  3. PROCESS FIX — Reduce rework loops                       │
│     Teams↔Presentation switching repeats 12× in variants   │
│     Saves: ~8 hrs/month | Effort: Process redesign          │
│     → Consolidate presentation updates into shared doc      │
│                                                             │
│  Total projected savings: $X,XXX/year                       │
└─────────────────────────────────────────────────────────────┘
```

### Data sources (all already available)
1. **Quick Win**: Hub insight data (copy_paste_flows → Teams incoming count)
2. **High Impact**: Recommendations sorted by estimated_time_saved × affected_cases
3. **Process Fix**: Variants with compressed loops (×N > 3)

### Implementation

**File:** `frontend/src/components/action-card.tsx` (NEW)

Component takes `pipeline`, `copilot`, `copyPasteFlows` as props. Computes:

1. **Quick Win**: Find the hub app (most incoming paste flows). Calculate hours = total_incoming_transfers × 5s / 3600. Show the top 3 source apps.

2. **High Impact**: Take top recommendation by (estimated_time_saved_seconds × affected_cases_percentage). Calculate monthly hours = time_saved × monthly_cases × affected_pct / 3600. List the top 3 target activities.

3. **Process Fix**: Find variants with compressed segments where count > 3. Show the biggest repeating pattern and suggest consolidation.

Each action has:
- **Label** (Quick Win / High Impact / Process Fix)
- **One-line description**
- **Key metric** (transfers, ops, loops)
- **Savings estimate** (hrs/month)
- **Effort level** (1-2 weeks / 2-4 weeks / process redesign)
- **Concrete next step** (one sentence)

### Styling
- Distinct from other cards — maybe a subtle left border with gradient (green → blue → amber for the 3 priorities)
- Each action is a row with clear visual separation
- Total savings at bottom ties to ROI calculator

## Files
- `frontend/src/components/action-card.tsx` (NEW)
- `frontend/src/components/process-tabs.tsx` — add to AI Analysis tab, above recommendations

## Verification
- Card shows 3 concrete actions with real data
- Savings numbers are plausible (cross-check with ROI calculator)
- Non-technical language throughout
- `cd frontend && npm run build` passes
