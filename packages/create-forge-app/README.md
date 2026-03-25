# create-forge-desktop

Scaffold CLI for Forge Desktop apps.

This package produces two binaries:
- `create-forge-desktop`
- `forge-desktop`

## Current Status

This CLI is part of the Forge monorepo and is being shaped into the main app-creation entry point.

Today:
- templates are copied from `examples/`
- the CLI commands exist and build locally
- core `@forge/*` packages now have publish-ready package metadata
- the safest workflow is still repo-local development while package publishing is being formalized
- generated apps now get a vendored Python worker runtime and a default electron-builder release preset
- generated apps now also get GitHub Actions release workflows, `.env.example`, and a release preflight script

## Why This Matters

The scaffold process rewrites internal `workspace:*` dependencies to versioned `@forge/*` ranges. That only makes sense if the framework packages are treated as distributable products, not monorepo-only internals.

## Repo-Local Usage

From the repository root:

```bash
pnpm install
pip3 install -e packages/worker-runtime
pnpm --filter create-forge-desktop build
```

Then run the scaffold command from this package:

```bash
cd packages/create-forge-app
node dist/create.js my-forge-app --template minimal
```

Or use the main CLI entry:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal
```

Environment check:

```bash
cd packages/create-forge-app
node dist/index.js doctor
```

Non-interactive creation:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal --yes
```

Feature-pack creation for the `minimal` starter:

```bash
cd packages/create-forge-app
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
  --feature file-dialogs
```

Preset creation for the production starter:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal \
  --preset launch-ready
```

Release identity overrides:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal \
  --product-name "My Forge App" \
  --app-id "com.acme.myforgeapp" \
  --github-owner acme \
  --github-repo my-forge-app
```

List the available feature packs:

```bash
cd packages/create-forge-app
node dist/index.js create --list-features
```

List the available presets:

```bash
cd packages/create-forge-app
node dist/index.js create --list-presets
```

Generated projects now include:
- `worker/forge_worker/` vendored runtime code
- `electron-builder.yml` and `electron-builder.s3.yml`
- `.github/workflows/validate.yml` and `.github/workflows/release.yml`
- `.env.example` and `docs/release-playbook.md`
- `scripts/setup-python.sh`, `scripts/build-worker.sh`, `scripts/build-app.sh`, `scripts/preflight-release.sh`
- package scripts for `pnpm release:check`, `pnpm setup:python`, `pnpm build:worker`, and `pnpm package`
- renderer baseline with `ForgeErrorBoundary` and a floating runtime log dock

Feature packs currently target the `minimal` template and add:
- `settings` for persisted preferences and runtime controls
- `updater` for updater IPC and packaged-build checks
- `jobs` for queued background work and progress tracking
- `plugins` for a seeded plugin registry and sample plugin inventory
- `diagnostics` for environment snapshots and support bundle export from the desktop shell
- `notifications` for native desktop notifications and a starter control surface in the runtime shell
- `windowing` for restored window bounds, single-instance focus, and starter window controls
- `tray` for a starter system tray integration with show or hide controls
- `deep-link` for starter protocol URL capture, preload bindings, and in-app deep-link inspection controls
- `menu-bar` for a starter application menu with standard desktop commands and rebuild controls
- `auto-launch` for login-item controls that toggle start-on-login from the desktop shell
- `global-shortcut` for system-wide shortcut registration with starter focus and restore controls
- `file-association` for starter file-open handling, preload bindings, and sample `electron-builder` file association metadata
- `file-dialogs` for native open and save dialogs plus reveal-in-folder controls from the starter desktop shell

Starter presets currently target the `minimal` template:
- `launch-ready` bundles `settings`, `updater`, `jobs`, `plugins`, `diagnostics`, `notifications`, `windowing`, and `menu-bar`

## Templates

- `minimal`
- `file-processor`
- `ai-tool`
- `video-tools`
- `dashboard`
- `multi-module`
- `chat`
- `webrtc-demo`
- `webgpu-compute`

Template metadata lives in `src/templates.ts`.

## Development Notes

- Source of truth: `examples/`
- Distributed copies: `packages/create-forge-app/templates/`
- Sync command: `bash scripts/sync-templates.sh`

## Related Files

- `src/create.ts` — backward-compatible create entry
- `src/index.ts` — main CLI entry
- `src/scaffold.ts` — template copy and rewrite logic
- `src/commands/doctor.ts` — environment checks for Node/Python/pip
- `templates/` — packaged template snapshots
