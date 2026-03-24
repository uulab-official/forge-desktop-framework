# forge-desktop-framework

Open source local-engine desktop app framework.

Build desktop applications powered by **Electron** (UI shell) + **Python Workers** (local engine), with a shared IPC protocol and modular architecture.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Renderer (React + Tailwind)                │
│  ┌─────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Pages   │ │ Widgets  │ │  Features   │  │
│  └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
│       └─────────────┼──────────────┘         │
│                     │ IPC (contextBridge)     │
├─────────────────────┼───────────────────────┤
│  Electron Main      │                        │
│  ┌──────────────────┼──────────────────────┐ │
│  │  Job Engine ← Worker Client             │ │
│  │  Project Core   Settings   Resources    │ │
│  └──────────────────┼──────────────────────┘ │
├─────────────────────┼───────────────────────┤
│  Python Worker      │ stdin/stdout JSON      │
│  ┌──────────────────┼──────────────────────┐ │
│  │  Dispatcher → Actions                   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Quick Start

```bash
# Create a new app from a template
npx create-forge-app my-app

# Or clone and develop the framework itself
git clone https://github.com/uulab/forge-desktop-framework.git
cd forge-desktop-framework
pnpm install
pnpm dev
```

## Stack

- **UI**: React 19 + TypeScript + Tailwind CSS v4
- **App Shell**: Electron
- **Engine**: Python (PyInstaller for distribution)
- **Build**: Vite + Turborepo + pnpm
- **IPC**: stdin/stdout JSON protocol

## Packages

### Core

| Package | Description |
|---------|-------------|
| `@forge/ipc-contract` | Shared IPC types and channel constants |
| `@forge/worker-client` | Python worker process manager |
| `@forge/job-engine` | Task queue with status tracking |
| `@forge/project-core` | Project directory management |
| `@forge/resource-manager` | Resource path resolution (dev/prod) |
| `@forge/settings-core` | Settings persistence |
| `@forge/logger` | Structured logging |

### UI & DX

| Package | Description |
|---------|-------------|
| `@forge/ui-kit` | Common UI components (AppLayout, Sidebar, ProgressPanel, LogConsole, FileDropZone, etc.) |
| `@forge/plugin-system` | Plugin registration and lifecycle management |
| `@forge/error-handler` | Error mapping (Python → user-friendly) + React ErrorBoundary |
| `@forge/updater` | Auto-update via electron-updater |

### Apps & Tools

| Package | Description |
|---------|-------------|
| `@forge/app` | Main Electron app |
| `create-forge-app` | CLI scaffolding tool |

## Examples

| Example | Description |
|---------|-------------|
| `minimal` | Bare minimum app — one input, one Python action |
| `file-processor` | Batch file processing with drag-and-drop and job queue |
| `ai-tool` | Local AI/ML integration pattern (stdlib stubs) |
| `video-tools` | External binary integration (ffmpeg/ffprobe pattern) |
| `dashboard` | Data dashboard with SVG charts and data analysis |
| `multi-module` | Module/plugin pattern with dynamic sidebar |
| `chat` | Real-time chat UI with smooth animations and Python-backed responses |
| `webrtc-demo` | WebRTC peer connection with video, audio, and data channels |
| `webgpu-compute` | GPU-accelerated computation with WebGPU compute shaders |

Each example is self-contained and can be used as a template via `create-forge-app`.

## Documentation

| Document | Description |
|----------|-------------|
| [IPC Patterns](docs/ipc-patterns.md) | Communication patterns (request/response, streaming, events) |
| [Code Signing](docs/code-signing.md) | macOS notarization and Windows signing guide |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the app
pnpm --filter @forge/app dev

# Run an example
pnpm --filter @forge-example/minimal dev

# Type check
pnpm typecheck
```

## Building for Production

```bash
# Setup Python environment
./scripts/setup-python.sh

# Build Python worker executable
./scripts/build-worker.sh

# Build and package the app
./scripts/build-app.sh
```

## Code Signing & Release

See [docs/code-signing.md](docs/code-signing.md) for macOS notarization and Windows signing setup.

```bash
# Bump version and prepare release
./scripts/release.sh patch  # or minor, major
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
