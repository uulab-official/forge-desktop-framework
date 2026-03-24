# forge-desktop-framework

Open source local-engine desktop app framework.

Electron (UI) + Python Worker (engine) — one command to run both.

## Quick Start

```bash
# 1. Install
git clone https://github.com/uulab-official/forge-desktop-framework.git
cd forge-desktop-framework
pnpm install

# 2. Setup Python worker runtime
pip3 install -e packages/worker-runtime

# 3. Run (Electron + Python, one command)
./scripts/dev.sh
```

This builds all packages, starts Vite dev server, launches Electron, and Python worker is spawned on-demand when the app calls an action.

## How It Works

```
┌─ apps/app/ ──────────────────────────────────────┐
│                                                    │
│  React Renderer (Vite dev server)                  │
│    ↓ ipcRenderer.invoke('worker:execute', req)     │
│                                                    │
│  Electron Main Process                             │
│    ↓ child_process.spawn('python3', ['main.py'])   │
│                                                    │
├─ apps/worker/ ───────────────────────────────────┤
│                                                    │
│  Python Worker (stdin/stdout JSON)                 │
│    → dispatcher → actions/health_check.py          │
│    ← { "success": true, "data": {...} }            │
│                                                    │
└────────────────────────────────────────────────────┘
```

**One command flow:**
1. `./scripts/dev.sh` → `pnpm build` (TS packages) → `pnpm --filter @forge/app dev`
2. Vite starts dev server + compiles Electron main with `vite-plugin-electron`
3. Electron opens BrowserWindow, loads React from Vite
4. User clicks "Health Check" → renderer invokes IPC → Electron spawns `python3 apps/worker/main.py`
5. Python worker reads JSON from stdin, runs action, writes JSON to stdout
6. Electron parses response, sends back to renderer

Python is **not** a long-running server. It's spawned per-request and killed after responding. No ports, no sockets, no configuration.

## Project Structure

```
forge-desktop-framework/
│
├── apps/
│   ├── app/                     # Electron desktop app
│   │   ├── electron/
│   │   │   ├── main.ts          # App entry: creates window, spawns worker
│   │   │   ├── preload.ts       # contextBridge → window.electronAPI
│   │   │   ├── ipc-handlers.ts  # IPC route registration
│   │   │   └── auto-updater.ts  # electron-updater integration
│   │   ├── src/
│   │   │   ├── App.tsx          # React root
│   │   │   ├── pages/           # HomePage, SettingsPage
│   │   │   └── shared/lib/ipc.ts # Typed IPC wrapper
│   │   ├── electron-builder.yml # Build config (GitHub Releases)
│   │   ├── electron-builder.s3.yml # Build config (S3/R2)
│   │   └── package.json         # @forge/app
│   │
│   └── worker/                  # Python worker (sibling of app)
│       ├── main.py              # Entry: imports actions, calls run_worker()
│       ├── actions/
│       │   ├── health_check.py  # @register("health_check")
│       │   └── echo.py          # @register("echo")
│       └── requirements.txt     # pip deps (forge-worker-runtime)
│
├── packages/
│   ├── worker-runtime/          # Python pip package (forge-worker-runtime)
│   │   └── forge_worker/
│   │       ├── protocol.py      # JSON stdin/stdout read/write
│   │       ├── dispatcher.py    # @register decorator + dispatch()
│   │       └── runner.py        # run_worker() main loop
│   │
│   ├── ipc-contract/            # Shared TS types (WorkerRequest, JobStatus, etc.)
│   ├── worker-client/           # Node.js: spawns Python, sends JSON via stdin
│   ├── job-engine/              # Task queue (pending → running → success/failed)
│   ├── ui-kit/                  # 18 React components (TitleBar, Modal, Toast, etc.)
│   ├── plugin-system/           # Plugin registry + lifecycle
│   ├── error-handler/           # Python error → user message mapper
│   ├── updater/                 # electron-updater wrapper
│   ├── resource-manager/        # Dev/prod path resolution
│   ├── project-core/            # Project directory management
│   ├── settings-core/           # Settings persistence
│   ├── logger/                  # Structured logging
│   └── create-forge-app/        # CLI: forge create/build/release/publish/dev
│
├── examples/                    # 9 example apps
│   ├── minimal/                 # Text reverse (simplest possible)
│   ├── file-processor/          # Drag-and-drop + job queue + progress
│   ├── ai-tool/                 # Sentiment/summarize/classify (stdlib)
│   ├── video-tools/             # ffmpeg integration pattern
│   ├── dashboard/               # SVG charts + data analysis
│   ├── multi-module/            # Plugin/module pattern
│   ├── chat/                    # Chat UI with typing indicator
│   ├── webrtc-demo/             # WebRTC video + data channel
│   └── webgpu-compute/          # GPU matrix multiply vs CPU
│
├── resources/                   # Bundled assets (binaries, fonts, models, templates)
├── scripts/                     # Shell scripts (dev, build, release, setup)
├── docs/                        # Guides (IPC patterns, code signing, deployment)
├── .github/workflows/           # CI + Release automation
├── .claude/skills/              # 6 Claude Code skills
└── CLAUDE.md                    # Claude Code project context
```

## Commands

### Development

```bash
./scripts/dev.sh                          # Build packages + start Electron app
pnpm --filter @forge/app dev              # Start app only (packages already built)
pnpm --filter @forge-example/minimal dev  # Run an example
pnpm build                                # Build all TS packages
pnpm typecheck                            # Type check everything
```

### Python Worker

```bash
# Setup (first time)
pip3 install -e packages/worker-runtime
./scripts/setup-python.sh

# Test directly
echo '{"action":"health_check","payload":{}}' | python3 apps/worker/main.py

# Add a new action
# 1. Create apps/worker/actions/my_action.py
# 2. Use: from forge_worker import register
#    @register("my_action")
#    def handle(payload): return {"result": "..."}
# 3. Import in apps/worker/actions/__init__.py
```

### Build & Deploy

```bash
# Local build
./scripts/build-worker.sh    # PyInstaller → apps/worker/dist/forge-worker
./scripts/build-app.sh       # Full build (worker + packages + Electron)

# Release
./scripts/release.sh patch   # Bump version + git tag
git push && git push --tags  # Triggers GitHub Actions → auto build + publish

# Or via forge CLI
forge build                  # Build everything
forge release patch          # Version bump
forge publish                # Publish to GitHub Releases
forge publish --s3           # Publish to S3/R2
```

### Scaffold New App

```bash
npx create-forge-app my-app              # Interactive template picker
npx create-forge-app my-app --template minimal
```

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript + Tailwind CSS v4 |
| Desktop Shell | Electron (frameless, contextBridge) |
| Engine | Python 3.12+ (PyInstaller for distribution) |
| IPC | stdin/stdout JSON (no server, no ports) |
| Build | Vite + Turborepo + pnpm |
| Worker Runtime | `forge-worker-runtime` (pip package) |
| Auto-Update | electron-updater (GitHub Releases or S3/R2) |

## Documentation

- [IPC Patterns](docs/ipc-patterns.md) — Request/response, streaming, events
- [Code Signing](docs/code-signing.md) — macOS notarization + Windows signing
- [Deployment](docs/deployment.md) — GitHub Actions, S3/R2, auto-update

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
