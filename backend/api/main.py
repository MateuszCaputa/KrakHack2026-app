"""FastAPI application — glue layer connecting pipeline and copilot modules."""

import uuid
import shutil
from pathlib import Path

# Root of the repo — used to locate the local Dataset folder
REPO_ROOT = Path(__file__).parents[2]
LOCAL_DATASET_DIR = REPO_ROOT / "Dataset"

from fastapi import FastAPI, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

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
async def run_local_dataset():
    """Run full pipeline + copilot on the local Dataset/ folder. No upload needed.

    Use this endpoint in Swagger to test immediately without uploading any files.
    Returns process_id you can use with the other endpoints.
    """
    if not LOCAL_DATASET_DIR.exists():
        raise HTTPException(
            404,
            f"Dataset folder not found at: {LOCAL_DATASET_DIR}. "
            "Make sure the Dataset/ folder is in the project root.",
        )

    process_id = str(uuid.uuid4())[:8]
    store.set_status(process_id, "processing", process_dir=str(LOCAL_DATASET_DIR))

    try:
        from backend.pipeline.pipeline import run_pipeline as execute_pipeline
        from backend.copilot.copilot import run_copilot

        pipeline_output = execute_pipeline(str(LOCAL_DATASET_DIR), process_id=process_id)
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
