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
  --feature auto-launch \
  --feature global-shortcut \
  --feature file-association \
  --feature file-dialogs \
  --feature recent-files \
  --feature crash-recovery \
  --feature power-monitor \
  --feature idle-presence \
  --feature session-state \
  --feature downloads \
  --feature clipboard \
  --feature external-links \
  --feature system-info \
  --feature permissions \
  --feature network-status \
  --feature secure-storage \
  --feature support-bundle \
  --feature log-archive \
  --feature incident-report \
  --feature diagnostics-timeline
```

Or use the bundled production starter preset:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset launch-ready
```

Or seed the support and QA investigation baseline in one step:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset support-ready
```

Or seed the runtime operations baseline in one step:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset ops-ready
```

Or seed the document workflow baseline in one step:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset document-ready
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
- `.env.example`, release preflight, publish-target preflight, package-output verification, package-output audit, and a release playbook
- GitHub Actions workflows for validation and tagged releases
- renderer safety/diagnostics baseline with an error boundary and runtime log dock

Framework CI now checks eight release-readiness layers on Ubuntu before changes land:
- in-repo scaffold smoke via `pnpm scaffold:test`
- repo-outside scaffold install and build verification via `pnpm scaffold:external:test`
- official preset release-surface audit via `pnpm release:audit`
- archived release history index smoke via `pnpm release:history:test`
- archived rollback target selection smoke via `pnpm release:rollback:target:test`
- archived rollback preparation smoke via `pnpm release:rollback:prepare:test`
- remote history rollback preparation smoke via `pnpm release:history:remote:test`
- remote rollback drill smoke via `pnpm release:rollback:remote:test`

