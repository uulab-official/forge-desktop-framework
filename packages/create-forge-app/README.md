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
- generated apps now also get GitHub Actions release workflows, `.env.example`, release preflight, and publish-target preflight scripts
- generated apps now also get packaged-artifact verification and audit scripts so local packaging can fail fast when release outputs or manifests are incomplete
- official presets are now covered by a maintainer release-surface audit before the framework version can move
- the repo CI now also exercises repo-outside scaffold installs and official preset release-surface audit on Ubuntu before changes merge
- the repo release workflow now uploads per-platform packaged-artifact inventories so maintainers can inspect release output without opening runner files directly
- the repo release workflow now also fails if a matrix job misses its platform installer or `latest*.yml` manifest after packaging
- the repo release workflow now also fails if a matrix job writes a `latest*.yml` manifest with the wrong version, a missing target file, or no `sha512`
- the repo release workflow now also fails if a platform inventory is not rollback-ready, including non-versioned installer names or missing audit metadata required to repoint a `latest` channel
- the repo release workflow now also uploads `rollback-playbook.md/json` so maintainers get a generated rollback execution checklist per platform and publish channel
- when S3 publishing is enabled, the repo release workflow now also fails if GitHub and S3 package outputs disagree on installer filenames or updater manifest targets for the tagged version
- the repo release workflow now also fails if rollback playbooks and publish-channel metadata disagree about whether a platform is GitHub-only or GitHub plus S3 recoverable
- maintainers can now also run a rollback drill against archived prior-release metadata to confirm a candidate rollback version still satisfies the generated playbook
- tagged releases now also upload a standardized release inventory bundle so archived rollback drill inputs can be stored and handed back to maintainers without rebuilding the audit set by hand
- maintainers can now also retrieve that archived bundle directly for rollback drills instead of reconstructing inputs from individual audit files
- the release matrix follow-up now also emits a release bundle index so archived bundle discovery is explicit before retrieval
- maintainers can now also aggregate multiple fetched tag directories into a release history index before choosing a recovery path
- maintainers can now also auto-select the newest valid archived rollback target from that bundle index before retrieval or drill execution
- maintainers can now also prepare a rollback bundle straight from that accumulated history root, so target selection and archived retrieval no longer need separate manual steps
- maintainers can now also fetch archived bundles straight from tagged GitHub Actions artifacts with `gh` before local retrieval or rollback drills
- maintainers can now also fetch several recent GitHub or S3 tags into one local history root and prepare the rollback bundle from that remote history without manually staging each tag
- maintainers can now also run a provider-agnostic remote rollback drill command that fetches history, prepares the rollback bundle, and executes the drill in one pass
- that final remote rollback drill output now also includes `recovery-command-summary.md/json`, which captures the chosen rollback target, rerun command, archived assets, and operator follow-up actions
- tagged release metadata now also includes `release-status.md/json`, which condenses the 1.0 gate, matrix targets, provenance, and official preset readiness into one release health artifact
- tagged release metadata now also includes `one-point-zero-freeze.md/json`, which turns the release-status artifact and version checklist into one explicit freeze decision record
- tagged release metadata now also includes `one-point-zero-decision.md/json`, which turns readiness, release-status, and freeze into one final maintainer 1.0 decision artifact
- tagged release metadata now also includes `one-point-zero-release-candidate.md/json`, which turns that final decision into one explicit `1.0.0` promotion handoff for maintainers
- maintainers can now also turn that release-candidate artifact into a prefilled `v1.0.0` checklist draft with `scripts/prepare-one-point-zero-major-checklist.sh`
- tagged release metadata now also includes `one-point-zero-promotion-plan.md/json`, which turns the release-candidate artifact plus the generated `v1.0.0` checklist draft into one explicit first-major-release staging plan
- when S3 publishing is enabled, the repo release workflow now also mirrors that archived bundle cache to object storage so maintainers can fetch rollback inputs with `aws`
- the Ubuntu `release-readiness` CI job now also exercises rollback target selection so release recovery helpers regress before `release:ship`, not after
- the Ubuntu `release-readiness` CI job now also exercises release history indexing so multi-tag recovery helpers stay healthy before `release:ship`
- the Ubuntu `release-readiness` CI job now also exercises history-root rollback preparation so selection and retrieval stay wired together before `release:ship`
- the Ubuntu `release-readiness` CI job now also exercises remote-history rollback preparation so GitHub and S3 recovery wrappers stay wired before `release:ship`
- the Ubuntu `release-readiness` CI job now also exercises the provider-agnostic remote rollback drill wrapper so final maintainer recovery flows regress before `release:ship`
- the repo release workflow now also fails early if a matrix job is missing mac notarization or Windows signing secrets before packaging starts
- the repo release workflow now also uploads a final `release-matrix-summary.md/json` artifact that aggregates all platform inventories
- the repo release workflow now also uploads `release-provenance.md/json` so maintainers can map tag, commit, version, and platform outputs back to one release record
- framework releases now also require a versioned checklist under `docs/release-checklists/vX.Y.Z.md` before `release:ship` can move the version
- Forge 1.0 release gate criteria are now fixed in `docs/one-point-zero-gate.md`, and maintainers can validate that contract with `pnpm release:onepointzero:test`
- maintainers can now also validate the final 1.0 decision artifact with `pnpm release:decision:test`
- maintainers can now also validate the final 1.0 release-candidate handoff with `pnpm release:rc:test`
- maintainers can now also validate the 1.0 major checklist helper with `pnpm release:major:prepare:test`
- maintainers can now also validate the final 1.0 promotion-plan handoff with `pnpm release:promotion:test`

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

Preset creation for the production starter:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal \
  --preset launch-ready
```

Preset creation for the support and QA investigation starter:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal \
  --preset support-ready
```

Preset creation for the runtime operations starter:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal \
  --preset ops-ready
```

Preset creation for the document workflow starter:

```bash
cd packages/create-forge-app
node dist/index.js create my-forge-app --template minimal \
  --preset document-ready
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
- `scripts/setup-python.sh`, `scripts/build-worker.sh`, `scripts/build-app.sh`, `scripts/preflight-release.sh`, `scripts/check-publish-env.sh`, `scripts/verify-package-output.sh`, `scripts/audit-package-output.sh`
- package scripts for `pnpm release:check`, `pnpm publish:check:github`, `pnpm publish:check:s3`, `pnpm package:verify`, `pnpm package:verify:s3`, `pnpm package:audit`, `pnpm package:audit:s3`, `pnpm publish:github`, `pnpm publish:s3`, `pnpm setup:python`, `pnpm build:worker`, and `pnpm package`
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

Starter presets currently target the `minimal` template:
- `launch-ready` bundles `settings`, `updater`, `jobs`, `plugins`, `diagnostics`, `notifications`, `windowing`, and `menu-bar`
- `support-ready` bundles `support-bundle`, `log-archive`, `incident-report`, and `diagnostics-timeline`
- `ops-ready` bundles `diagnostics`, `support-bundle`, `crash-recovery`, `system-info`, `network-status`, `power-monitor`, `idle-presence`, and `session-state`
- `document-ready` bundles `file-association`, `file-dialogs`, `recent-files`, `windowing`, and `menu-bar`

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
