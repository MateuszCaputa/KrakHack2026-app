"""In-memory process store. Good enough for a hackathon demo."""

from typing import Any


class ProcessStore:
    """Simple dict-backed store for process data."""

    def __init__(self):
        self._data: dict[str, dict[str, Any]] = {}

    def get(self, process_id: str) -> dict[str, Any] | None:
        return self._data.get(process_id)

    def set_status(self, process_id: str, status: str, **extra):
        if process_id not in self._data:
            self._data[process_id] = {}
        self._data[process_id]["status"] = status
        self._data[process_id]["process_id"] = process_id
        self._data[process_id].update(extra)

    def set_pipeline_output(self, process_id: str, output: dict):
        if process_id not in self._data:
            self._data[process_id] = {}
        self._data[process_id]["pipeline_output"] = output
        self._data[process_id]["status"] = "pipeline_complete"

    def set_copilot_output(self, process_id: str, output: dict):
        if process_id not in self._data:
            self._data[process_id] = {}
        self._data[process_id]["copilot_output"] = output
        self._data[process_id]["status"] = "complete"

    def list_all(self) -> list[dict[str, Any]]:
        return [
            {"process_id": pid, "status": data.get("status", "unknown")}
            for pid, data in self._data.items()
        ]
