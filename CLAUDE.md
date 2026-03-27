# Process-to-Automation Copilot - KrakHack 2026

## What This Is

AI copilot that analyzes **Task Mining data from KYP.ai** — recordings of what employees actually do at their computers (clicks, keystrokes, app switches). The copilot discovers real process flows, identifies bottlenecks and manual waste, recommends automation targets (RPA, integrations), and generates BPMN workflow definitions.

## Data Reality

The dataset is **Task Mining, NOT traditional process mining**. Key differences:
- Raw data = individual user interactions (mouse, keyboard), not business events
- `Business ID` is often `NOT_FOUND` — cases must be inferred from user sessions
- Files are HUGE (up to 163MB each, 1.6GB total) — always use chunked reading
- `Process step` column = the meaningful grouping level, not individual interactions
- A reference BPMN model is provided for comparison
- The dataset is in `Process-to-Automation Copilot Challenge/Dataset/` (gitignored, NEVER commit)

## Architecture

```
frontend/          → Next.js + shadcn/ui + Tailwind (demo UI)
backend/
  pipeline/        → Python: data ingestion, process mining (pm4py), discovery
  copilot/         → Python: AI agent reasoning, BPMN generation, recommendations
  api/             → Python FastAPI: glue layer connecting pipeline + copilot + frontend
contracts/         → JSON schemas defining module interfaces
data/              → Sample event log CSVs
```

## Module Ownership (HARD RULE)

| Module | Owner | Scope |
|--------|-------|-------|
| `backend/pipeline/` | pipeline-owner | Task Mining data ingestion, session construction, process discovery, bottleneck detection |
| `backend/copilot/` | copilot-owner | AI reasoning, RPA/automation recommendations, BPMN generation, reference model comparison |
| `frontend/` + `backend/api/` | mateusz | UI, API glue, integration |
| `contracts/` | consensus | Changed only when all agree |

**NEVER modify files outside your module.** No exceptions during active hours. If another module blocks you, mock its output using the contract schema and notify on Discord.

**Emergency cross-module fix (overnight only):** Branch `hotfix/<module>-<description>`, minimal change, leave for review. Never merge directly.

## Git Workflow

### Branches
- `main` — stable, always works
- `feat/<module>-<what>` — feature work (e.g. `feat/pipeline-variant-analysis`)
- `fix/<module>-<what>` — bug fixes
- `hotfix/<module>-<what>` — emergency cross-module fix (overnight only)
- `overnight/<module>` — autonomous agent work branches

Keep branch names short. Lowercase, hyphens only.

### Commits

Conventional commits. Short, imperative, no period.

```
<type>(<scope>): <what>
```

**Types:** `feat`, `fix`, `test`, `refactor`, `chore`, `docs`
**Scopes:** `pipeline`, `copilot`, `frontend`, `api`, `contracts`

Examples:
```
feat(pipeline): add variant analysis with pm4py
fix(copilot): handle empty activity list in bpmn gen
test(pipeline): cover bottleneck detection edge cases
refactor(api): extract upload validation to util
chore(frontend): install bpmn-js dependency
```

No person names. The scope identifies the owner. Git blame handles attribution.

### Merge Strategy
- Merge to `main` via fast-forward or squash
- Never force push to `main`
- Overnight branches get reviewed before merge — cherry-pick good work, discard junk

## Tech Stack

### Backend (Python 3.12+)
- **FastAPI** — API layer, async endpoints
- **pm4py** — process mining (discovery, conformance, variant analysis)
- **networkx** — graph analysis (centrality, paths, bottleneck detection)
- **plotly** — server-side chart generation (return as JSON to frontend)
- **scikit-learn** — ML (clustering, classification if needed)
- **pydantic** — data validation, contract enforcement
- **httpx** — async HTTP client
- **pytest** — testing

### Frontend (Node 20+)
- **Next.js 15** (App Router, Server Components default)
- **shadcn/ui** + **Tailwind CSS** — UI components and styling
- **Recharts** or **Plotly.js** — charts and process visualization
- **bpmn-js** — BPMN diagram rendering
- **TypeScript** — strict mode

## Code Quality Standards

### Python

Every function follows this pattern:
```python
def discover_variants(event_log: EventLog) -> list[ProcessVariant]:
    """Discover unique process variants from an event log."""
    ...
```

