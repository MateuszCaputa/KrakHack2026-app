# PRD-7: ROI Calculator

**Owner:** overnight agent
**Est:** 30 min
**Priority:** P0 — business judges remember dollar signs
**Status:** pending

---

## Why

Every hackathon team shows data. Nobody shows money. An ROI calculator turns abstract "automation recommendations" into concrete "you save $8,400/year." This is what sells automation to business stakeholders — and hackathon judges.

## Design

Add a "Savings Estimate" section to the AI Analysis tab (after recommendations), or as its own card above recommendations.

### Inputs (from existing data)
- `recommendations[].estimated_time_saved_seconds` — already computed per recommendation
- `recommendations[].affected_cases_percentage` — already computed
- `pipeline.statistics.total_cases` — case volume
- User-adjustable: `hourly_rate` slider (default $25/hr, range $10-$100)
- User-adjustable: `cases_per_month` input (default: total_cases, editable)

### Computation
For each recommendation:
```
monthly_hours_saved = (estimated_time_saved_seconds * cases_per_month * affected_cases_percentage / 100) / 3600
monthly_cost_saved = monthly_hours_saved * hourly_rate
```

Total across all recommendations:
```
total_monthly_hours = sum of all monthly_hours_saved
total_monthly_cost = sum of all monthly_cost_saved
total_annual_cost = total_monthly_cost * 12
```

### UI
1. **Big summary card** at top of section:
   - "Estimated Annual Savings" in large text
   - Dollar amount in huge font (e.g., "$8,400")
   - Subtitle: "X hours/month recovered across Y automation targets"
2. **Slider controls**: hourly rate + monthly case volume
3. **Per-recommendation breakdown table** below:
   - Target activity | Time saved/case | Monthly hours | Monthly savings

### Styling
- Use green accent for savings numbers (green-400)
- Card with slightly different border (green-800/30) to stand out
- Slider with zinc-700 track, blue-500 thumb

## Files
- `frontend/src/components/process-tabs.tsx` — add section to AI Analysis tab
- OR `frontend/src/components/roi-calculator.tsx` (NEW) — extracted component

## Verification
- AI Analysis tab shows savings section after running analysis
- Adjusting slider updates numbers in real-time
- Numbers are mathematically correct (spot-check one recommendation manually)
- `cd frontend && npm run build` passes
