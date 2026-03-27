"""FastAPI application — glue layer connecting pipeline and copilot modules."""

import uuid
import shutil
from pathlib import Path

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from backend.api.store import ProcessStore

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
    """Upload a CSV event log and trigger process discovery."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")

    process_id = str(uuid.uuid4())[:8]
    file_path = UPLOAD_DIR / f"{process_id}.csv"

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    store.set_status(process_id, "uploaded", file_path=str(file_path))

    # TODO: trigger pipeline processing (will be wired when pipeline module is ready)
    # For now, mark as ready for processing
    store.set_status(process_id, "ready")

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
async def run_pipeline(process_id: str):
    """Trigger pipeline analysis on an uploaded file."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    file_path = entry.get("file_path")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(400, "Upload file not found")

    store.set_status(process_id, "processing")

    # TODO: call pipeline module here
    # from backend.pipeline.run import run_pipeline as execute_pipeline
    # pipeline_output = execute_pipeline(file_path)
    # store.set_pipeline_output(process_id, pipeline_output.model_dump())

    return {"process_id": process_id, "status": "processing"}


@app.post("/api/process/{process_id}/analyze")
async def analyze_process(process_id: str):
    """Run AI copilot analysis on a discovered process."""
    entry = store.get(process_id)
    if not entry:
        raise HTTPException(404, f"Process {process_id} not found")

    if not entry.get("pipeline_output"):
        raise HTTPException(400, "Run pipeline first before analyzing")

    store.set_status(process_id, "analyzing")

    # TODO: call copilot module here
    # from backend.copilot.run import run_copilot
    # copilot_output = run_copilot(entry["pipeline_output"])
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
