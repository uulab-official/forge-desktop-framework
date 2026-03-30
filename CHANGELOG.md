# Changelog

## 0.1.54 (2026-03-30)

### Rollback Execution Playbook

- Added `scripts/generate-rollback-playbook.sh` and `scripts/test-rollback-playbook.sh` so Forge can generate a per-platform rollback execution checklist from packaged installers, updater manifests, rollback readiness data, and optional S3 channel parity metadata
- Wired rollback playbook smoke into `scripts/release.sh`, added root `pnpm release:playbook:test`, and made the tagged release workflow upload `rollback-playbook.md/json` for GitHub release output plus S3 parity output when enabled
- Documented the new rollback playbook layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the new `v0.1.54` release checklist

## 0.1.53 (2026-03-30)

### Publish Channel Parity

- Added `scripts/audit-publish-channel-parity.sh` and `scripts/test-publish-channel-parity.sh` so Forge can fail when GitHub and S3 release outputs disagree on installer filenames or updater manifest target paths for the tagged version
- Wired publish channel parity into `scripts/release.sh`, added root `pnpm release:channels:test`, and made the tagged release workflow snapshot GitHub output, compare it against the S3 packaging pass, and upload `channel-parity.md/json` when `S3_ENABLED=true`
- Documented the new parity layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the new `v0.1.53` release checklist

## 0.1.52 (2026-03-30)

### Versioned Release Checklists

- Added `scripts/create-release-checklist.sh` and `scripts/verify-release-checklist.sh` so maintainers can bootstrap the next `docs/release-checklists/vX.Y.Z.md` file and block shipping until it is marked `ready`
- Wired checklist verification into `scripts/release.sh`, added root `pnpm release:checklist:prepare` plus `pnpm release:checklist:verify`, and committed the first tracked checklist at `docs/release-checklists/v0.1.52.md`
- Documented the versioned checklist workflow in the repo README, deployment guide, CLI package README, AGENTS notes, and Codex project notes

## 0.1.51 (2026-03-30)

### Rollback Readiness

- Added `scripts/audit-rollback-readiness.sh` and `scripts/test-rollback-readiness-audit.sh` so tagged releases fail if platform inventories do not carry versioned installers, updater manifests, and the audit metadata needed to roll a `latest` channel back to a known-good version
- Wired rollback readiness into `scripts/release.sh`, added root `pnpm release:rollback:test`, and made the tagged workflow upload `rollback-readiness.md` plus `rollback-readiness.json`
- Extended matrix summary and provenance layers so rollback readiness now participates in aggregated release health reporting

## 0.1.50 (2026-03-30)

### Release Manifest Consistency

- Added `scripts/audit-release-manifests.sh` and `scripts/test-release-manifest-audit.sh` so Forge can validate `latest*.yml` version, target path, and `sha512` consistency against packaged files
- Wired manifest audit smoke into `scripts/release.sh`, added root `pnpm release:manifests:test`, and made the tagged workflow upload `manifest-audit.md` plus `manifest-audit.json`
- Extended matrix summary and provenance layers so manifest consistency now participates in aggregated release health reporting

## 0.1.49 (2026-03-30)

### Release Provenance

- Added `scripts/generate-release-provenance.sh` and `scripts/test-release-provenance.sh` so Forge can derive a traceable release record from tag, commit SHA, version, and matrix outputs
- Wired provenance smoke into `scripts/release.sh`, added root `pnpm release:provenance:test`, and made the tagged workflow upload `release-provenance.md` plus `release-provenance.json`
- Documented the new provenance layer in the repo README, deployment guide, AGENTS notes, Codex notes, and CLI package README

## 0.1.48 (2026-03-30)

### Release Matrix Summary

- Added `scripts/summarize-release-matrix.sh` and `scripts/test-release-matrix-summary.sh` so Forge can aggregate per-platform release inventories into one matrix-level summary
- Wired release matrix summary smoke into `scripts/release.sh`, added root `pnpm release:matrix:test`, and added a tagged workflow follow-up job that uploads `release-matrix-summary.md` plus `release-matrix-summary.json`
- Documented the new matrix summary layer in the repo README, deployment guide, AGENTS notes, Codex notes, and CLI package README

## 0.1.47 (2026-03-29)

### Signing Readiness Audit

- Added `scripts/audit-signing-readiness.sh` and `scripts/test-signing-readiness-audit.sh` so Forge can validate mac notarization and Windows signing env requirements before packaging starts
- Wired signing readiness smoke into `scripts/release.sh`, added root `pnpm release:signing:test`, and made the tagged release workflow upload `signing-readiness.md` plus `signing-readiness.json`
- Documented the new signing readiness gate in the repo README, deployment guide, AGENTS notes, Codex notes, and CLI package README

## 0.1.46 (2026-03-29)

### Publish Artifact Audit

