# __scaffold_test_file_dialogs__79141

Bare minimum app — one input, one Python action

Generated with `create-forge-desktop@0.1.56` using the `minimal` template.

## Release Identity

- Product name: `Scaffold Test File Dialogs 79141`
- App ID: `com.forge.scaffoldtestfiledialogs79141`

## Enabled Feature Packs

- `file-dialogs`

Feature packs currently target the `minimal` starter and are wired into the generated runtime shell.

## Quick Start

```bash
pnpm install
python3 -m pip install -r worker/requirements.txt
pnpm dev
```

If `python3` is not available on your system, use `python -m pip install -r worker/requirements.txt` instead.

## What You Get

- Template: `Minimal`
- Focus: Best for learning the core architecture
- Electron + React renderer
- Vendored Python worker runtime in `worker/forge_worker`
- Vite-based local development
- Release preset with electron-builder and worker packaging scripts
- GitHub Actions validation and tagged release workflows

## Common Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm release:check
pnpm setup:python
pnpm build:worker
pnpm package
```

## Release Checklist

- Verify the app in development mode with `pnpm dev`
- Install any extra Python dependencies into `worker/requirements.txt`
- Prepare the worker environment with `pnpm setup:python`
- Copy `.env.example` to `.env` and fill in release metadata
- Add GitHub Actions secrets before pushing a release tag
- Run `pnpm release:check` to verify release prerequisites
- Build the bundled worker with `pnpm build:worker`
- Package the desktop app with `pnpm package`

Detailed release steps live in `docs/release-playbook.md`.

## Template Notes

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
