"""API endpoint tests."""

import io
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)

SAMPLE_CSV = Path(__file__).parents[3] / "data" / "sample_event_log.csv"


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_upload_csv():
    with open(SAMPLE_CSV, "rb") as f:
        resp = client.post("/api/upload", files={"file": ("test.csv", f, "text/csv")})
    assert resp.status_code == 200
    data = resp.json()
    assert "process_id" in data
    assert data["status"] == "ready"


def test_upload_rejects_non_csv():
    fake = io.BytesIO(b"not a csv")
    resp = client.post("/api/upload", files={"file": ("test.txt", fake, "text/plain")})
    assert resp.status_code == 400


def test_list_processes_after_upload():
    with open(SAMPLE_CSV, "rb") as f:
        client.post("/api/upload", files={"file": ("test.csv", f, "text/csv")})
    resp = client.get("/api/processes")
    assert resp.status_code == 200
    assert len(resp.json()["processes"]) > 0


def test_get_process_not_found():
    resp = client.get("/api/process/nonexistent")
    assert resp.status_code == 404
