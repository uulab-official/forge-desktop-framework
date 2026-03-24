# Architecture

## Design Philosophy

### 1. UI and Engine are separate programs

The Electron app (UI) and Python worker (engine) are independent processes. They communicate via JSON over stdin/stdout. Neither knows the other's implementation details.

This means:
- You can test the Python worker without Electron: `echo '{"action":"..."}' | python3 main.py`
- You can swap the Python engine for Rust, Go, or anything that reads stdin and writes stdout
- Crashes in Python don't crash the app

### 2. Packages are the framework, apps are the product

```
packages/     ← Framework (shared, reusable)
apps/         ← Product (specific to your app)
examples/     ← Reference implementations
```

Packages never import from apps. Apps import from packages. Examples are standalone apps that demonstrate patterns.

### 3. Convention over configuration

- Python actions use `@register("name")` — no config files
- IPC channels are constants in `@forge/ipc-contract` — no magic strings
- Resources resolve automatically in dev and prod — no path hacking

## Layer Diagram

```
┌──────────────────────────────────────────────────┐
│                                                    │
│  Renderer Process (Vite + React)                   │
│  ┌──────────┐  ┌────────┐  ┌──────────────┐      │
│  │  Pages    │  │ Widgets │  │ @forge/ui-kit │     │
│  └────┬─────┘  └───┬────┘  └──────────────┘      │
│       └─────────────┤                              │
│                     │  window.electronAPI           │
│                     │  (contextBridge)              │
├─────────────────────┼──────────────────────────────┤
│                     │                              │
│  Main Process       │  (Node.js)                   │
│  ┌──────────────────┼────────────────────────────┐ │
│  │                  │                            │ │
│  │  ┌───────────────┴──────────────┐             │ │
│  │  │      IPC Handlers            │             │ │
│  │  │  (ipcMain.handle)            │             │ │
│  │  └───────────┬──────────────────┘             │ │
│  │              │                                │ │
│  │  ┌───────────┴──────┐  ┌──────────────────┐   │ │
│  │  │  @forge/          │  │  @forge/          │  │ │
│  │  │  worker-client    │  │  job-engine       │  │ │
│  │  │  (spawn Python)   │  │  (queue + state)  │  │ │
│  │  └───────────┬──────┘  └──────────────────┘   │ │
│  │              │                                │ │
│  │  ┌───────────┴────────────────────────────┐   │ │
│  │  │  @forge/resource-manager               │   │ │
│  │  │  @forge/settings-core                  │   │ │
│  │  │  @forge/project-core                   │   │ │
│  │  │  @forge/logger                         │   │ │
│  │  │  @forge/error-handler                  │   │ │
│  │  │  @forge/plugin-system                  │   │ │
│  │  └────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────┘ │
├────────────────────┬───────────────────────────────┤
│                    │  stdin/stdout JSON             │
│  Python Worker     │  (child_process.spawn)         │
│  ┌─────────────────┼───────────────────────────┐   │
│  │                 │                           │   │
│  │  forge_worker   │  (pip: forge-worker-runtime) │
│  │  ┌─────────────┐│                           │   │
│  │  │ protocol.py ││  read stdin → parse JSON  │   │
│  │  │ dispatcher  ││  dispatch → action handler│   │
│  │  │ runner.py   ││  write JSON → stdout      │   │
│  │  └─────────────┘│                           │   │
│  │                 │                           │   │
│  │  actions/       │  Your domain logic        │   │
│  │  ├─ health_check.py                        │   │
│  │  ├─ echo.py                                │   │
│  │  └─ your_action.py                         │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

## Package Dependency Graph

```
                    @forge/logger
                    (no deps)
                        │
          ┌─────────────┼─────────────────┐
          │             │                 │
    @forge/ipc-contract │           @forge/ui-kit
    (no deps)           │           (peer: react)
          │             │                 │
    ┌─────┼─────┐       │                 │
    │     │     │       │                 │
settings resource project │                 │
 -core  -manager  -core  │                 │
    │     │              │                 │
    │     └──────┐       │                 │
    │            │       │                 │
    │     @forge/worker-client             │
    │            │                         │
    │     @forge/job-engine                │
    │            │                         │
    └────────────┼─────────────────────────┘
                 │
           @forge/app
        (consumes everything)
```

## Package Reference

### Core (always needed)

| Package | Purpose |
|---------|---------|
| `@forge/ipc-contract` | TypeScript types for all IPC messages. `WorkerRequest`, `WorkerResponse`, `JobDefinition`, `IPC_CHANNELS` constants. Single source of truth. |
| `@forge/worker-client` | Spawns Python process, writes JSON to stdin, reads JSON from stdout. Handles timeout, cancellation, stderr capture. |
| `@forge/logger` | `createLogger('source')` → `{ debug, info, warn, error }`. In-memory history + event emitter for LogConsole UI. |

### Infrastructure

| Package | Purpose |
|---------|---------|
| `@forge/job-engine` | In-memory task queue. Submit jobs, track status (pending → running → success/failed), progress streaming. |
| `@forge/resource-manager` | Resolves paths to worker executable, binaries (ffmpeg), models, templates. Automatically handles dev vs prod paths. |
| `@forge/settings-core` | Read/write `settings.json`. Typed settings with defaults. Change event emitter. |
| `@forge/project-core` | Create/open project directories. Standard structure: `project.json`, `source/`, `analysis/`, `output/`, `temp/`. |

### UI & DX

| Package | Purpose |
|---------|---------|
| `@forge/ui-kit` | 18 React components: TitleBar, Sidebar, Modal, Toast, Tabs, Badge, Tooltip, FileDropZone, ProgressPanel, LogConsole, etc. All Tailwind, dark mode, no external deps. |
| `@forge/plugin-system` | Register plugins with routes, worker actions, menu items. Sidebar is built dynamically from the plugin registry. |
| `@forge/error-handler` | Maps raw Python errors to user-friendly messages. `createErrorMapper()`. React `ForgeErrorBoundary` component. |
| `@forge/updater` | Wraps `electron-updater`. `createUpdater()` → check, download, install. Supports GitHub Releases and S3/R2. |

### Python

| Package | Purpose |
|---------|---------|
| `forge-worker-runtime` | pip package. Provides `register`, `dispatch`, `run_worker`, `write_progress`. Every worker imports this instead of copying protocol files. |

## IPC Protocol

### Request (Electron → Python)

```json
{"action": "health_check", "payload": {}}
```

### Response (Python → Electron)

```json
{"success": true, "data": {"status": "ok"}, "error": null}
```

### Progress (Python → Electron, mid-task)

```json
{"progress": {"current": 5, "total": 10, "message": "Processing..."}}
```

### Ready signal (Python → Electron, on startup)

```json
{"ready": true}
```

Rules:
- **stdout** is exclusively for JSON protocol. Never `print()` to stdout.
- **stderr** is for logs. Use `from forge_worker import log`.
- One JSON object per line. No pretty-printing in protocol.

## File Conventions

| File | Convention |
|------|-----------|
| `packages/*/src/index.ts` | Barrel export — everything public goes through here |
| `packages/*/package.json` | Name: `@forge/<name>`, type: `module`, exports map |
| `packages/*/tsconfig.json` | Extends `../../tsconfig.base.json` |
| `apps/worker/actions/*.py` | One file per action. `@register("name")` decorator. |
| `apps/worker/actions/__init__.py` | Imports all action modules |
| `examples/*/worker/` | Same pattern as apps/worker/ |
