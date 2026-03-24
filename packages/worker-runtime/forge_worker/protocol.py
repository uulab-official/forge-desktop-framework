"""JSON protocol for stdin/stdout communication with Electron main process.

IMPORTANT: All debug/log output MUST go to stderr.
stdout is EXCLUSIVELY for the JSON protocol.
"""

import sys
import json
from typing import Any


def write_response(data: dict[str, Any]) -> None:
    """Write a JSON response to stdout."""
    print(json.dumps(data, ensure_ascii=False), flush=True)


def write_success(data: dict[str, Any] | None = None) -> None:
    """Write a success response."""
    write_response({"success": True, "data": data, "error": None})


def write_error(message: str) -> None:
    """Write an error response."""
    write_response({"success": False, "data": None, "error": message})


def write_progress(current: int, total: int, message: str | None = None) -> None:
    """Write a progress update."""
    payload: dict[str, Any] = {
        "progress": {"current": current, "total": total}
    }
    if message:
        payload["progress"]["message"] = message
    write_response(payload)


def write_ready() -> None:
    """Signal that the worker is ready to receive requests."""
    write_response({"ready": True})


def read_request(stream=None) -> dict[str, Any]:
    """Read a single JSON request from stdin."""
    if stream is None:
        stream = sys.stdin

    line = stream.readline()
    if not line:
        raise EOFError("stdin closed")

    return json.loads(line.strip())


def log(message: str) -> None:
    """Write a log message to stderr (not stdout!)."""
    print(f"[worker] {message}", file=sys.stderr, flush=True)
