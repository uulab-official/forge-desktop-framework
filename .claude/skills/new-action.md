---
name: new-action
description: Add a new Python worker action to the framework or an example
user_invocable: true
---

# New Action Skill

Create a new Python worker action with the standard pattern.

## Usage
The user will say "/new-action <name>" (e.g., "/new-action resize_image")

## Steps

1. Parse the action name from args
2. Ask the user what the action should do (what input/output)
3. Create `worker/actions/<name>.py` with:
   - Module docstring
   - Import from forge_worker (`from forge_worker import register`)
   - @register("<name>") decorated handler function
   - Type hints for payload and return
4. Update `worker/actions/__init__.py` to import the new action
5. Test it: `echo '{"action":"<name>","payload":{}}' | python3 worker/main.py`
6. Report success with usage example
