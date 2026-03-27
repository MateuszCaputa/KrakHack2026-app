"""FastAPI application — glue layer connecting pipeline and copilot modules."""

import uuid
import shutil
from pathlib import Path

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from backend.api.store import ProcessStore
from backend.pipeline.pipeline import run_pipeline as execute_pipeline

UPLOAD_DIR = Path(__file__).parent / "storage"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Process Copilot API", version="0.1.0")
store = ProcessStore()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_event_log(file: UploadFile):
    """Upload a CSV event log. File must be an Activity Sequence Export CSV."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")

    process_id = str(uuid.uuid4())[:8]

    # Pipeline expects a directory of CSVs — create one per upload
    process_dir = UPLOAD_DIR / process_id
    process_dir.mkdir(exist_ok=True)

    # Save with original-ish name so pipeline glob picks it up
    dest = process_dir / f"Activity Sequence Export - {file.filename}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    store.set_status(process_id, "uploaded", file_path=str(process_dir))

    return {"process_id": process_id, "status": "uploaded", "filename": file.filename}


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
        return {"process_id": process_id, "status": entry.get("status", "uploaded"), "pipeline_output": None}

    return entry["pipeline_output"]


@app.post("/api/process/{process_id}/run-pipeline")
async def run_pipeline_endpoint(process_id: str):
    """Trigger pipeline analysis on uploaded files."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    file_path = entry.get("file_path")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(400, "Upload directory not found")

    store.set_status(process_id, "processing")

    try:
        pipeline_output = execute_pipeline(file_path, process_id=process_id)
        store.set_pipeline_output(process_id, pipeline_output.model_dump())
        return {"process_id": process_id, "status": "pipeline_complete"}
    except Exception as e:
        store.set_status(process_id, "error")
        raise HTTPException(500, f"Pipeline failed: {str(e)}")


@app.post("/api/process/{process_id}/analyze")
async def analyze_process(process_id: str):
    """Run AI copilot analysis on a discovered process."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    if not entry.get("pipeline_output"):
        raise HTTPException(400, "Run pipeline first before analyzing")

    store.set_status(process_id, "analyzing")

    # TODO: wire copilot module when ready
    # from backend.copilot.run import run_copilot
    # copilot_output = run_copilot(PipelineOutput.model_validate(entry["pipeline_output"]))
    # store.set_copilot_output(process_id, copilot_output.model_dump())

    return {"process_id": process_id, "status": "analyzing"}


@app.get("/api/process/{process_id}/copilot")
async def get_copilot_output(process_id: str):
    """Return copilot analysis results."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    if not entry.get("copilot_output"):
        raise HTTPException(202, detail="Copilot analysis not yet complete")

    return entry["copilot_output"]


@app.get("/api/process/{process_id}/bpmn")
async def get_bpmn(process_id: str):
    """Return generated BPMN XML for a process."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    copilot = entry.get("copilot_output")
    if not copilot or not copilot.get("bpmn_xml"):
        raise HTTPException(202, detail="BPMN not yet generated")

    return Response(content=copilot["bpmn_xml"], media_type="application/xml")
