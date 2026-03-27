"""FastAPI application — glue layer connecting pipeline and copilot modules."""

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Process Copilot API", version="0.1.0")

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
    # TODO: implement — save file, run pipeline, return process_id
    return {"process_id": "stub", "message": "not yet implemented"}


@app.get("/api/process/{process_id}")
async def get_process(process_id: str):
    """Return discovered process (PipelineOutput) for a given process_id."""
    # TODO: implement — return pipeline output from storage
    return {"error": "not yet implemented"}


@app.post("/api/analyze/{process_id}")
async def analyze_process(process_id: str):
    """Run AI copilot analysis on a discovered process."""
    # TODO: implement — call copilot module, return CopilotOutput
    return {"error": "not yet implemented"}


@app.get("/api/bpmn/{process_id}")
async def get_bpmn(process_id: str):
    """Return generated BPMN XML for a process."""
    # TODO: implement — return BPMN XML string
    return {"error": "not yet implemented"}
