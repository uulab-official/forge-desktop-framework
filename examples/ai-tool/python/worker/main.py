#!/usr/bin/env python3
"""AI Tool example — Python worker with sentiment, summarize, and classify actions."""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.protocol import write_ready, write_success, write_error, read_request, log
from core.dispatcher import dispatch
import actions  # noqa: F401


def main():
    log("AI Tool worker starting")
    write_ready()

    while True:
        try:
            request = read_request()
        except EOFError:
            break
        except json.JSONDecodeError as e:
            write_error(f"Invalid JSON: {e}")
            continue

        action = request.get("action")
        payload = request.get("payload", {})

        try:
            result = dispatch(action, payload)
            write_success(result)
        except Exception as e:
            write_error(str(e))


if __name__ == "__main__":
    main()