Maintainers now also keep a versioned release checklist in [docs/release-checklists](/Users/bonjin/Documents/workspace/uulab/forge-desktop-framework/docs/release-checklists/README.md). `release:ship` now verifies that the next version already has a `vX.Y.Z.md` checklist marked `ready` before any release gates run.
Forge 1.0 release gate criteria now live in [docs/one-point-zero-gate.md](/Users/bonjin/Documents/workspace/uulab/forge-desktop-framework/docs/one-point-zero-gate.md), and maintainers can validate that the documented `1.0` contract still matches the repo with `pnpm release:onepointzero:test`.
Tagged release metadata now also emits `release-status.md/json`, which condenses the `1.0` gate, matrix targets, provenance, and official preset readiness into one operator-facing release health artifact.
Tagged release metadata now also emits `one-point-zero-freeze.md/json`, which combines the release-status artifact and the version checklist into a final `go/no-go` freeze record for maintainers.
Tagged release metadata now also emits `one-point-zero-decision.md/json`, which turns the readiness, release-status, and freeze layers into one final maintainer handoff for a `1.0` decision.
Tagged release metadata now also emits `one-point-zero-release-candidate.md/json`, which points the current stable line at the final `1.0.0` promotion handoff and next checklist path.
Maintainers can now also turn that release-candidate handoff into a prefilled `v1.0.0` checklist draft with `bash scripts/prepare-one-point-zero-major-checklist.sh`.
Tagged release metadata now also emits `one-point-zero-promotion-plan.md/json`, which joins that audited release-candidate handoff with the prepared `v1.0.0` checklist draft as one final `1.0.0` staging plan.
Tagged release metadata now also emits `one-point-zero-major-release-runbook.md/json`, which turns that staging plan into the exact command sequence maintainers should run for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-approval.md/json`, which joins the `1.0` decision, promotion plan, and major-runbook layers into the final first-major-release approval handoff.
Tagged release metadata now also emits `one-point-zero-major-release-cockpit.md/json`, which condenses the full `1.0` promotion stack into one final operator summary before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-packet.md/json`, which joins that green cockpit summary with the prepared `v1.0.0` checklist as the final human sign-off packet.
Tagged release metadata now also emits `one-point-zero-major-release-signoff.md/json`, which turns that packet into the explicit reviewer-facing signoff sheet for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-board.md/json`, which turns that signoff sheet into the final board-facing review artifact for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-verdict.md/json`, which turns that board artifact into the final maintainer go/no-go sheet for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-authorization.md/json`, which turns that verdict artifact into the final execution authorization sheet for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-warrant.md/json`, which turns that authorization artifact into the final launch-side warrant sheet for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-launch-sheet.md/json`, which turns that warrant artifact into the final operator-facing execution handoff for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-command-card.md/json`, which turns that launch sheet into the final command-only execution card for the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-preflight.md/json`, which turns that command card plus prepared `v1.0.0` checklist into the final preflight gate before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-trigger.md/json`, which turns that preflight artifact plus prepared `v1.0.0` checklist into the final execution trigger before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-rehearsal.md/json`, which turns that trigger artifact plus prepared `v1.0.0` checklist into the final dry-run rehearsal before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-go-live.md/json`, which turns that rehearsal artifact plus prepared `v1.0.0` checklist into the final execution surface before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-activation.md/json`, which turns that go-live artifact plus prepared `v1.0.0` checklist into the final execution confirmation surface before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-execution.md/json`, which turns that activation artifact plus prepared `v1.0.0` checklist into the final execution confirmation surface before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-attestation.md/json`, which turns that execution artifact plus prepared `v1.0.0` checklist into the final immutable attestation surface before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-seal.md/json`, which turns that attestation artifact plus prepared `v1.0.0` checklist into the final immutable seal surface before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-charter.md/json`, which turns that seal artifact plus prepared `v1.0.0` checklist into the final immutable charter surface before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-canon.md/json`, which turns that charter artifact plus prepared `v1.0.0` checklist into the final immutable canon surface before the first major ship.
Tagged release metadata now also emits `one-point-zero-major-release-constitution.md/json`, `one-point-zero-major-release-covenant.md/json`, `one-point-zero-major-release-compact.md/json`, `one-point-zero-major-release-capsule.md/json`, `one-point-zero-major-release-ledger.md/json`, `one-point-zero-major-release-archive.md/json`, and `one-point-zero-major-release-vault.md/json`, which turn that canon artifact and prepared `v1.0.0` checklist into the final immutable constitution, covenant, compact, capsule, ledger, archive, and vault surfaces before the first major ship.

