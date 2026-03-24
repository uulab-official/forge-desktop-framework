# Forge Minimal Example

The simplest possible Forge Desktop app. Demonstrates the core architecture:

1. **React renderer** — text input + button
2. **Electron main** — bridges IPC between renderer and Python
3. **Python worker** — reverses a string via stdin/stdout JSON

## Quick Start

```bash
pnpm install
pnpm dev
```

## Architecture

```
Renderer (React)
  ↓ ipcRenderer.invoke('worker:execute', { action: 'reverse', payload: { text } })
Electron Main
  ↓ workerClient.execute(request)
Python Worker (stdin/stdout JSON)
  ↓ dispatcher → actions/reverse.py
  ↑ { success: true, data: { reversed: "..." } }
```

## Adding a New Action

1. Create `worker/actions/my_action.py`
2. Use the `@register("my_action")` decorator
3. Import it in `worker/actions/__init__.py`
4. Call from renderer: `window.api.execute({ action: 'my_action', payload: {...} })`
