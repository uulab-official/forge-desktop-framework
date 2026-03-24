#!/usr/bin/env python3
"""Forge Desktop Framework — WebRTC Demo Python Worker

Minimal worker with health_check only. WebRTC is handled entirely
in the browser — no Python backend is needed for this demo.

Communicates with Electron main process via stdin/stdout JSON protocol.
All logging goes to stderr to avoid corrupting the protocol.
"""

import json
import sys
import os

# Ensure the worker directory is in the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.protocol import write_ready, write_success, write_error, read_request, log
from core.dispatcher import dispatch, list_actions

# Import actions to register them
import actions  # noqa: F401


def main():
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


if __name__ == "__main__":
    main()