- Added `scripts/audit-published-artifacts.sh` and `scripts/test-release-artifact-audit.sh` so Forge can validate platform-specific release output expectations before and during tagged publishing
- Updated `scripts/release.sh` and root package scripts so maintainers now smoke-test publish artifact auditing before any version bump
- Updated `.github/workflows/release.yml` to fail when packaged outputs miss their platform installer or `latest*.yml` manifest, and to upload `publish-audit.md` plus `publish-audit.json` alongside the release inventory files
- Documented the publish artifact audit path in the repo README, deployment guide, AGENTS notes, Codex notes, and CLI package README

## 0.1.45 (2026-03-29)

### Release Artifact Inventory

- Added `scripts/summarize-release-artifacts.sh` so Forge can produce markdown and JSON inventories from a populated `release/` directory
- Updated `.github/workflows/release.yml` to append packaged-artifact summaries to the workflow summary and upload `artifact-summary.md`, `artifact-summary.json`, and `latest*.yml` per matrix job
- Documented the new release artifact inventory path in the repo README, deployment guide, and CLI package README

## 0.1.44 (2026-03-29)

### Release Readiness CI

- Added a dedicated Ubuntu `release-readiness` job to `.github/workflows/ci.yml` so pull requests now run repo-outside scaffold verification with `pnpm scaffold:external:test`
- Added `pnpm release:audit` to CI so official preset release files, scripts, and workflows are checked before merge instead of only during maintainer release
- Documented the CI release-readiness guard in the repo README, deployment guide, Codex notes, and CLI package README

## 0.1.43 (2026-03-29)

### Release Surface Audit

- Added `scripts/audit-release-surfaces.sh` and `pnpm release:audit` so maintainers can scaffold the official presets and verify their release files, workflows, env templates, and package scripts before shipping
- Wired official preset release-surface auditing into `scripts/release.sh` so `release:ship` now blocks version bumps when `launch-ready`, `support-ready`, `ops-ready`, or `document-ready` lose required packaging or publish surface
- Documented the new maintainer audit step in the repo README, deployment guide, Codex notes, and CLI package README

## 0.1.42 (2026-03-29)

### Package Audit

- Added generated-app package manifest auditing with `scripts/audit-package-output.sh`, `pnpm package:audit`, and `pnpm package:audit:s3`
- Extended local release guidance so packaged outputs are checked for installer presence and manifest/version/path consistency
- Extended in-repo and external scaffold verification to exercise package auditing on generated apps

## 0.1.41 (2026-03-29)

### Package Verification

- Added generated-app package artifact verification with `scripts/verify-package-output.sh`, `pnpm package:verify`, and `pnpm package:verify:s3`
- Updated generated release guidance so local packaging flows explicitly check installer and `latest*.yml` outputs after `electron-builder`
- Extended in-repo and external scaffold verification to exercise package-output verification on generated apps

## 0.1.40 (2026-03-29)

### Publish Preflight

- Added generated-app publish preflight support with `scripts/check-publish-env.sh`, `pnpm publish:check:github`, and `pnpm publish:check:s3`
- Wired publish preflight into generated release guidance and the generated GitHub release workflow so missing publish credentials fail before packaging
- Extended in-repo and external scaffold verification to exercise publish-target preflight on generated apps

## 0.1.39 (2026-03-29)

### Release Automation

- Added `scripts/ship-release.sh` to run framework verification, version bumping, commit creation, annotated tagging, and `origin` push as one clean maintainer flow
- Added `pnpm release:bump` and `pnpm release:ship` so the framework repo has official manual and one-command shipping entry points
- Documented the maintainer release path in the repo README, deployment guide, and Codex operating notes

## 0.1.38 (2026-03-29)

### Document-Ready Preset

- Added a `document-ready` scaffold preset for the `minimal` starter
- Generated apps can now seed `file-association`, `file-dialogs`, `recent-files`, `windowing`, and `menu-bar` in one preset for document-based desktop workflows
- Kept `document-ready` focused on file-centric shell behavior so it complements the release, support, and ops presets without widening those default surfaces

### Release Verification

- Extended both in-repo and external scaffold verification to generate, install, typecheck, and build a dedicated document-ready smoke app before any version bump

## 0.1.37 (2026-03-29)

### Ops-Ready Preset

- Added an `ops-ready` scaffold preset for the `minimal` starter
- Generated apps can now seed `diagnostics`, `support-bundle`, `crash-recovery`, `system-info`, `network-status`, `power-monitor`, `idle-presence`, and `session-state` in one preset for runtime operations and observability workflows
- Kept `ops-ready` focused on live shell diagnostics so it complements `launch-ready` and `support-ready` instead of duplicating their release or escalation surfaces

### Release Verification

- Extended both in-repo and external scaffold verification to generate, install, typecheck, and build a dedicated ops-ready smoke app before any version bump

