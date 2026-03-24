# forge-worker-runtime

Python worker runtime for the [Forge Desktop Framework](https://github.com/uulab/forge-desktop-framework).

Provides the core protocol, action dispatcher, and main loop for Python workers that communicate with Electron via stdin/stdout JSON.

## Installation

```bash
# Development (editable install from monorepo root):
pip install -e packages/worker-runtime

# Production (once published):
pip install forge-worker-runtime
```

## Usage

```python
#!/usr/bin/env python3
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import your actions so they register themselves
import actions

# Run the standard worker loop
from forge_worker import run_worker
run_worker()
```

### Defining actions

```python
from forge_worker import register

@register("my_action")
def handle_my_action(payload):
    return {"result": payload.get("input", "").upper()}
```

### Available exports

- `register(action_name)` — decorator to register an action handler
- `dispatch(action, payload)` — dispatch to a registered handler
- `list_actions()` — list all registered action names
- `run_worker()` — run the standard stdin/stdout worker loop
- `write_ready()` — signal worker is ready
- `write_success(data)` — write a success response
- `write_error(message)` — write an error response
- `write_progress(current, total, message)` — write a progress update
- `read_request(stream)` — read a JSON request from stdin
- `log(message)` — write to stderr (safe for protocol)
