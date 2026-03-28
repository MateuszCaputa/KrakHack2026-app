"""FastAPI application — glue layer connecting pipeline and copilot modules."""

import uuid
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Root of the repo — used to locate the local Dataset folder
REPO_ROOT = Path(__file__).parents[2]
load_dotenv(REPO_ROOT / ".env")
LOCAL_DATASET_DIR = REPO_ROOT / "Dataset"

from fastapi import FastAPI, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from backend.api.store import ProcessStore

UPLOAD_DIR = Path(__file__).parent / "storage"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Process Copilot API", version="0.1.0")
store = ProcessStore()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_event_log(file: UploadFile):
    """Upload a CSV event log. Saves it ready for pipeline processing."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")

    process_id = str(uuid.uuid4())[:8]

    # Save to process-specific directory with filename matching pipeline's glob pattern
    process_dir = UPLOAD_DIR / process_id
    process_dir.mkdir(exist_ok=True)

    safe_name = f"Activity Sequence Export - {file.filename}"
    file_path = process_dir / safe_name

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    store.set_status(process_id, "uploaded", file_path=str(file_path), process_dir=str(process_dir))

    return {"process_id": process_id, "status": "ready", "filename": file.filename}


@app.get("/api/processes")
async def list_processes():
    """List all uploaded processes."""
    return {"processes": store.list_all()}


@app.get("/api/process/{process_id}")
async def get_process(process_id: str):
    """Return discovered process (PipelineOutput) for a given process_id."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    if not entry.get("pipeline_output"):
        raise HTTPException(202, detail="Pipeline processing not yet complete")

    return entry["pipeline_output"]


@app.post("/api/process/{process_id}/run-pipeline")
async def run_pipeline_endpoint(process_id: str):
    """Run process mining pipeline on the uploaded file."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    process_dir = entry.get("process_dir")
    if not process_dir or not Path(process_dir).exists():
        raise HTTPException(400, "Upload directory not found — upload a file first")

    store.set_status(process_id, "processing")

    try:
        from backend.pipeline.pipeline import run_pipeline as execute_pipeline
        pipeline_output = execute_pipeline(process_dir, process_id=process_id)
        store.set_pipeline_output(process_id, pipeline_output.model_dump())
        return {"process_id": process_id, "status": "pipeline_complete", "result": pipeline_output.model_dump()}
    except Exception as exc:
        store.set_status(process_id, "error", error=str(exc))
        raise HTTPException(500, f"Pipeline failed: {exc}")


@app.post("/api/process/{process_id}/analyze")
async def analyze_process(process_id: str):
    """Run AI copilot analysis on a discovered process."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    pipeline_output_dict = entry.get("pipeline_output")
    if not pipeline_output_dict:
        raise HTTPException(400, "Run pipeline first before analyzing")

    store.set_status(process_id, "analyzing")

    try:
        from backend.models import PipelineOutput
        from backend.copilot.copilot import run_copilot

        pipeline_output = PipelineOutput.model_validate(pipeline_output_dict)
        copilot_output = run_copilot(pipeline_output)
        store.set_copilot_output(process_id, copilot_output.model_dump())
        return {"process_id": process_id, "status": "complete", "result": copilot_output.model_dump()}
    except Exception as exc:
        store.set_status(process_id, "error", error=str(exc))
        raise HTTPException(500, f"Copilot analysis failed: {exc}")


@app.get("/api/process/{process_id}/copilot")
async def get_copilot_output(process_id: str):
    """Return copilot analysis results."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    if not entry.get("copilot_output"):
        raise HTTPException(202, detail="Copilot analysis not yet complete")

    return entry["copilot_output"]


@app.post("/api/run-local")
async def run_local_dataset(max_files: int = 3):
    """Run full pipeline + copilot on the local Dataset/ folder. No upload needed.

    Use this endpoint in Swagger to test immediately without uploading any files.

    Args:
        max_files: Number of smallest CSV files to load (default 3 for speed).
                   Set to 0 to load all files (slow — 1.6 GB total).

    Returns process_id you can use with the other endpoints.
    """
    if not LOCAL_DATASET_DIR.exists():
        raise HTTPException(
            404,
            f"Dataset folder not found at: {LOCAL_DATASET_DIR}. "
            "Make sure the Dataset/ folder is in the project root.",
        )

    limit = max_files if max_files > 0 else None
    process_id = str(uuid.uuid4())[:8]
    store.set_status(process_id, "processing", process_dir=str(LOCAL_DATASET_DIR))

    try:
        from backend.pipeline.pipeline import run_pipeline as execute_pipeline
        from backend.copilot.copilot import run_copilot

        pipeline_output = execute_pipeline(str(LOCAL_DATASET_DIR), process_id=process_id, max_files=limit)
        store.set_pipeline_output(process_id, pipeline_output.model_dump())

        copilot_output = run_copilot(pipeline_output)
        store.set_copilot_output(process_id, copilot_output.model_dump())

        return {
            "process_id": process_id,
            "status": "complete",
            "summary": copilot_output.summary,
            "recommendations_count": len(copilot_output.recommendations),
            "top_recommendations": [
                {
                    "priority": r.priority,
                    "type": r.type,
                    "target": r.target,
                    "impact": r.impact,
                }
                for r in copilot_output.recommendations[:5]
            ],
            "hint": f"Use process_id='{process_id}' with GET /api/process/{{id}}/copilot for full results",
        }
    except Exception as exc:
        store.set_status(process_id, "error", error=str(exc))
        raise HTTPException(500, f"Analysis failed: {exc}")


@app.get("/api/process/{process_id}/bpmn")
async def get_bpmn(process_id: str):
    """Return generated BPMN XML for a process."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    copilot = entry.get("copilot_output")
    if not copilot or not copilot.get("bpmn_xml"):
        raise HTTPException(202, detail="BPMN not yet generated — run analyze first")

    return Response(content=copilot["bpmn_xml"], media_type="application/xml")