## 0.1.36 (2026-03-29)

### External Scaffold Verification

- Added `scripts/test-external-scaffold.sh` to validate repo-outside Forge app creation with packed `create-forge-desktop` and local tarballed `@forge/*` packages
- External verification now scaffolds `launch-ready` and `support-ready` starters outside the monorepo, installs without workspace links, and verifies release preflight, typecheck, and build flows
- Extended the `launch-ready` external smoke to run `setup:python` and `build:worker` so the vendored worker runtime is exercised outside the workspace as part of the release path

### Release Verification

- The release workflow now runs both in-repo scaffold verification and external scaffold verification before any version bump

## 0.1.35 (2026-03-29)

### Support-Ready Preset

- Added a `support-ready` scaffold preset for the `minimal` starter
- Generated apps can now seed `support-bundle`, `log-archive`, `incident-report`, and `diagnostics-timeline` in one preset for support and QA investigation workflows
- Kept the preset focused on operations and escalation tooling so teams can start with a coherent support surface instead of stitching those packs together by hand

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated support-ready smoke app before any version bump

## 0.1.34 (2026-03-28)

### Diagnostics-Timeline Feature Pack

- Added a `diagnostics-timeline` scaffold feature pack for the `minimal` starter
- Generated apps now collect a structured desktop event timeline, expose refresh, export, reveal, and clear controls in `FeatureStudio`, and emit JSON timeline handoff files into the support folder
- Kept `diagnostics-timeline` optional so teams can add support investigation history deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated diagnostics-timeline smoke app before any version bump

## 0.1.33 (2026-03-26)

### Incident-Report Feature Pack

- Added an `incident-report` scaffold feature pack for the `minimal` starter
- Generated apps now draft support-ready desktop escalation payloads with severity, affected area, repro steps, expected and actual behavior, recommended action, and JSON export or reveal controls in `FeatureStudio`
- Kept `incident-report` optional so teams can add structured escalation handoff deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated incident-report smoke app before any version bump

## 0.1.32 (2026-03-26)

### Log-Archive Feature Pack

- Added a `log-archive` scaffold feature pack for the `minimal` starter
- Generated apps now snapshot the runtime logs directory into timestamped support folders, emit a manifest, and surface refresh, export, and reveal controls in `FeatureStudio`
- Kept `log-archive` optional so teams can add desktop evidence handoff deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated log-archive smoke app before any version bump

## 0.1.31 (2026-03-26)

### Support-Bundle Feature Pack

- Added a `support-bundle` scaffold feature pack for the `minimal` starter
- Generated apps now export structured JSON support bundles over preload IPC and surface last-export path, included sections, size, and reveal controls in `FeatureStudio`
- Kept `support-bundle` optional so teams can add support handoff tooling deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated support-bundle smoke app before any version bump

## 0.1.30 (2026-03-26)

### Session-State Feature Pack

- Added a `session-state` scaffold feature pack for the `minimal` starter
- Generated apps now expose starter app lifecycle, focus, visibility, and foreground-background event history over preload IPC and surface refreshable session diagnostics in `FeatureStudio`
- Kept `session-state` optional so teams can add shell lifecycle diagnostics deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated session-state smoke app before any version bump

## 0.1.29 (2026-03-25)

### Idle-Presence Feature Pack

- Added an `idle-presence` scaffold feature pack for the `minimal` starter
- Generated apps now expose starter user activity, lock state, and window attention diagnostics over preload IPC and surface refreshable idle presence history in `FeatureStudio`
- Kept `idle-presence` optional so teams can add attention-aware desktop diagnostics deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated idle-presence smoke app before any version bump

## 0.1.28 (2026-03-25)

### Secure-Storage Feature Pack

- Added a `secure-storage` scaffold feature pack for the `minimal` starter
- Generated apps now expose Electron `safeStorage` secret save, load, and clear controls over preload IPC and surface encrypted secret diagnostics in `FeatureStudio`
- Kept `secure-storage` optional so teams can add local secret persistence deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated secure-storage smoke app before any version bump

## 0.1.27 (2026-03-25)

### Network-Status Feature Pack

- Added a `network-status` scaffold feature pack for the `minimal` starter
- Generated apps now expose starter online and offline diagnostics over preload IPC and surface refreshable connectivity history in `FeatureStudio`
- Kept `network-status` optional so teams can add connectivity diagnostics deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated network-status smoke app before any version bump

## 0.1.26 (2026-03-25)

### Permissions Feature Pack

- Added a `permissions` scaffold feature pack for the `minimal` starter
- Generated apps now expose camera, microphone, and screen permission diagnostics over preload IPC and surface requestable starter controls in `FeatureStudio`
- Kept `permissions` optional so teams can add privacy diagnostics deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated permissions smoke app before any version bump

## 0.1.25 (2026-03-25)

