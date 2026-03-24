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

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm 10+](https://pnpm.io/) (`npm install -g pnpm`)
- [Python 3.12+](https://www.python.org/)

### Setup

```bash
git clone https://github.com/uulab-official/forge-desktop-framework.git
cd forge-desktop-framework
pnpm install
pip3 install -e packages/worker-runtime
```

### Run

```bash
./scripts/dev.sh
```

This one command:
1. Builds all TypeScript packages
2. Starts Vite dev server
3. Launches Electron
4. Python worker spawns on-demand when you click a button

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
pnpm --filter @forge/app dev              # App only
pnpm --filter @forge-example/chat dev     # Run an example
pnpm build                                # Build all packages
pnpm typecheck                            # Type check
pnpm test                                 # Unit tests (vitest)
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