- **Type hints on every function** — parameters and return types, no exceptions
- **Pydantic models for all data structures** — never pass raw dicts between functions
- **Single responsibility** — one function does one thing, name describes what
- **Flat over nested** — return early, avoid deep indentation
- **Meaningful names** — `calculate_bottleneck_severity` not `calc_bn` or `process_data`
- **No magic numbers** — use named constants: `MAX_VARIANTS = 50`
- **Error handling at boundaries only** — validate input at API layer, trust internal code
- **Imports grouped** — stdlib, third-party, local. Absolute imports only.

File structure per module:
```python
# backend/pipeline/discovery.py

"""Process discovery using pm4py alpha miner and heuristics."""

from pydantic import BaseModel

class ProcessVariant(BaseModel):
    variant_id: int
    sequence: list[str]
    case_count: int
    percentage: float

def discover_variants(event_log: EventLog) -> list[ProcessVariant]:
    ...
```

- One concept per file. `discovery.py`, `bottleneck.py`, `variant_analysis.py` — not `utils.py` or `helpers.py`.
- If a file grows past ~150 lines, split it.
- Tests mirror source structure: `discovery.py` → `tests/test_discovery.py`

### TypeScript/React

```tsx
// Naming: PascalCase components, camelCase functions, UPPER_SNAKE constants
// Files: kebab-case (process-map.tsx, upload-form.tsx)

interface ProcessMapProps {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  onNodeClick: (nodeId: string) => void;
}

export function ProcessMap({ nodes, edges, onNodeClick }: ProcessMapProps) {
  // ...
}
```

- **Server Components by default** — add `'use client'` only for interactivity
- **Props interfaces co-located** — defined in same file, above component
- **No `any`** — use `unknown` + type guards if type is truly unknown
- **Composition over props drilling** — use children, slots, compound components
- **One component per file** — small helpers co-located are fine
- **Name files after the component** — `process-map.tsx` exports `ProcessMap`

### General Principles

- **Modularity** — each file/function has a single clear purpose
- **Readability** — code reads like prose, top to bottom, no jumping around
- **Explicit over implicit** — name things clearly, avoid abbreviations
- **DRY within modules, duplicate across modules** — never import from another person's module to share code. Copy if needed.
- **No dead code** — delete unused functions, imports, variables immediately
- **No TODO comments in main** — either do it now or create a GitHub Issue

## Contracts

Modules communicate through JSON schemas in `contracts/`. Every module's input/output is a Pydantic model that matches these schemas.

- `pipeline_output.json` → What `backend/pipeline/` produces
- `copilot_input.json` → What `backend/copilot/` expects (refs pipeline_output)
- `copilot_output.json` → What `backend/copilot/` produces

**Development flow:** Mock the input contract, build against it, integrate later.

## API Endpoints

```
POST /api/upload          → Upload event log CSV, returns { process_id }
GET  /api/process/{id}    → Returns PipelineOutput (discovered process)
POST /api/analyze/{id}    → Triggers AI analysis, returns CopilotOutput
GET  /api/bpmn/{id}       → Returns raw BPMN XML string
GET  /api/health          → Returns { status: "ok" }
```

All endpoints return JSON. Errors return `{ "error": "message" }` with appropriate HTTP status.

## Testing

- Each module: `pytest backend/<module>/tests/ -x`
- Use `data/sample_*.csv` as test fixtures
- Test the contract: assert output matches Pydantic model
- Test edge cases: empty logs, single-activity processes, missing timestamps
- Frontend: no automated tests — verify visually via dev server
- **Never commit code that breaks existing tests.** Run `pytest -x` before every commit. If tests fail, fix them first.

## Demo Scope (DO NOT EXCEED)

1. Upload CSV event log → instant process map visualization
2. Click "Analyze" → AI highlights bottlenecks with explanations
3. Click "Recommend" → AI suggests automation targets with reasoning
4. Click "Generate BPMN" → downloadable BPMN XML + visual preview

**This is the entire product. Do not add features beyond this.**

## Overnight Agent Rules

When running autonomously (ralph loops):

1. Work on `overnight/<topic>` branch in a dedicated git worktree
2. You may touch ANY file across any module — the branch is your sandbox
3. Run relevant tests after every change (`pytest -x` for Python, `npm run build` for frontend)
4. If tests fail 3 times on the same issue → stop, leave TODO, move to next issue
5. Small focused commits: one logical change per commit
6. **Never merge to `main`** — all overnight work is reviewed in the morning
7. Pick up GitHub Issues in priority order (P0 first)
8. When an issue is done, commit with `closes #<number>` in the message
