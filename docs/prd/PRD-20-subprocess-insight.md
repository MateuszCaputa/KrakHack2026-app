# PRD-20: Sub-Process Discovery — The Hidden Integration Layer

**Owner:** Mateusz
**Est:** 25 min
**Priority:** P0 — the easter egg, the differentiator

---

## Why

The data reveals a hidden sub-process that cuts across ALL work categories:

```
[Any work] → Copy result → Paste into Teams → Someone reads → Copy from Teams → Paste into their work
```

This "manual integration layer" is invisible when looking at individual activities. It only emerges when you analyze CROSS-CATEGORY data flows. Teams receives 811 paste operations from 12+ apps but sends only 281. It's a 3:1 sink — a manual reporting hub that adds zero process value.

The mentor hinted at exactly this: "there is a split by categories... another bottleneck will be clear."

## Design

### 20A. Cross-Category Flow Sankey (or chord) visualization

**File:** `frontend/src/components/data-flow-insight.tsx` (NEW)

Show a visual on the Overview tab that displays data flowing BETWEEN categories:

```
Documentation ═══════════347══════════════╗
                                          ║
Research ════════════281═══════════════════╬═══► Communication (811 incoming)
                                          ║        (Teams, Outlook)
Development ═════════177══════════════════╝

Communication ═══154═══► Documentation
Communication ════98═══► Research
```

Implementation: Simple horizontal bars showing the top cross-category flows. Each bar = one flow direction. Sorted by count desc. Top 6-8 flows only.

Color the bars by source category color. The insight: Communication category is asymmetric — receives 3x more than it sends.

### 20B. Insight card with business framing

**File:** Update `frontend/src/components/category-breakdown.tsx` (HubInsight)

Enhance the existing HubInsight card with:
1. **The ratio**: "Teams receives 3× more data than it sends — it's a manual reporting hub, not a collaboration tool"
2. **FTE equivalent**: "These 811 manual transfers consume approximately X hours/month — equivalent to Y% of one full-time employee"
3. **The fix**: "A reporting integration (e.g., automated daily digest from Excel/SharePoint/DevOps → Teams channel) would eliminate 80%+ of these manual transfers"

### 20C. Compute cross-category flows (frontend-only)

Using the existing `copy_paste_flows` (from Activity Heatmap) and `activities` (with categories), compute cross-category flow totals in the frontend. No backend changes needed.

Group flows by source_category → target_category using the activity categories already assigned. Sum counts per direction.

## Files
- `frontend/src/components/data-flow-insight.tsx` (NEW) — cross-category flow visualization
- `frontend/src/components/category-breakdown.tsx` — enhance HubInsight with ratios and FTE
- `frontend/src/components/process-tabs.tsx` — add DataFlowInsight to Overview tab

## Demo Script
"Watch this — when we group activities by business domain and trace where data flows between them, a hidden pattern emerges. Documentation, Research, and Development all manually push data INTO Communication. Teams receives 3 times more than it sends. That's not collaboration — that's a manual reporting layer consuming X hours per month. One automated integration eliminates it entirely."
