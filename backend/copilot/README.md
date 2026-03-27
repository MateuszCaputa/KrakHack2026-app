# Copilot Module

**Owner:** copilot-owner
**Purpose:** AI agent that analyzes PipelineOutput, recommends automation targets (especially RPA opportunities), and generates BPMN workflow definitions.

## Context

The data comes from **Task Mining** — recording what employees actually do at their computers. The copilot's job is to:
1. Understand the discovered process
2. Compare it against the reference BPMN model (provided in dataset)
3. Find steps that are repetitive, manual, or wasteful
4. Recommend which steps to automate (RPA, API integration, workflow rules)
5. Generate an optimized BPMN definition

## What To Build (Priority Order)

### P0 — Must have for demo
1. **Process Analyzer** — Takes PipelineOutput, generates a natural language summary: what the process does, key steps, how many users/variants. File: `analyzer.py`
2. **Automation Recommender** — The core value. Analyzes process steps for:
   - High copy-paste counts → RPA candidate
   - Repetitive app switching → integration candidate
   - Long passive time → waiting/bottleneck
   - Manual data entry → form automation candidate
   Each recommendation: type, target step, reasoning, impact, priority. File: `recommender.py`
3. **BPMN Generator** — Generate valid BPMN 2.0 XML from the discovered process. Use the reference BPMN (`model (67).bpmn` in the dataset) as a template for structure/format. File: `bpmn_generator.py`
4. **Reference Comparison** — Compare discovered process against the provided reference BPMN. Highlight deviations, missing steps, extra steps. File: `comparison.py`

### P1 — Nice to have
5. **Bottleneck Explainer** — Takes bottleneck data, explains WHY each matters. File: `explainer.py`
6. **Decision Rules** — Extract decision points and generate IF/THEN rules. File: `decision_rules.py`

### P2 — Stretch goals
7. **Cost Estimation** — Estimate time saved per recommendation based on actual duration data. File: `cost_analysis.py`
8. **Process Variables** — Identify variables for the workflow engine. File: `variables.py`

## Input

- `PipelineOutput` from `backend/models.py` — mock it during dev
- Reference BPMN: `Process-to-Automation Copilot Challenge/Dataset/model (67).bpmn`

## Output

`CopilotOutput` from `backend/models.py`. See `contracts/copilot_output.json`.

## LLM Integration

We will determine the exact LLM provider when ready. Design functions with a clean interface:

```python
async def analyze_process(pipeline_output: PipelineOutput, prompt: str) -> str:
    """Send analysis prompt to LLM, return response."""
    ...
```

For now, mock LLM calls in development. Structure prompts clearly — the LLM will receive structured data about the process and return analysis.

## Key Libraries
- `pydantic` — data models
- `xml.etree.ElementTree` — BPMN XML parsing and generation
- LLM client (TBD — likely google-generativeai for free Gemini API)

## Testing
- `pytest backend/copilot/tests/ -x`
- Mock LLM calls in tests
- Test BPMN output is valid XML with correct BPMN 2.0 namespace
- Test recommendations cover different automation types
- Test reference comparison against the provided model (67).bpmn