class AskRequest(BaseModel):
    question: str


@app.post("/api/process/{process_id}/ask")
async def ask_process(process_id: str, body: AskRequest):
    """Answer a natural-language question about the process using Gemini."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    pipeline_data = entry.get("pipeline_output")
    if not pipeline_data:
        raise HTTPException(400, "Run pipeline first")

    copilot_data = entry.get("copilot_output")

    # Build context from pipeline + copilot data
    stats = pipeline_data.get("statistics", {})
    activities = pipeline_data.get("activities", [])
    bottlenecks = pipeline_data.get("bottlenecks", [])

    top_activities = sorted(activities, key=lambda a: a.get("frequency", 0), reverse=True)[:10]
    act_lines = [
        f"- {a['name']}: freq={a['frequency']}, avg_dur={a.get('avg_duration_seconds', 0):.1f}s, "
        f"copy_paste={a.get('copy_paste_count', 0)}, apps={a.get('applications', [])}"
        for a in top_activities
    ]

    top_bn = sorted(bottlenecks, key=lambda b: b.get("avg_wait_seconds", 0), reverse=True)[:5]
    bn_lines = [
        f"- {b['from_activity']} → {b['to_activity']}: avg_wait={b.get('avg_wait_seconds', 0):.1f}s, "
        f"severity={b.get('severity', '?')}, cases={b.get('case_count', 0)}"
        for b in top_bn
    ]

    rec_lines = []
    if copilot_data and copilot_data.get("recommendations"):
        for r in copilot_data["recommendations"][:5]:
            rec_lines.append(
                f"- [{r.get('type', '?')}] {r.get('target', '?')}: {r.get('reasoning', '')[:120]}"
            )

    context = (
        f"Process Statistics:\n"
        f"  Cases: {stats.get('total_cases', '?')}, Events: {stats.get('total_events', '?')}, "
        f"Activities: {stats.get('total_activities', '?')}, Variants: {stats.get('total_variants', '?')}\n"
        f"  Users: {stats.get('total_users', '?')}, Apps: {stats.get('total_applications', '?')}\n"
        f"  Avg case duration: {stats.get('avg_case_duration_seconds', 0):.0f}s\n\n"
        f"Top 10 Activities:\n" + "\n".join(act_lines) + "\n\n"
        f"Top 5 Bottlenecks:\n" + "\n".join(bn_lines) + "\n\n"
    )
    if rec_lines:
        context += f"Top 5 Recommendations:\n" + "\n".join(rec_lines) + "\n"

    system_prompt = (
        "You are a sharp process improvement consultant. "
        "You have task mining data from a real company. Use the numbers to be specific, then give expert advice. "
        "Reply with exactly 3 lines separated by a blank line. Each line max 30 words. No headers, no bullet points. "
        "Line 1: What is literally happening — one concrete sentence describing the real-world situation. "
        "Line 2: The single most likely cause. "
        "Line 3: One specific, actionable fix they can start this week. "
        "Write like a consultant talking to a manager over coffee. No technical jargon."
    )

    from backend.copilot.llm import call_llm
    answer = call_llm(
        prompt=f"PROCESS DATA:\n{context}\n\nQUESTION: {body.question}",
        system=system_prompt,
        max_tokens=1024,
    )

    if not answer:
        answer = (
            f"AI query requires Gemini API key. The data shows "
            f"{stats.get('total_activities', '?')} activities across "
            f"{stats.get('total_cases', '?')} cases with "
            f"{stats.get('total_variants', '?')} process variants."
        )

    return {"answer": answer}


REFERENCE_BPMN_PATH = LOCAL_DATASET_DIR / "model (67).bpmn"


@app.get("/api/reference-bpmn")
async def get_reference_bpmn():
    """Return the reference BPMN model from the dataset for comparison."""
    if not REFERENCE_BPMN_PATH.exists():
        raise HTTPException(404, "Reference BPMN model not found in Dataset/")
    return Response(content=REFERENCE_BPMN_PATH.read_text(), media_type="application/xml")
