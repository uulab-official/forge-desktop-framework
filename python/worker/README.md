# Forge Worker Protocol Reference

This directory contains the **framework-level protocol** for communication between the Electron main process and Python workers.

## What's here

- `core/protocol.py` — JSON stdin/stdout protocol (read/write requests, responses, progress)
- `core/dispatcher.py` — Action registry and dispatcher

## What's NOT here

Actions, `main.py`, and `requirements.txt` live inside the **app** (`app/python/worker/`).
This directory is the reference implementation of the protocol only.

## Usage

Apps embed their own copy of the worker with actual actions. See `app/python/worker/` for a working example.
