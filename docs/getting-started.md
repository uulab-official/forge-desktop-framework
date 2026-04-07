# Getting Started

Build your first Forge Desktop app in 10 minutes.

This guide covers the **current stable path**: running Forge from the monorepo and learning from the reference app.

If you specifically want the scaffold CLI, start with [packages/create-forge-app/README.md](../packages/create-forge-app/README.md). The CLI is real, but the monorepo is still the most complete path today.

## What You'll Build

A desktop app where you type text, click a button, and Python processes it. The result appears in the UI instantly.

## Prerequisites

```bash
node --version   # v20+
pnpm --version   # v10+
python3 --version # v3.12+
```

## Step 1: Clone and Install

```bash
git clone https://github.com/uulab-official/forge-desktop-framework.git
cd forge-desktop-framework
pnpm install
pip3 install -e packages/worker-runtime
```

## Step 2: Run the Reference App

```bash
./scripts/dev.sh
```

An Electron window opens with:
- **Dashboard** — shows worker status (should say "Online")
- **Worker Console** — lets you test Python actions
- **Settings** — app configuration

Click **Health Check**. You should see a green success response with Python version info. That's the full round-trip: React → Electron → Python → back.

## Optional: Preview The Scaffold CLI

If you want to inspect the upcoming app-creation flow:

```bash
pnpm --filter create-forge-desktop build
cd packages/create-forge-app
node dist/create.js my-forge-app --template minimal
```

To preview the release-oriented feature packs on the `minimal` starter:

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

Or preview the bundled production-grade starter:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset production-ready
```

That starter now also includes `pnpm security:check`, `pnpm ops:check`, `pnpm ops:snapshot`, `pnpm ops:evidence`, `pnpm ops:report`, `pnpm ops:bundle`, `pnpm ops:index`, `pnpm ops:doctor`, `pnpm ops:handoff`, `pnpm ops:attest`, `pnpm ops:ready`, `pnpm ops:gate`, `pnpm ops:releasepack`, `pnpm ops:export`, `pnpm ops:restore`, `pnpm ops:recover`, `pnpm ops:rollback`, `pnpm ops:incident`, `pnpm ops:escalate`, `pnpm ops:continuity`, `pnpm ops:retention`, `pnpm production:check` for the default GitHub path, and `pnpm production:check:all -- --require-release-output` for a full post-package audit. Its generated validate and tagged release workflows also upload `ops/snapshots/`, `ops/evidence/`, `ops/reports/`, `ops/bundles/`, `ops/index/`, `ops/doctors/`, `ops/handoffs/`, `ops/attestations/`, `ops/ready/`, `ops/gates/`, `ops/releasepacks/`, `ops/exports/`, `ops/restores/`, `ops/recoveries/`, `ops/rollbacks/`, `ops/incidents/`, `ops/escalations/`, and `ops/continuity/` as build artifacts, while `ops:retention` trims old operator evidence before repeated audits.

Or preview the bundled launch starter:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset launch-ready
```

Or scaffold the support and QA investigation baseline:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset support-ready
```

Or scaffold the runtime operations baseline:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset ops-ready
```

Or scaffold the document workflow baseline:

```bash
node dist/index.js create my-forge-app --template minimal \
  --preset document-ready
```

That generates a starter app from one of the template snapshots under `packages/create-forge-app/templates/`.

