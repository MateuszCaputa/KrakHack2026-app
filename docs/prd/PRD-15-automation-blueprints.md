# PRD-15: Automation Blueprints (Generated Implementation Specs)

**Owner:** overnight agent
**Est:** 35 min
**Priority:** P0 — THIS is the closer. Everyone recommends. Nobody delivers.
**Status:** pending

---

## Why

Every team will say "automate this step." We'll say "here's the automation blueprint — download it." This is the difference between a consultant who writes reports and a consultant who writes code. The PDF evaluation criteria specifically mentions "generated artifacts" and "process representation ready for further use."

Each recommendation gets a generated "blueprint" — a structured spec that could be handed to an RPA developer or fed into an automation platform.

## Design

### Per-Recommendation Blueprint

For each recommendation, generate a JSON/YAML automation spec using Gemini (or rule-based template fallback):

```json
{
  "blueprint_id": "AUTO-001",
  "name": "Automate Chrome-to-Outlook Data Transfer",
  "target_activity": "Use Outlook Application",
  "automation_type": "RPA Bot",
  "trigger": {
    "type": "activity_start",
    "condition": "User opens Outlook after copying from Chrome"
  },
  "steps": [
    {"action": "monitor_clipboard", "app": "Chrome", "description": "Detect copy operation"},
    {"action": "switch_app", "target": "Outlook", "description": "Auto-focus target application"},
    {"action": "paste_data", "field": "email_body", "description": "Paste copied content"},
    {"action": "validate", "check": "content_matches_source", "description": "Verify data integrity"}
  ],
  "estimated_development_hours": 8,
  "estimated_monthly_roi_hours": 12.5,
  "technology_stack": ["UiPath", "Python selenium", "Windows automation API"],
  "complexity": "medium",
  "prerequisites": ["Application access credentials", "Clipboard monitoring permissions"]
}
```

### Backend

**File:** `backend/copilot/blueprints.py` (NEW)

Function `generate_blueprints(recommendations, pipeline_output) -> list[AutomationBlueprint]`:
1. For each recommendation, build context about the activity (apps used, copy-paste count, duration, performers)
2. Send to Gemini: "Generate an automation blueprint for this activity. Include specific trigger conditions, automation steps, technology recommendations, and estimated development effort."
3. Parse response into structured Blueprint model
4. Fallback: rule-based template if no API key

**File:** `backend/models.py` — add:
```python
class AutomationStep(BaseModel):
    action: str
    description: str
    target_app: str | None = None

class AutomationBlueprint(BaseModel):
    blueprint_id: str
    name: str
    target_activity: str
    automation_type: str
    trigger_description: str
    steps: list[AutomationStep]
    technology_stack: list[str]
    complexity: str  # low, medium, high
    estimated_dev_hours: float
    prerequisites: list[str] = []
```

Add to CopilotOutput: `blueprints: list[AutomationBlueprint] = []`

### Frontend

Add expandable "Blueprint" section to each RecommendationCard:
- Collapsed by default, "View Blueprint" button
- On expand: show steps as a numbered list, tech stack as tags, complexity badge
- "Download Blueprint" button → downloads as JSON file

Also add a "Download All Blueprints" button at the top of recommendations that exports all as a single JSON file.

### Wire into copilot

**File:** `backend/copilot/copilot.py`
After generating recommendations, call `generate_blueprints()` and attach to CopilotOutput.

## Files
- `backend/copilot/blueprints.py` (NEW) — blueprint generation
- `backend/models.py` — add Blueprint models
- `backend/copilot/copilot.py` — wire blueprint generation
- `frontend/src/lib/types.ts` — add TypeScript interfaces
- `frontend/src/components/recommendation-card.tsx` — add expandable blueprint section
- `frontend/src/components/process-tabs.tsx` — add "Download All" button

## Verification
- Run AI Analysis → recommendations now have blueprint data
- Click "View Blueprint" on a recommendation → see steps and tech stack
- "Download Blueprint" produces valid JSON
- Works without API key (template-based fallback)
- `cd frontend && npm run build` passes

## Demo Script Line
"And here's what no other tool gives you — for each recommendation, we generate a concrete automation blueprint. This isn't just 'you should automate this.' It's 'here's the trigger, here are the steps, here's the tech stack, and it'll take about 8 dev-hours to build. Download it as JSON and hand it to your RPA team.'"
