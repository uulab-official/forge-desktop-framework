# Forge Desktop Framework

> Open source framework for building desktop apps with **Electron** (UI) and **Python** (engine).

One command runs both. No servers. No ports. Just stdin/stdout JSON.

[![CI](https://github.com/uulab-official/forge-desktop-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/uulab-official/forge-desktop-framework/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why Forge?

Most desktop tools need a fast UI **and** a powerful backend. Forge gives you:

- **React + Tailwind** for the UI (fast, modern, hot-reload)
- **Python** for the engine (ML, video, data — any Python library works)
- **One-click packaging** — users install one app, Python is bundled inside via PyInstaller
- **No server** — Python runs as a subprocess, communicates via JSON pipes

Build apps like: video editors, AI tools, OCR scanners, data dashboards, automation tools.

## Quick Start

Today there are two practical ways to start with Forge:

- **Build an app from the reference repo**: best path right now if you want to learn the framework end to end.
- **Use the scaffold CLI in-repo**: best path if you are actively developing the framework and its templates.

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm 10+](https://pnpm.io/) (`npm install -g pnpm`)
- [Python 3.12+](https://www.python.org/)

### Path 1: Run The Framework From Source

```bash
git clone https://github.com/uulab-official/forge-desktop-framework.git
cd forge-desktop-framework
pnpm install
pip3 install -e packages/worker-runtime
```

### Run The Reference App

```bash
./scripts/dev.sh
```

This one command:
1. Builds all TypeScript packages
2. Starts Vite dev server
3. Launches Electron
4. Python worker spawns on-demand when you click a button

### Path 2: Use The Scaffold CLI From This Repo

The scaffold package lives in `packages/create-forge-app/` and publishes the `create-forge-desktop` / `forge-desktop` binaries.

Current status:
- the CLI itself is real and works in this repo
- template content is synced from `examples/`
- core `@forge/*` package manifests are now shaped for external distribution
- the monorepo is still the primary integration path until package publishing is fully automated
- generated apps now receive a default packaging preset and vendored worker runtime
- generated apps now receive release automation scaffolding for validation and tagged publishing

Repo-local preview:

```bash
git clone https://github.com/uulab-official/forge-desktop-framework.git
cd forge-desktop-framework
pnpm install
pip3 install -e packages/worker-runtime
pnpm --filter create-forge-desktop build

cd packages/create-forge-app
node dist/create.js my-forge-app --template minimal
```

Feature-pack preview for the `minimal` starter:

```bash
node dist/index.js create my-forge-app --template minimal \
  --feature settings \
  --feature updater \
  --feature jobs \
  --feature plugins \
  --feature diagnostics \
  --feature notifications \
  --feature windowing \
  --feature tray \
  --feature deep-link \
  --feature menu-bar \
  --feature auto-launch
```

Or use the bundled production starter preset:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset launch-ready
```

Release metadata can also be seeded during creation:

```bash
node dist/index.js create my-forge-app --template minimal \
  --product-name "My Forge App" \
  --app-id "com.acme.myforgeapp" \
  --github-owner acme \
  --github-repo my-forge-app
```

See [packages/create-forge-app/README.md](packages/create-forge-app/README.md) for the CLI-focused notes.

What the scaffold now adds by default:
- vendored `worker/forge_worker` runtime code
- generated project README with setup and release steps
- `electron-builder` config files for GitHub and S3/R2 publishing
- local scripts for Python setup, worker bundling, and app packaging
- `.env.example`, release preflight script, and a release playbook
- GitHub Actions workflows for validation and tagged releases
- renderer safety/diagnostics baseline with an error boundary and runtime log dock

Feature packs available on the `minimal` starter today:
- `settings` for persisted preferences and runtime controls
- `updater` for packaged-build update checks via Forge updater IPC
- `jobs` for queued background work and progress events
- `plugins` for a seeded plugin registry and sample plugin slots
- `diagnostics` for in-app environment snapshots and support bundle export
- `notifications` for native desktop notifications from the generated runtime shell
- `windowing` for restored window bounds, single-instance focus, and starter window controls
- `tray` for a starter system tray integration with show or hide controls
- `deep-link` for starter protocol URL capture, preload bindings, and in-app deep-link inspection controls
- `menu-bar` for a starter application menu with standard desktop commands and rebuild controls
- `auto-launch` for starter login-item controls that toggle start-on-login from the desktop shell

Starter presets available today:
- `launch-ready` bundles `settings`, `updater`, `jobs`, `plugins`, `diagnostics`, `notifications`, `windowing`, and `menu-bar`

## How It Works

```
┌─ Electron App ─────────────────────────────────┐
│                                                  │
│  React UI                                        │
│    └→ ipcRenderer.invoke('worker:execute')       │
│                                                  │
│  Main Process                                    │
│    └→ spawn('python3', ['main.py'])              │
│         stdin:  {"action":"health_check"}        │
│         stdout: {"success":true,"data":{...}}    │
│                                                  │
├─ Python Worker ─────────────────────────────────┤
│                                                  │
│  from forge_worker import register, run_worker   │
│                                                  │
│  @register("health_check")                       │
│  def handle(payload):                            │
│      return {"status": "ok"}                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

Python is **not** a server. It's spawned per-request, responds, and exits. No ports, no sockets.

## Project Structure

```
forge-desktop-framework/
├── apps/
│   ├── app/                  # Electron + React app
│   └── worker/               # Python worker (actions)
├── packages/
│   ├── worker-runtime/       # Python core (pip: forge-worker-runtime)
│   ├── ipc-contract/         # Shared TypeScript types
│   ├── worker-client/        # Spawns Python, parses JSON
│   ├── job-engine/           # Task queue
│   ├── ui-kit/               # 18 React components
│   ├── plugin-system/        # Plugin registry
│   ├── error-handler/        # Error mapping + ErrorBoundary
│   ├── updater/              # Auto-update (electron-updater)
│   ├── resource-manager/     # Dev/prod path resolution
│   ├── project-core/         # Project directory management
│   ├── settings-core/        # Settings persistence
│   ├── logger/               # Structured logging
│   └── create-forge-app/     # CLI scaffolding tool
├── examples/                 # 9 example apps
├── docs/                     # Guides
└── scripts/                  # Dev, build, release scripts
```

## Examples

| Name | What it demonstrates |
|------|---------------------|
| [minimal](examples/minimal/) | Simplest possible app — one input, one Python action |
| [file-processor](examples/file-processor/) | Drag-and-drop, job queue, progress tracking |
| [ai-tool](examples/ai-tool/) | Sentiment analysis, summarizer, classifier (stdlib) |
| [video-tools](examples/video-tools/) | ffmpeg integration, external binary pattern |
| [dashboard](examples/dashboard/) | SVG charts, multi-action data analysis |
| [multi-module](examples/multi-module/) | Plugin/module pattern with dynamic sidebar |
| [chat](examples/chat/) | Chat UI, typing indicator, streaming response |
| [webrtc-demo](examples/webrtc-demo/) | WebRTC video + data channel in Electron |
| [webgpu-compute](examples/webgpu-compute/) | GPU compute shader vs CPU benchmark |

Run any example:
```bash
pnpm --filter @forge-example/minimal dev
```

## Creating a New Action

The most common task. Three steps:

**1. Create the Python file**
```python
# apps/worker/actions/summarize.py
from forge_worker import register

@register("summarize")
def handle(payload):
    text = payload["text"]
    sentences = text.split(". ")
    return {"summary": ". ".join(sentences[:3]), "total": len(sentences)}
```

**2. Register it**
```python
# apps/worker/actions/__init__.py
from . import health_check
from . import echo
from . import summarize  # add this line
```

**3. Call from React**
```tsx
const res = await window.electronAPI.worker.execute({
  action: 'summarize',
  payload: { text: 'Long article...' },
});
console.log(res.data.summary);
```

Test without Electron:
```bash
echo '{"action":"summarize","payload":{"text":"First. Second. Third."}}' | python3 apps/worker/main.py
```

## Commands

```bash
# Development
./scripts/dev.sh                          # Start everything
pnpm --filter create-forge-desktop build  # Build the scaffold CLI
pnpm --filter @forge/app dev              # App only
pnpm --filter @forge-example/chat dev     # Run an example
node packages/create-forge-app/dist/index.js doctor
pnpm build                                # Build all packages
pnpm typecheck                            # Type check
pnpm test                                 # Unit tests (vitest)
pnpm scaffold:test                        # Scaffold minimal apps and verify install/typecheck/build
pnpm version:check                        # Verify aligned workspace versions
bash scripts/test-workers.sh              # Test all Python workers

# Production
./scripts/setup-python.sh                 # Setup Python venv + deps
./scripts/build-worker.sh                 # PyInstaller → executable
./scripts/build-app.sh                    # Full build + package

# Release
./scripts/release.sh patch                # Bump version
git push && git push --tags               # Triggers CI → build → publish
```

## Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](docs/getting-started.md)** | Step-by-step first app tutorial |
| **[Architecture](docs/architecture.md)** | Design philosophy, package relationships |
| **[IPC Patterns](docs/ipc-patterns.md)** | Request/response, streaming, events |
| **[API Reference](docs/api-reference.md)** | Core package APIs |
| **[Deployment](docs/deployment.md)** | Build, release, auto-update |
| **[Code Signing](docs/code-signing.md)** | macOS notarization, Windows signing |

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript + Tailwind CSS v4 |
| Desktop | Electron (frameless, contextBridge IPC) |
| Engine | Python 3.12+ (PyInstaller for distribution) |
| IPC Protocol | JSON over stdin/stdout |
| Build | Vite + Turborepo + pnpm |
| Tests | Vitest (TS) + pytest-compatible (Python) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE) — UULAB
