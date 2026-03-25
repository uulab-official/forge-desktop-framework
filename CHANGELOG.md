# Changelog

## 0.1.14 (2026-03-25)

### Menu-Bar Feature Pack

- Added a `menu-bar` scaffold feature pack for the `minimal` starter
- Generated apps now install a starter application menu with standard File, View, Window, and Help sections plus rebuild state exposed through preload IPC
- Expanded the `launch-ready` preset to include `menu-bar` so production starters ship with a menu baseline by default

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated menu-bar smoke app before any version bump

## 0.1.13 (2026-03-25)

### Deep-Link Feature Pack

- Added a `deep-link` scaffold feature pack for the `minimal` starter
- Generated apps now capture protocol URLs through main-process handlers, expose deep-link state over preload IPC, and surface starter deep-link controls in `FeatureStudio`
- Reused the single-instance window focus path for deep-link launches so repeated protocol opens route back into the existing desktop shell

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated deep-link smoke app before any version bump

## 0.1.12 (2026-03-25)

### Tray Feature Pack

- Added a `tray` scaffold feature pack for the `minimal` starter
- Generated apps now expose a starter system tray with show or hide and quit actions
- Added tray controls to `FeatureStudio` so scaffolded apps can verify tray visibility and window toggling without extra setup

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated tray smoke app before any version bump

## 0.1.11 (2026-03-25)

### Windowing Feature Pack

- Added a `windowing` scaffold feature pack for the `minimal` starter
- Generated apps now persist window bounds, restore the previous window size, and enforce single-instance focus in the desktop shell
- Added starter window controls in `FeatureStudio` so scaffolded apps can inspect and reset saved window state

### Launch-Ready Preset

- Expanded `forge create --preset launch-ready` to include `windowing`
- Updated the CLI docs to reflect the fuller desktop-ready starter bundle

## 0.1.10 (2026-03-25)

### Notifications Feature Pack

- Added a `notifications` scaffold feature pack for the `minimal` starter
- Generated apps can now expose native desktop notifications through preload and main-process IPC
- Added a starter notifications panel to `FeatureStudio` so new apps can test reminder and completion flows immediately

### Launch-Ready Preset

- Expanded `forge create --preset launch-ready` to include `notifications`
- Updated CLI and docs surfaces so the production starter preset reflects the full release-oriented feature bundle

## 0.1.9 (2026-03-25)

### Launch-Ready Starter

- Added `forge create --preset launch-ready` to bundle `settings`, `updater`, `jobs`, `plugins`, and `diagnostics`
- Added `forge create --list-presets` so starter presets can be discovered directly from the CLI
- Added a new `diagnostics` feature pack that seeds IPC handlers, preload bindings, and an in-app diagnostics panel with support bundle export

### Scaffold Reliability

- Fixed scaffold naming so absolute or nested output paths now derive the generated app identity from the target directory name instead of the full path
- Updated scaffold verification to generate the launch-ready preset app during release gating
- Extended IPC contract channel coverage for diagnostics flows used by generated desktop apps

## 0.1.8 (2026-03-25)

### Release Verification

- Extended scaffold build verification to run `pnpm setup:python` and `pnpm build:worker` on the minimal starter before any version bump
- Added worker binary existence checks so releases fail if the generated Python runtime does not bundle successfully
- Updated the release script to enforce the stronger scaffold verification before bumping the workspace

## 0.1.7 (2026-03-25)

### Scaffold Release Metadata

- Added `forge create --product-name`, `--app-id`, `--github-owner`, and `--github-repo`
- Scaffolded apps now seed `electron-builder.yml`, `.env.example`, README release identity, and release playbook content from the provided metadata
- Feature-pack runtime shell and seeded plugin registry now use the configured product name

### CI Guard

- Updated GitHub Actions CI to run `pnpm scaffold:test` on Ubuntu so scaffold regressions are caught before release

## 0.1.6 (2026-03-25)

### Release Guard

- Added `scripts/test-scaffold-builds.sh` to verify scaffolded `minimal` apps before release
- The scaffold test now generates both a base starter and a feature-pack starter, then runs `install`, `release:check`, `typecheck`, and `build`
- `scripts/release.sh` now runs scaffold build verification before any version bump
- Added `pnpm scaffold:test` so scaffold verification can be run directly from the repo root

### Reliability

- Fixed feature-pack scaffold typing so the generated runtime shell passes `typecheck` before release verification
- Updated repo operating guidance to require scaffold build verification before version bumps

## 0.1.5 (2026-03-25)

### Minimal Feature Packs

- Added `forge create --feature <id>` and `forge create --list-features`
- The `minimal` starter can now scaffold `settings`, `updater`, `jobs`, and `plugins` packs in one pass
- Feature-pack scaffolds now rewrite `electron/main.ts` and `electron/preload.ts` for Forge settings, updater, and job IPC flows
- Feature-pack scaffolds now generate `src/forge/FeatureStudio.tsx` and sample plugin registry content for the runtime shell