Tagged release runs now also upload per-matrix release inventory artifacts with `artifact-summary.md`, `artifact-summary.json`, and `latest*.yml` so maintainers can inspect packaged output without pulling raw runner files.
The same tagged release flow now also audits platform-specific publish output so mac builds must emit `.dmg`, Windows builds must emit `.exe`, Linux builds must emit `.AppImage`, and all of them must keep a `latest*.yml` manifest.
It also audits manifest consistency so every `latest*.yml` must point at a real packaged file, include `sha512`, and match the tagged release version.
It now also audits signing readiness before packaging so missing mac notarization or Windows signing secrets fail early with a readable summary.
It now also audits rollback readiness so each platform inventory must keep versioned installer names plus the audit metadata needed to repoint a `latest` channel back to a known-good tagged build.
The same tagged workflow now also emits `rollback-playbook.md/json` so maintainers get a per-platform rollback execution checklist from the packaged installers and updater manifests.
When S3 publishing is enabled, the tagged release flow now also audits publish channel parity so the GitHub and S3 release outputs must keep the same installer filenames and updater manifest targets for the tagged version.
The tagged release flow now also emits `channel-recovery.md/json` so maintainers can see whether rollback playbooks, channel metadata, and publish parity still agree for GitHub-only or GitHub+S3 recovery paths.
Maintainers can now also run a rollback drill against archived prior-release metadata to verify that a previous version still satisfies the generated rollback playbook before touching a live channel.
Tagged release jobs now also emit a standardized release inventory bundle so those archived rollback inputs can be stored and reused instead of reconstructed from loose audit files.
Maintainers can now retrieve that exact bundle by platform, arch, and version as the canonical rollback drill input.
The release matrix summary now also emits a release bundle index so maintainers can discover which archived bundle versions exist per target before retrieval.
Maintainers can now also generate a release history index across multiple fetched tags so recovery work can see every cached archived bundle in one place.
Maintainers can now also auto-select the newest valid rollback candidate from that archived bundle index before retrieval or drill execution.
Maintainers can now also fetch those archived bundles directly from tagged GitHub Actions release artifacts with `gh`, so rollback drills no longer require manual artifact downloads first.
When S3 publishing is enabled, the same archived bundle cache is now also mirrored to object storage so maintainers can fetch rollback inputs with `aws s3 sync`.
Both remote fetch helpers now also refresh a parent `release-history-index.md/json` so multi-tag rollback discovery stays current as maintainers accumulate cached artifacts.
Maintainers can now also prepare a rollback input directly from that accumulated history root, so target selection and archived bundle retrieval can be closed in one command before a drill runs.
Maintainers can now also build that history root straight from recent GitHub release artifacts or S3 mirrors and immediately prepare the rollback bundle from the same command chain.
Maintainers can now also run the full remote recovery path in one command, so provider fetch, rollback target preparation, and rollback drill no longer need to be stitched together by hand.
That final recovery command now also emits `recovery-command-summary.md/json`, so the chosen rollback target, archived assets, rerun command, and follow-up operator actions are preserved as one human-readable recovery artifact.
After the matrix finishes, the workflow now emits a top-level `release-matrix-summary.md/json` so maintainers can review every platform in one place.
The same follow-up job now also emits `release-provenance.md/json` so tag, commit, version, and platform outputs stay traceable as one release record.
The same follow-up job now also emits `release-status.md/json` so maintainers can review the overall release state without opening every individual audit file.
It now also emits `one-point-zero-freeze.md/json` so maintainers can review one explicit freeze decision artifact before calling the framework 1.0-ready.
It now also emits `one-point-zero-decision.md/json` so maintainers can review one final `1.0` decision artifact without re-reading every upstream audit and checklist file.
It now also emits `one-point-zero-release-candidate.md/json` so maintainers can review the final `1.0.0` promotion handoff and next major-release checklist target from one artifact.
The same `1.0` stack now also includes a checked helper that can materialize the matching `v1.0.0` checklist draft from that release-candidate artifact without rewriting the scope by hand.
The same `1.0` stack now also emits `one-point-zero-promotion-plan.md/json` so maintainers can review the release-candidate handoff and generated `v1.0.0` checklist together before staging the first major release.
The same `1.0` stack now also emits `one-point-zero-major-release-runbook.md/json` so maintainers can hand the final first-major-release command sequence around without rebuilding it from multiple artifacts.
The same `1.0` stack now also emits `one-point-zero-major-release-approval.md/json` so the final go/no-go approval for the first major release survives as one auditable artifact.
The same `1.0` stack now also emits `one-point-zero-major-release-cockpit.md/json` so operators can review the final readiness, decision, approval, and ship commands from one artifact.
The same `1.0` stack now also emits `one-point-zero-major-release-packet.md/json` so maintainers can review the final human sign-off packet without reopening every upstream 1.0 artifact.
The same `1.0` stack now also emits `one-point-zero-major-release-signoff.md/json` so the final reviewer-facing approval sheet survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-board.md/json` so the final board-facing review artifact survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-verdict.md/json` so the final maintainer go/no-go sheet survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-authorization.md/json` so the final major-release execution authorization sheet survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-warrant.md/json` so the final major-release launch-side warrant sheet survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-launch-sheet.md/json` so the final major-release execution handoff survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-command-card.md/json` so the final major-release command surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-preflight.md/json` so the final major-release preflight gate survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-trigger.md/json` so the final major-release execution trigger survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-rehearsal.md/json` so the final major-release dry-run rehearsal survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-go-live.md/json` so the final major-release execution surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-activation.md/json` so the final major-release execution confirmation surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-execution.md/json` so the final major-release execution confirmation surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-attestation.md/json` so the final immutable major-release attestation surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-seal.md/json` so the final immutable major-release seal surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-charter.md/json` so the final immutable major-release charter surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-canon.md/json` so the final immutable major-release canon surface survives as a tagged release artifact too.
The same `1.0` stack now also emits `one-point-zero-major-release-constitution.md/json`, `one-point-zero-major-release-covenant.md/json`, `one-point-zero-major-release-compact.md/json`, `one-point-zero-major-release-capsule.md/json`, `one-point-zero-major-release-ledger.md/json`, `one-point-zero-major-release-archive.md/json`, and `one-point-zero-major-release-vault.md/json` so the final immutable major-release constitution, covenant, compact, capsule, ledger, archive, and vault surfaces survive as tagged release artifacts too.

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
- `global-shortcut` for starter system-wide shortcut registration and focus or restore actions from anywhere
- `file-association` for starter file-open handling, preload bindings, and sample `electron-builder` file association metadata
- `file-dialogs` for native open and save dialogs plus reveal-in-folder controls from the starter desktop shell
- `recent-files` for a persistent recent document registry with starter reopen and clear controls
- `crash-recovery` for starter renderer and child-process incident tracking with relaunch and clear controls
- `power-monitor` for suspend, resume, lock, unlock, and power-source monitoring with starter history and clear controls
- `idle-presence` for starter user activity, lock state, and window attention diagnostics with refresh and history controls
- `session-state` for starter app lifecycle, window visibility, and focus-event diagnostics with refresh and history controls
- `downloads` for starter download tracking with progress, history, and reveal-in-folder controls
- `clipboard` for starter clipboard read, write, clear, and history controls
- `external-links` for starter `shell.openExternal` link launching with history and error tracking
- `system-info` for starter runtime OS, memory, process, and path diagnostics with refresh controls
- `permissions` for starter camera, microphone, and screen permission diagnostics with request controls
- `network-status` for starter online/offline diagnostics with refresh and history controls
- `secure-storage` for starter Electron `safeStorage` secret persistence with save, load, clear, and error diagnostics
- `support-bundle` for structured JSON support handoff exports with reveal-in-folder controls and included-section tracking
- `log-archive` for timestamped runtime log snapshot exports with manifest generation and reveal-in-folder controls
- `incident-report` for structured desktop escalation drafts with severity, repro steps, export, and reveal-in-folder controls
- `diagnostics-timeline` for structured desktop event history exports with reveal, clear, and support investigation controls

