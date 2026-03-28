# PRD-5: BPMN Improvements (Kacper)

**Owner:** Kacper (copilot module)
**Est:** 45 min
**Priority:** P1 — PDF specifically asks for BPMN with gateways and executable representation
**Status:** pending — communicate to Kacper

---

## Why

Both Claude assessments flag the BPMN as the weakest point:
- PDF says: "BPMN powinien zawierać bramki" (BPMN should contain gateways)
- PDF says: "uporządkowana reprezentacja procesu gotowa do dalszego wykorzystania" (ordered process representation ready for further use)
- Current BPMN is a flat linear sequence — no XOR/AND gateways, no branching
- "AI Generated" badge shows even without LLM

## Requirements to Communicate

### 5A. Add XOR gateways (highest impact)

Where the top variant's path diverges from alternatives, add diamond XOR gateway nodes. Even 1-2 gateways (e.g., after "Browsing in Chrome" → gateway → branch to "Use Teams" or "Use Outlook") transforms it from a flat sequence into a real process diagram.

**Implementation hint:** Compare top 3 variants. Find the first point where they diverge. Insert an exclusive gateway there with outgoing branches.

### 5B. Add metrics to task elements

Annotate BPMN tasks with:
- Copy-paste count (from activity data)
- Average duration
- Frequency count

These can be shown as BPMN text annotations or within the task labels.

### 5C. Set isExecutable="true"

On the `<bpmn:process>` element, add `isExecutable="true"`. The PDF specifically mentions the output should be "gotowa do wdrożenia" (ready for implementation). This is a single attribute change.

### 5D. Fix "AI Generated" badge

Either:
- Change to "Generated Workflow" (always truthful)
- Or make conditional: only show "AI-Enhanced" when Gemini API key was used

## Not Required

- Full BPMN 2.0 compliance with all symbols — hackathon, not certification
- Parallel gateways (AND) — XOR is sufficient for demo
- Executable process definitions with data mappings — just the flag

## Verification

- BPMN diagram shows at least 1 diamond gateway node
- Tasks show metrics (duration, copy-paste)
- XML has `isExecutable="true"` on process element
- Badge text is accurate
