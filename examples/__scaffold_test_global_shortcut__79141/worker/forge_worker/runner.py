"""Standard worker main loop. Import and call run_worker() after importing your actions."""

import json
import sys
from .protocol import write_ready, write_success, write_error, read_request, log
from .dispatcher import dispatch, list_actions


def run_worker():
    """Run the standard worker loop. Call this after importing all action modules."""
    log(f"Worker starting (Python {sys.version})")
    log(f"Registered actions: {list_actions()}")
    write_ready()

    while True:
        try:
            request = read_request()
        except EOFError:
            log("stdin closed, shutting down")
            break
        except json.JSONDecodeError as e:
            write_error(f"Invalid JSON: {e}")
            continue

        action = request.get("action")
        payload = request.get("payload", {})
        log(f"Received action: {action}")

        if not action:
            write_error("Missing 'action' field in request")
            continue

        try:
            result = dispatch(action, payload)
            write_success(result)
        except ValueError as e:
            write_error(str(e))
        except Exception as e:
            log(f"Error in action '{action}': {e}")
            write_error(f"Action '{action}' failed: {e}")