Starter presets available today:
- `launch-ready` bundles `settings`, `updater`, `jobs`, `plugins`, `diagnostics`, `notifications`, `windowing`, and `menu-bar`
- `support-ready` bundles `support-bundle`, `log-archive`, `incident-report`, and `diagnostics-timeline`
- `ops-ready` bundles `diagnostics`, `support-bundle`, `crash-recovery`, `system-info`, `network-status`, `power-monitor`, `idle-presence`, and `session-state`
- `document-ready` bundles `file-association`, `file-dialogs`, `recent-files`, `windowing`, and `menu-bar`

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
pnpm release:audit                        # Audit official preset release files and scripts
pnpm version:check                        # Verify aligned workspace versions
bash scripts/test-workers.sh              # Test all Python workers

# Production
./scripts/setup-python.sh                 # Setup Python venv + deps
./scripts/build-worker.sh                 # PyInstaller → executable
./scripts/build-app.sh                    # Full build + package

# Release
pnpm release:ship patch                   # Verify, bump, commit, tag, and push

# Manual split flow
pnpm release:audit                        # Audit official preset release surface first
pnpm release:bump patch                   # Verify and bump only
git add -A
git commit -m "release: v0.1.x"
git tag -a v0.1.x -m "release: v0.1.x"
git push origin main
git push origin v0.1.x
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