The generated project includes:
- vendored `worker/forge_worker` runtime code
- a standalone `README.md`
- default `electron-builder` config
- `.env.example`, `docs/release-playbook.md`, `docs/production-readiness.md`, `pnpm release:check`, `pnpm security:check`, `pnpm ops:check`, `pnpm ops:snapshot`, `pnpm ops:evidence`, `pnpm ops:report`, `pnpm ops:bundle`, `pnpm ops:index`, `pnpm ops:doctor`, `pnpm ops:handoff`, `pnpm ops:attest`, `pnpm ops:ready`, `pnpm ops:gate`, `pnpm ops:releasepack`, `pnpm ops:export`, `pnpm ops:restore`, `pnpm ops:recover`, `pnpm ops:rollback`, `pnpm ops:incident`, `pnpm ops:escalate`, `pnpm ops:continuity`, `pnpm ops:retention`, `pnpm publish:check:*`, `pnpm package:verify*`, `pnpm package:audit*`, and `pnpm production:check*`
- GitHub Actions workflows for validation and tagged releases
- packaging scripts for the worker and the desktop app
- a renderer baseline with `ForgeErrorBoundary` and a floating log dock
- optional starter packs like `file-association` can also seed file-open handling and sample `electron-builder` file association metadata
- optional starter packs like `file-dialogs` can also seed native open and save dialogs with reveal-in-folder controls
- optional starter packs like `recent-files` can also seed a persistent recent document list that pairs naturally with file dialogs and file associations
- optional starter packs like `crash-recovery` can also seed renderer and child-process incident capture with starter relaunch controls
- optional starter packs like `power-monitor` can also seed suspend, resume, lock, unlock, and power-source tracking for long-running desktop workflows
- optional starter packs like `idle-presence` can also seed user activity, lock state, and current window attention diagnostics with starter refresh and history controls
- optional starter packs like `session-state` can also seed app lifecycle, foreground/background, focus, and visibility diagnostics with starter refresh and history controls
- optional starter packs like `downloads` can also seed file download tracking with progress and reveal-in-folder controls
- optional starter packs like `clipboard` can also seed copy and paste flows with starter read, write, clear, and history controls
- optional starter packs like `external-links` can also seed external browser or mail client launch flows with starter history and error tracking
- optional starter packs like `system-info` can also seed live runtime OS, memory, process, and path diagnostics with refresh controls
- optional starter packs like `permissions` can also seed camera, microphone, and screen permission diagnostics with starter request controls
- optional starter packs like `network-status` can also seed online and offline runtime diagnostics with starter refresh and history controls
- optional starter packs like `secure-storage` can also seed Electron `safeStorage` secret persistence with starter save, load, clear, and error diagnostics
- optional starter packs like `support-bundle` can also seed structured support JSON exports with reveal controls for QA, support, and customer handoff
- optional starter packs like `log-archive` can also seed timestamped runtime log exports with manifest files for QA, support, and escalation handoff
- optional starter packs like `incident-report` can also seed structured incident handoff drafts with severity, summary, repro steps, and export controls for escalation workflows
- optional starter packs like `diagnostics-timeline` can also seed structured desktop event history exports with clear and reveal controls for support investigations

## Step 3: Create Your First Action

Let's add a word counter.

### Python side

Create `apps/worker/actions/word_count.py`:

```python
from forge_worker import register

@register("word_count")
def handle(payload):
    text = payload.get("text", "")
    words = text.split()
    return {
        "words": len(words),
        "characters": len(text),
        "lines": text.count("\n") + 1,
    }
```

Register it in `apps/worker/actions/__init__.py`:

```python
from . import health_check
from . import echo
from . import word_count  # add this
```

### Test without Electron

```bash
echo '{"action":"word_count","payload":{"text":"Hello world"}}' | python3 apps/worker/main.py
```

Output:
```json
{"ready": true}
{"success": true, "data": {"words": 2, "characters": 11, "lines": 1}, "error": null}
```

### Call from the UI

In any React component:

```tsx
const res = await window.electronAPI.worker.execute({
  action: 'word_count',
  payload: { text: 'Hello world from Forge!' },
});
// res.data = { words: 5, characters: 24, lines: 1 }
```

## Step 4: Understand the Flow

```
User clicks button
  → React calls window.electronAPI.worker.execute()
    → Electron main receives via ipcMain.handle()
      → Spawns: python3 apps/worker/main.py
        → Writes JSON to stdin
        → Python reads, dispatches to @register'd handler
        → Handler returns dict
        → Python writes JSON to stdout
      → Electron reads stdout, parses JSON
    → Returns to renderer via IPC
  → React updates UI with result
```

Key insight: **Python is not a long-running server.** Each request spawns a fresh process. This means:
- No state between requests (unless you use files/DB)
- No port conflicts
- Crashes don't affect the app
- Any Python library works (no import restrictions)

## Step 5: Explore the Examples

```bash
# Simple text processing
pnpm --filter @forge-example/minimal dev

# File drag-and-drop with progress
pnpm --filter @forge-example/file-processor dev

# AI/ML pattern
pnpm --filter @forge-example/ai-tool dev

# Data dashboard with charts
pnpm --filter @forge-example/dashboard dev
```

Each example is self-contained. Read its `README.md` and `worker/actions/` to see the pattern.

## Step 6: Build for Distribution

```bash
# Setup Python build environment
./scripts/setup-python.sh

# Build everything (PyInstaller + Electron + packages)
./scripts/build-app.sh
```

Output: `apps/app/release/` contains the packaged app (.dmg, .exe, or .AppImage).

Users double-click to install. Python is bundled inside — no Python installation required.

## Next Steps

- **[Architecture Guide](architecture.md)** — understand the package design
- **[IPC Patterns](ipc-patterns.md)** — streaming, progress, events
- **[API Reference](api-reference.md)** — package APIs
- **[Deployment Guide](deployment.md)** — CI/CD, auto-update, code signing
- **[create-forge-desktop README](../packages/create-forge-app/README.md)** — scaffold CLI notes and template workflow
