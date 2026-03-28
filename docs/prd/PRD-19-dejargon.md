# PRD-19: De-Jargon the UI — Plain Language Everywhere

**Owner:** Mateusz
**Est:** 15 min
**Priority:** P0 — mentor said "clearly understandable for judges"

---

## Changes

### Tab names
- "Variants" → "Process Paths"
- "BPMN" → "Workflow Diagram"
- "Live Monitor" → "Live Detection"

### Column headers
- "Freq" → "Occurrences"
- "Ctx Switches" → "App Switches"
- "Copy-Paste" → "Data Transfers"

### Section titles
- "Cross-App Data Transfers" → "Manual Data Transfers Between Apps"
- "Automation Candidates" stat → "RPA-Ready Activities"
- "Top Bottleneck" → "Biggest Delay"
- "Activity Categories" → "Work Categories"
- "Performer Analysis" → "Team Performance"

### Stat card tooltips — translate to business impact
- Copy-paste tooltip: add "equivalent to ~X minutes/day of manual data entry" computed from (total_copy_paste * 5s / 60 / workdays)
- Frequency tooltip: end with "automating saves X hours/month"

### Health score sub-labels
- "Standardization" → "Process Consistency"
- "Bottlenecks" → "Delay Score"
- "Automation" → "Manual Work Load"

### Recommendation types (display labels only)
- "automate" badge → "Automate with RPA"
- "eliminate" → "Remove (waste)"
- "simplify" → "Simplify steps"
- "parallelize" → "Run in parallel"
- "reassign" → "Delegate to system"

### Blueprint section
- "View Blueprint" → "View Implementation Plan"
- "Download All Blueprints" → "Download Implementation Plans"
- "Technology Stack" → "Tools Required"

## Files
- `frontend/src/components/process-tabs.tsx` — tab names, column headers, tooltips
- `frontend/src/components/health-score.tsx` — sub-score labels
- `frontend/src/components/recommendation-card.tsx` — type badges, blueprint labels
- `frontend/src/components/category-breakdown.tsx` — section title
- `frontend/src/components/live-monitor.tsx` — tab label, alert text cleanup
