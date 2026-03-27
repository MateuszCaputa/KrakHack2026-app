# Setup Guide — KrakHack 2026

## Prerequisites

You need these installed. If you don't have them, install them first.

- **Python 3.12+**: `python3 --version` (install via brew: `brew install python@3.12`)
- **Node.js 20+**: `node --version` (install via brew: `brew install node`)
- **Git**: `git --version`
- **Claude Code CLI**: `claude --version` (install: `npm install -g @anthropic-ai/claude-code`)

## 1. Clone and Install (2 min)

```bash
git clone <REPO_URL>
cd hackathon-app

# Python backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Frontend
cd frontend
npm install
cd ..
```

## 2. Configure Claude Code (1 min)

Paste these one at a time in your terminal:

```bash
# Set model to Sonnet (conserves your Pro token budget)
claude config set model claude-sonnet-4-6

# Set effort to medium
claude config set effort medium
```

Then start Claude Code:
```bash
claude
```

Inside Claude Code, type:
```
/permissions
```

Set tool permissions to allow all — you don't want confirmation dialogs slowing you down during the hackathon. Approve everything.

## 3. Verify Everything Works

```bash
# In project root, with venv activated
pytest backend/ -x --tb=short

# Frontend
cd frontend && npm run dev
# Should open on http://localhost:3000
```

## 4. Your Module

Check `CLAUDE.md` for which module you own. You work ONLY in your directory during active hours.

| Module | Directory | What You Build |
|--------|-----------|----------------|
| pipeline | `backend/pipeline/` | Event log parsing, process mining with pm4py, variant analysis, bottleneck detection |
| copilot | `backend/copilot/` | AI agent that analyzes pipeline output, recommends automation, generates BPMN XML |
| frontend + api | `frontend/` + `backend/api/` | Demo UI and FastAPI glue layer (Mateusz only) |

## 5. Development Workflow

```bash
# Start Claude Code in your module directory
cd backend/pipeline  # or backend/copilot
claude

# Tell Claude what to build — it reads CLAUDE.md automatically
# Example prompt: "Read the CLAUDE.md, look at the contracts, and implement variant analysis"
```

### Git workflow

```bash
# Create your feature branch
git checkout -b feat/pipeline-variant-analysis

# Work, commit often
git add backend/pipeline/
git commit -m "feat(pipeline): add variant analysis with pm4py"

# Push and merge when ready
git push origin feat/pipeline-variant-analysis
# Merge to main via GitHub or CLI when tests pass
```

### Running tests

```bash
pytest backend/pipeline/tests/ -x    # pipeline module
pytest backend/copilot/tests/ -x     # copilot module
pytest backend/ -x                   # everything
```

## 6. Communication

- **Discord** for coordination
- Say "pipeline" or "copilot" to refer to modules/owners
- If you need something from another module, mock it using the contract JSON schema and post in Discord
- Never modify files outside your module

## Quick Reference

| Command | What |
|---------|------|
| `source .venv/bin/activate` | Activate Python env |
| `pytest backend/<module>/tests/ -x` | Run your tests |
| `cd frontend && npm run dev` | Start frontend |
| `uvicorn backend.api.main:app --reload` | Start API server |
| `claude` | Start Claude Code |