### Docs

- Updated repo, getting started, deployment, and CLI docs to show feature-pack usage on the `minimal` starter

## 0.1.4 (2026-03-25)

### Release Automation In Scaffolds

- Scaffolded apps now include `.github/workflows/validate.yml` for install, typecheck, worker build, and app build checks
- Scaffolded apps now include `.github/workflows/release.yml` for tagged multi-platform publishing with Electron Builder
- Generated projects now include `.env.example`, `docs/release-playbook.md`, and `scripts/preflight-release.sh`
- Generated app `package.json` files now include `pnpm release:check`

### Scaffold Reliability

- `create-forge-desktop` now injects release-only Forge dependencies using the framework version directly instead of inferring from another package
- Verified the renderer foundation layer now writes `ForgeAppShell` with the correct `APP_NAME` binding in generated apps

### Docs

- Updated repo, getting started, deployment, and CLI docs to describe release preflight and generated CI workflows

## 0.1.3 (2026-03-25)

### Release-Ready Scaffolds

- Scaffolded apps now receive a default `electron-builder.yml` and `electron-builder.s3.yml`
- Generated apps now include `build/entitlements.mac.plist`
- Added generated helper scripts for Python setup, worker bundling, and desktop packaging
- Generated app `package.json` files now include `pnpm setup:python`, `pnpm build:worker`, `pnpm build:app`, and `pnpm package`

### Standalone Python Runtime

- Scaffolded apps now vendor `worker/forge_worker` directly so the worker runtime ships with the project
- Generated `worker/requirements.txt` files now focus on optional Python dependencies instead of monorepo-only install hints

### Docs

- Updated repo and CLI docs to describe the new release preset and vendored runtime flow

## 0.1.2 (2026-03-25)

### Scaffolding UX

- Added `forge doctor` to check Node, Python, and pip readiness
- Added `forge create --list` and `forge create --yes` for faster template discovery and non-interactive creation
- Improved post-create guidance to include Python dependency installation
- Rewrote generated project `README.md` files to be project-focused instead of example-focused
- Rewrote generated `worker/requirements.txt` files to pin `forge-worker-runtime` to the framework version

### Versioning And Release Reliability

- Extended release and version checks to include the Python worker runtime package metadata
- Added automatic workspace version verification after version bumps
- Bumped the full workspace to `0.1.2`

## 0.1.1 (2026-03-25)

### Framework Productization

- Added repo-level Codex operating context via `AGENTS.md` and `.codex/` playbooks
- Rewrote onboarding docs to distinguish the stable monorepo path from the scaffold CLI preview
- Added a dedicated `packages/create-forge-app/README.md`

### CLI And Release Flow

- Fixed `create-forge-app` release version updates to cover workspace packages consistently
- Fixed publish path handling to use `apps/app/release`
- Corrected deployment docs to match the real packaging output path

### Package Distribution Readiness

- Prepared core `@forge/*` packages for external distribution with publish-ready manifest metadata
- Added package-level README files for the core packages
- Fixed TypeScript declaration output reliability by switching package builds to `tsc -b --force`
- Excluded package test sources from published build output

### Versioning

- Aligned the release script with `examples/*` so framework version bumps now update the full workspace

## 0.1.0 (2026-03-24)

### Initial Release

**Framework Core**
- 12 TypeScript packages: ipc-contract, logger, worker-client, job-engine, project-core, resource-manager, settings-core, ui-kit (18 components), plugin-system, error-handler, updater
- 1 Python package: forge-worker-runtime (pip installable)
- forge-cli: `forge create`, `forge build`, `forge release`, `forge publish`, `forge dev`

**App Structure**
- `apps/app/` — Electron desktop app with React 19 + Tailwind CSS v4
- `apps/worker/` — Python worker with stdin/stdout JSON IPC
- Custom frameless titlebar, collapsible sidebar, dashboard, worker console
- Dark mode auto-detection, smooth animations

**Examples (9)**
- minimal, file-processor, ai-tool, video-tools, dashboard, multi-module, chat, webrtc-demo, webgpu-compute

**DevOps**
- GitHub Actions CI (build + typecheck + prettier + python tests)
- GitHub Actions Release (multi-platform build + code signing + auto-publish)
- Dual update providers: GitHub Releases + S3/R2
- Auto-updater integration (electron-updater)
- Code signing docs (macOS notarization + Windows)

**DX**
- CLAUDE.md + 7 Claude Code skills (version-bump, ship, new-package, new-action, new-example, add-component, dev)
- Comprehensive docs: IPC patterns, code signing, deployment
- CONTRIBUTING.md, CODE_OF_CONDUCT.md