### System-Info Feature Pack

- Added a `system-info` scaffold feature pack for the `minimal` starter
- Generated apps now expose live OS, memory, process, and path diagnostics over preload IPC and surface refreshable runtime environment details in `FeatureStudio`
- Kept `system-info` optional so teams can add richer support and QA instrumentation without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated system-info smoke app before any version bump

## 0.1.24 (2026-03-25)

### External-Links Feature Pack

- Added an `external-links` scaffold feature pack for the `minimal` starter
- Generated apps now expose `shell.openExternal` over preload IPC and surface starter open history plus error tracking in `FeatureStudio`
- Kept `external-links` optional so teams can add browser, mail, or protocol launch flows deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated external-links smoke app before any version bump

## 0.1.23 (2026-03-25)

### Clipboard Feature Pack

- Added a `clipboard` scaffold feature pack for the `minimal` starter
- Generated apps now expose clipboard text read, write, and clear controls over preload IPC and surface clipboard history in `FeatureStudio`
- Kept `clipboard` optional so teams can add copy and paste flows deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated clipboard smoke app before any version bump

## 0.1.22 (2026-03-25)

### Downloads Feature Pack

- Added a `downloads` scaffold feature pack for the `minimal` starter
- Generated apps now track download progress through Electron session events, expose starter start, reveal, and clear-history controls over preload IPC, and surface download history in `FeatureStudio`
- Kept `downloads` optional so teams can adopt file transfer behavior deliberately without widening the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated downloads smoke app before any version bump

## 0.1.21 (2026-03-25)

### Power-Monitor Feature Pack

- Added a `power-monitor` scaffold feature pack for the `minimal` starter
- Generated apps now expose suspend, resume, lock-screen, unlock-screen, and power-source lifecycle tracking through preload IPC and `FeatureStudio`
- Kept `power-monitor` optional so teams can add device lifecycle monitoring deliberately without expanding the default production preset

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated power-monitor smoke app before any version bump

## 0.1.20 (2026-03-25)

### Crash-Recovery Feature Pack

- Added a `crash-recovery` scaffold feature pack for the `minimal` starter
- Generated apps now persist the last renderer, window unresponsive, or child-process incident under user data, expose starter clear and relaunch controls over preload IPC, and surface recovery status in `FeatureStudio`
- Kept `crash-recovery` optional so teams can add incident tracking and relaunch flows without forcing recovery UI into every production starter

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated crash-recovery smoke app before any version bump

## 0.1.19 (2026-03-25)

### Recent-Files Feature Pack

- Added a `recent-files` scaffold feature pack for the `minimal` starter
- Generated apps now persist a recent document list under the desktop user data directory, expose starter reopen and clear controls through preload IPC, and surface the list in `FeatureStudio`
- Wired `recent-files` into `file-association` and `file-dialogs` so file opens and saves automatically populate the recent document registry when those packs are enabled together

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated recent-files smoke app before any version bump

## 0.1.18 (2026-03-25)

### File-Dialogs Feature Pack

- Added a `file-dialogs` scaffold feature pack for the `minimal` starter
- Generated apps now expose native open and save dialogs plus reveal-in-folder controls through preload IPC so desktop file workflows can be tested immediately from `FeatureStudio`
- Kept `file-dialogs` optional so teams can adopt desktop shell file workflows without forcing native dialog wiring into every production starter

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated file-dialogs smoke app before any version bump

## 0.1.17 (2026-03-25)

### File-Association Feature Pack

- Added a `file-association` scaffold feature pack for the `minimal` starter
- Generated apps now capture starter document opens through main-process handlers, expose file association state over preload IPC, and surface file-open inspection controls in `FeatureStudio`
- Seeded packaged app metadata with a sample `electron-builder` `fileAssociations` entry so starter document types are wired into the release baseline

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated file-association smoke app before any version bump

## 0.1.16 (2026-03-25)

### Global-Shortcut Feature Pack

- Added a `global-shortcut` scaffold feature pack for the `minimal` starter
- Generated apps now register a starter system-wide shortcut, expose registration state over preload IPC, and surface focus or restore controls in `FeatureStudio`
- Kept `global-shortcut` optional so teams can adopt it deliberately without forcing a default accelerator into every production starter

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated global-shortcut smoke app before any version bump

## 0.1.15 (2026-03-25)

### Auto-Launch Feature Pack

- Added an `auto-launch` scaffold feature pack for the `minimal` starter
- Generated apps now expose login-item status and on/off controls through preload IPC so packaged desktop apps can toggle start-on-login from `FeatureStudio`
- Kept `auto-launch` optional so launch behavior remains product-specific while still shipping as a first-party starter capability

### Release Verification

- Extended scaffold verification to generate, install, typecheck, and build a dedicated auto-launch smoke app before any version bump

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
