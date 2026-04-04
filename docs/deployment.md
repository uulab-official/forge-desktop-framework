# Forge Desktop Framework — Deployment Guide

This guide covers building, releasing, and publishing Forge Desktop apps using the `create-forge-desktop` and GitHub Actions.

## Prerequisites

- **Node.js 20+** and **pnpm 10+**
- **Python 3.12+** with `pip`
- **Git** with push access to your GitHub repository
- **AWS CLI** (only if publishing to S3/R2)

### Code Signing (optional but recommended for production)

- **macOS**: Apple Developer certificate (Developer ID Application), exported as `.p12`
- **Windows**: Code signing certificate (`.pfx` or `.p12`)
- **Apple Notarization**: Apple ID with app-specific password and Team ID

## CLI Commands

Install the CLI globally or use it from the monorepo:

```bash
# From monorepo
pnpm --filter create-forge-desktop build
npx forge --help

# Or install globally
npm install -g create-forge-desktop
```

### Available Commands

| Command | Description |
|---------|-------------|
| `forge create [name]` | Scaffold a new Forge app from a template |
| `forge build` | Build packages, Python worker, and Electron app |
| `forge release [type]` | Bump version, create git commit and tag |
| `forge publish` | Build and publish to GitHub Releases |
| `forge publish --s3` | Build and publish to S3/R2 |
| `forge dev [target]` | Start development mode |

Scaffolded apps now include baseline packaging files:
- `electron-builder.yml`
- `electron-builder.s3.yml`
- `build/entitlements.mac.plist`
- `.env.example`
- `.github/workflows/validate.yml`
- `.github/workflows/release.yml`
- `docs/release-playbook.md`
- `scripts/setup-python.sh`
- `scripts/build-worker.sh`
- `scripts/build-app.sh`
- `scripts/preflight-release.sh`

Scaffolded apps also include:
- `pnpm release:check` for local release preflight
- `pnpm security:check` for Electron shell hardening and preload-bridge baseline checks
- `pnpm ops:check` for runtime log-retention and crash-dump-retention baseline checks
- `pnpm publish:check:github` and `pnpm publish:check:s3` for publish-target preflight
- `pnpm package:verify` and `pnpm package:verify:s3` for packaged artifact verification
- `pnpm package:audit` and `pnpm package:audit:s3` for manifest-to-artifact audit checks
- tagged GitHub Actions publishing via `.github/workflows/release.yml`

The `minimal` starter also supports feature packs during scaffolding:

```bash
forge create my-app --template minimal --feature settings --feature updater --feature diagnostics --feature notifications --feature windowing --feature tray --feature deep-link --feature menu-bar --feature auto-launch --feature global-shortcut --feature file-association --feature file-dialogs --feature recent-files --feature crash-recovery --feature power-monitor --feature idle-presence --feature session-state --feature downloads --feature clipboard --feature external-links --feature system-info --feature permissions --feature network-status --feature secure-storage --feature support-bundle --feature log-archive --feature incident-report --feature diagnostics-timeline
```

For the fastest production-grade baseline, use the preset:

```bash
forge create my-app --template minimal --preset production-ready
```

Generated `production-ready` apps now also include `pnpm security:check`, `pnpm ops:check`, `pnpm production:check`, `pnpm production:check:s3`, and `pnpm production:check:all` so teams can rerun Electron shell hardening checks, runtime hygiene checks, release, worker, build, publish-env, and packaged-artifact checks from one command.

If you only want the launch-focused desktop shell baseline, use:

```bash
forge create my-app --template minimal --preset launch-ready
```

For the fastest support and QA investigation baseline, use:

```bash
forge create my-app --template minimal --preset support-ready
```

For the fastest runtime operations baseline, use:

```bash
forge create my-app --template minimal --preset ops-ready
```

For the fastest document workflow baseline, use:

```bash
forge create my-app --template minimal --preset document-ready
```

Use `--feature file-association` when your desktop product needs starter file-open handling and sample `electron-builder` `fileAssociations` metadata for packaged document types.

Use `--feature file-dialogs` when your desktop product needs first-party open and save dialogs plus a starter reveal-in-folder flow without wiring native Electron shell APIs by hand.

Use `--feature recent-files` when your desktop product needs a persistent recent document list and wants file dialogs or file associations to feed that list automatically.

Use `--feature crash-recovery` when your desktop product needs starter incident tracking for renderer or child-process failures and wants relaunch controls baked into the generated shell.

Use `--feature power-monitor` when your desktop product needs starter suspend, resume, lock, unlock, and power-source tracking for background work or device-lifecycle-sensitive flows.

Use `--feature idle-presence` when your desktop product needs starter user activity, lock state, and focused or hidden window diagnostics for attention-aware flows.

Use `--feature session-state` when your desktop product needs starter app lifecycle, foreground/background, focus, and visibility event history for shell-level diagnostics.

Use `--feature downloads` when your desktop product needs starter file download progress, history, and reveal-in-folder controls without wiring Electron session events by hand.

Use `--feature clipboard` when your desktop product needs starter copy and paste behavior with text read, write, clear, and history controls in the generated shell.

Use `--feature external-links` when your desktop product needs starter external browser, mail client, or protocol launch flows with history and error tracking in the generated shell.

Use `--feature system-info` when your desktop product needs live OS, memory, process, and path diagnostics in the generated shell for support, QA, or customer environment checks.

Use `--feature permissions` when your desktop product needs starter camera, microphone, or screen privacy diagnostics and wants request controls exposed in the generated shell on supported platforms.

Use `--feature network-status` when your desktop product needs starter online or offline diagnostics and wants a generated shell panel for connectivity-aware sync, retry, or degraded-mode UX.

Use `--feature secure-storage` when your desktop product needs starter Electron `safeStorage` encryption with save, load, clear, and error diagnostics for local secrets or app tokens.

Use `--feature support-bundle` when your desktop product needs a structured JSON handoff for support, QA, or customer escalations and wants export plus reveal controls wired into the generated shell.

Use `--feature log-archive` when your desktop product needs timestamped snapshots of the runtime logs directory and wants a generated shell panel that exports copied log evidence plus a manifest for bug reports.

Use `--feature incident-report` when your desktop product needs a structured escalation draft with severity, summary, repro steps, recommended action, and a support-ready JSON export path.

Use `--feature diagnostics-timeline` when your desktop product needs a structured event history that support or QA can export, clear, and inspect during incident investigations.

You can also seed release metadata up front:

```bash
forge create my-app --template minimal \
  --product-name "My App" \
  --app-id "com.acme.myapp" \
  --github-owner acme \
  --github-repo my-app
```

## Setting Up GitHub Actions Secrets

Navigate to your repository **Settings > Secrets and variables > Actions** and add:

### Required

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions |

### macOS Code Signing

| Secret | Description |
|--------|-------------|
| `CSC_LINK` | Base64-encoded `.p12` certificate |
| `CSC_KEY_PASSWORD` | Password for the `.p12` certificate |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password (generate at appleid.apple.com) |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

### Windows Code Signing

| Secret | Description |
|--------|-------------|
| `WIN_CSC_LINK` | Base64-encoded `.pfx` certificate |
| `WIN_CSC_KEY_PASSWORD` | Password for the `.pfx` certificate |

### S3/R2 Publishing (optional)

| Secret / Variable | Description |
|--------------------|-------------|
| `AWS_ACCESS_KEY_ID` | S3/R2 access key |
| `AWS_SECRET_ACCESS_KEY` | S3/R2 secret key |
| `S3_BUCKET` | Bucket name |
| `S3_ENDPOINT` | S3-compatible endpoint URL |
| `S3_UPDATE_URL` | Public URL for auto-update (e.g., `https://releases.example.com`) |
| `S3_ENABLED` (variable) | Set to `true` to enable S3 upload in CI |
| `AWS_REGION` (variable) | AWS region (default: `auto` for R2) |

To encode a certificate as base64:

```bash
base64 -i certificate.p12 | pbcopy  # macOS
base64 -w 0 certificate.p12         # Linux
```

## Local Deployment

### Build and Publish to GitHub

```bash
# 1. Bump version and tag
forge release patch    # or minor, major

# 2. Push to trigger CI
git push && git push --tags
```

The repo release script now runs scaffold verification before the version bump. If you want to run the same check manually first, use:

```bash
pnpm release:checklist:prepare patch
pnpm release:checklist:verify patch
pnpm scaffold:test
pnpm scaffold:external:test
pnpm release:audit
pnpm release:channels:test
pnpm release:recovery:test
pnpm release:drill:test
pnpm release:bundle:test
pnpm release:rollback:test
pnpm release:playbook:test
```

Every shipped version should also leave a checklist file under `docs/release-checklists/vX.Y.Z.md`. `pnpm release:ship patch` now fails early if that checklist is missing or not marked `ready`.

The release/version checks also cover `packages/create-forge-app/templates/*/package.json`, so the published CLI version and the distributable template copies stay aligned.
Forge 1.0 release gate criteria are now fixed in [docs/one-point-zero-gate.md](/Users/bonjin/Documents/workspace/uulab/forge-desktop-framework/docs/one-point-zero-gate.md), and `pnpm release:onepointzero:test` verifies that the repo, CI, and public docs still match that `1.0` contract before the version can move.
Maintainers can now also run `pnpm release:status:test` to verify the final release-status artifact that condenses the `1.0` gate, matrix targets, provenance, and official preset readiness into one summary.
Maintainers can now also run `pnpm release:freeze:test` to verify the final freeze artifact that combines that release-status summary with the per-version checklist into one explicit `go/no-go` record.
Maintainers can now also run `pnpm release:decision:test` to verify the final decision artifact that turns the readiness, release-status, and freeze layers into one explicit `1.0` handoff.
Maintainers can now also run `pnpm release:rc:test` to verify the final release-candidate artifact that points the current stable line at the `1.0.0` promotion path.
Maintainers can now also run `pnpm release:major:prepare:test` to verify the helper that turns that release-candidate artifact into a prefilled `v1.0.0` checklist draft.
Maintainers can now also run `pnpm release:promotion:test` to verify the final promotion-plan artifact that joins the release-candidate handoff with the generated `v1.0.0` checklist draft before a major ship.
Maintainers can now also run `pnpm release:major:runbook:test` to verify the final major-release runbook artifact that turns that promotion plan into the exact `1.0.0` ship sequence.
Maintainers can now also run `pnpm release:major:approval:test` to verify the final approval artifact that joins the `1.0` decision, promotion plan, and major-runbook layers into the last first-major-release handoff.
Maintainers can now also run `pnpm release:major:cockpit:test` to verify the final cockpit artifact that shows the whole `1.0.0` operator state from one place.
Maintainers can now also run `pnpm release:major:packet:test` to verify the final sign-off packet that joins the green cockpit summary with the prepared `v1.0.0` checklist.
Maintainers can now also run `pnpm release:major:signoff:test` to verify the final reviewer-facing signoff sheet for the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:board:test` to verify the final board-facing review artifact for the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:verdict:test` to verify the final maintainer go/no-go sheet for the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:authorization:test` to verify the final execution authorization sheet for the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:warrant:test` to verify the final launch-side warrant sheet for the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:launch-sheet:test` to verify the final operator-facing execution handoff for the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:command-card:test` to verify the final command-only execution card for the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:preflight:test` to verify the final preflight gate before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:trigger:test` to verify the final execution trigger before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:rehearsal:test` to verify the final dry-run rehearsal before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:go-live:test` to verify the final execution surface before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:activation:test` to verify the final execution confirmation surface before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:execution:test` to verify the final execution confirmation surface before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:attestation:test` to verify the final immutable attestation surface before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:seal:test` to verify the final immutable seal surface before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:charter:test` to verify the final immutable charter surface before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:canon:test` to verify the final immutable canon surface before the first `1.0.0` ship.
Maintainers can now also run `pnpm release:major:constitution:test`, `pnpm release:major:covenant:test`, `pnpm release:major:compact:test`, `pnpm release:major:capsule:test`, `pnpm release:major:ledger:test`, `pnpm release:major:archive:test`, `pnpm release:major:vault:test`, `pnpm release:major:registry:test`, `pnpm release:major:directory:test`, `pnpm release:major:manifest:test`, `pnpm release:major:dossier:test`, `pnpm release:major:folio:test`, `pnpm release:major:portfolio:test`, `pnpm release:major:compendium:test`, `pnpm release:major:anthology:test`, `pnpm release:major:omnibus:test`, `pnpm release:major:digest:test`, `pnpm release:major:synopsis:test`, `pnpm release:major:brief:test`, and `pnpm release:major:abstract:test` to verify the final immutable constitution, covenant, compact, capsule, ledger, archive, vault, registry, directory, manifest, dossier, folio, portfolio, compendium, anthology, omnibus, digest, synopsis, brief, and abstract surfaces before the first `1.0.0` ship.

The GitHub `CI` workflow now runs the same release-readiness stack on Ubuntu pull requests:
- `pnpm scaffold:test`
- `pnpm scaffold:external:test`
- `pnpm release:audit`
- `pnpm release:history:test`
- `pnpm release:rollback:target:test`
- `pnpm release:rollback:prepare:test`
- `pnpm release:history:remote:test`
- `pnpm release:rollback:remote:test`
- `pnpm release:onepointzero:test`
- `pnpm release:status:test`
- `pnpm release:freeze:test`
- `pnpm release:decision:test`
- `pnpm release:rc:test`
- `pnpm release:major:prepare:test`
- `pnpm release:promotion:test`
- `pnpm release:major:runbook:test`
- `pnpm release:major:approval:test`
- `pnpm release:major:cockpit:test`
- `pnpm release:major:packet:test`
- `pnpm release:major:signoff:test`
- `pnpm release:major:board:test`
- `pnpm release:major:verdict:test`
- `pnpm release:major:authorization:test`
- `pnpm release:major:warrant:test`
- `pnpm release:major:launch-sheet:test`
- `pnpm release:major:command-card:test`
- `pnpm release:major:preflight:test`
- `pnpm release:major:trigger:test`
- `pnpm release:major:rehearsal:test`
- `pnpm release:major:go-live:test`
- `pnpm release:major:activation:test`
- `pnpm release:major:execution:test`
- `pnpm release:major:attestation:test`
- `pnpm release:major:seal:test`
- `pnpm release:major:charter:test`
- `pnpm release:major:canon:test`
- `pnpm release:major:constitution:test`
- `pnpm release:major:covenant:test`
- `pnpm release:major:compact:test`
- `pnpm release:major:capsule:test`
- `pnpm release:major:ledger:test`
- `pnpm release:major:archive:test`
- `pnpm release:major:vault:test`
- `pnpm release:major:registry:test`
- `pnpm release:major:directory:test`
- `pnpm release:major:manifest:test`
- `pnpm release:major:dossier:test`
- `pnpm release:major:folio:test`
- `pnpm release:major:portfolio:test`
- `pnpm release:major:compendium:test`
- `pnpm release:major:anthology:test`
- `pnpm release:major:omnibus:test`
- `pnpm release:major:digest:test`
- `pnpm release:major:synopsis:test`
- `pnpm release:major:brief:test`
- `pnpm release:major:abstract:test`

The tagged `Release` workflow now also:
- writes a markdown and JSON inventory of packaged artifacts for each matrix job
- appends that inventory to the workflow summary
- uploads `artifact-summary.md`, `artifact-summary.json`, and `latest*.yml` as GitHub Actions artifacts for manual inspection
- audits platform-specific publish output so missing `.dmg`, `.exe`, `.AppImage`, or `latest*.yml` files fail the release job immediately
- audits manifest consistency so every `latest*.yml` points at a real artifact, carries `sha512`, and matches the tagged release version
- audits rollback readiness so every platform inventory keeps versioned installers plus the audit metadata needed to repoint `latest` to a known-good tagged release
- emits `rollback-playbook.md/json` for every platform so maintainers can follow a generated rollback execution checklist instead of reconstructing asset names by hand
- when `S3_ENABLED=true`, audits publish channel parity so the GitHub and S3 release outputs keep the same installer names and updater manifest targets for the tagged version
- audits release channel recovery so GitHub-only and GitHub+S3 rollback paths fail when the generated playbook, channel metadata, or parity outputs drift apart
- lets maintainers run a rollback drill against archived prior-release metadata so a chosen rollback target can be validated before changing a live channel
- emits a standardized release inventory bundle per platform so archived rollback drill inputs can be stored as one reusable package instead of loose audit files
- lets maintainers retrieve an archived bundle by platform, arch, and version before running rollback drills
- emits a release bundle index in the matrix summary job so maintainers can discover available archived bundles per platform and version
- lets maintainers aggregate multiple fetched tags into a release history index so cached rollback inputs can be browsed across versions instead of one tag at a time
- lets maintainers auto-select the newest valid previous bundle for a platform, arch, and recovery mode before retrieval or rollback drills
- lets maintainers prepare a rollback input straight from that history root so selection and archived bundle retrieval can be handled as one command
- lets maintainers fetch archived bundles straight from tagged GitHub Actions artifacts with `gh` before retrieval, so remote rollback inputs can be reconstructed from one command
- lets maintainers fetch several recent GitHub or S3 tags into one history root and prepare the rollback bundle from that accumulated remote history in one maintainer flow
- lets maintainers run that remote provider fetch plus rollback preparation plus rollback drill as one provider-agnostic maintainer command
- when `S3_ENABLED=true`, mirrors the archived bundle cache plus the generated bundle index, matrix summary, and provenance files into `s3://<bucket>/release-bundles/vX.Y.Z/`
- audits signing readiness before packaging so missing mac notarization or Windows signing secrets fail before the packaging step starts
- runs a follow-up matrix summary job that downloads every per-platform inventory and uploads `release-matrix-summary.md/json`
- generates `release-provenance.md/json` from the tag, commit SHA, and matrix summary so shipped artifacts stay traceable to one release record
- generates `release-status.md/json` from the 1.0 readiness audit, matrix summary, and provenance so maintainers get one condensed operator-facing release health artifact
- generates `one-point-zero-freeze.md/json` from the release-status artifact and the matching version checklist so maintainers also get one explicit freeze decision record
- generates `one-point-zero-decision.md/json` from the readiness audit, release-status artifact, and freeze record so maintainers also get one final `1.0` decision handoff artifact
- generates `one-point-zero-release-candidate.md/json` from the final decision artifact so maintainers also get the next `1.0.0` promotion handoff and checklist target in one place
- keeps a checked helper for preparing the matching `v1.0.0` checklist draft from that release-candidate artifact before any `major` ship run
- prepares `v1.0.0.md` and generates `one-point-zero-promotion-plan.md/json` so the first major-release staging handoff is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-runbook.md/json` from that promotion plan so the first major-release command sequence is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-approval.md/json` so the final first-major-release go/no-go handoff is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-cockpit.md/json` so the full first-major-release operator summary is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-packet.md/json` so the final first-major-release human sign-off packet is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-signoff.md/json` so the final first-major-release reviewer signoff sheet is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-board.md/json` so the final first-major-release board-facing review artifact is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-verdict.md/json` so the final first-major-release maintainer go/no-go sheet is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-authorization.md/json` so the final first-major-release execution authorization sheet is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-warrant.md/json` so the final first-major-release launch-side warrant sheet is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-launch-sheet.md/json` so the final first-major-release execution handoff is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-command-card.md/json` so the final first-major-release command surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-preflight.md/json` so the final first-major-release preflight gate is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-trigger.md/json` so the final first-major-release execution trigger is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-rehearsal.md/json` so the final first-major-release dry-run rehearsal is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-go-live.md/json` so the final first-major-release execution surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-activation.md/json` so the final first-major-release execution confirmation surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-execution.md/json` so the final first-major-release execution confirmation surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-attestation.md/json` so the final first-major-release immutable attestation surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-seal.md/json` so the final first-major-release immutable seal surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-charter.md/json` so the final first-major-release immutable charter surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-canon.md/json` so the final first-major-release immutable canon surface is preserved as a tagged release artifact too
- generates `one-point-zero-major-release-constitution.md/json`, `one-point-zero-major-release-covenant.md/json`, `one-point-zero-major-release-compact.md/json`, `one-point-zero-major-release-capsule.md/json`, `one-point-zero-major-release-ledger.md/json`, `one-point-zero-major-release-archive.md/json`, `one-point-zero-major-release-vault.md/json`, `one-point-zero-major-release-registry.md/json`, `one-point-zero-major-release-directory.md/json`, `one-point-zero-major-release-manifest.md/json`, `one-point-zero-major-release-dossier.md/json`, `one-point-zero-major-release-folio.md/json`, `one-point-zero-major-release-portfolio.md/json`, `one-point-zero-major-release-compendium.md/json`, `one-point-zero-major-release-anthology.md/json`, `one-point-zero-major-release-omnibus.md/json`, `one-point-zero-major-release-digest.md/json`, `one-point-zero-major-release-synopsis.md/json`, `one-point-zero-major-release-brief.md/json`, and `one-point-zero-major-release-abstract.md/json` so the final first-major-release immutable constitution, covenant, compact, capsule, ledger, archive, vault, registry, directory, manifest, dossier, folio, portfolio, compendium, anthology, omnibus, digest, synopsis, brief, and abstract surfaces are preserved as tagged release artifacts too

For framework maintainers working in this monorepo, the official one-command ship flow is:

```bash
pnpm release:ship patch
```

That command runs internal scaffold verification, external scaffold verification, official preset plus `production-ready` release-surface audit, bumps the shared framework version, creates `release: vX.Y.Z`, creates an annotated `vX.Y.Z` tag, and pushes both `main` and the tag to `origin`.

To fetch an archived bundle from a tagged GitHub Actions release before a rollback drill:

```bash
bash scripts/fetch-release-inventory-bundle-from-github.sh \
  uulab-official/forge-desktop-framework \
  v0.1.60 \
  mac \
  arm64
```

That command downloads the tagged release artifacts with `gh`, restores the matrix bundle index locally, and then reuses the standard retrieval helper to produce a canonical rollback input directory.

To fetch the mirrored archived bundle cache from S3 or R2:

```bash
export S3_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
bash scripts/fetch-release-inventory-bundle-from-s3.sh \
  forge-releases \
  v0.1.61 \
  mac \
  arm64 \
  s3
```

That command downloads `release-bundles/vX.Y.Z/` from object storage, restores the local bundle index if needed, and then reuses the same canonical retrieval helper that powers rollback drills.

To aggregate multiple fetched tag directories into one remote history view:

```bash
bash scripts/generate-release-history-index.sh \
  .fetched-release-artifacts
```

That command emits `release-history-index.md/json` so maintainers can see every cached tag, the bundled targets inside each one, and the latest archived version per target before picking a rollback path. The GitHub and S3 fetch helpers now refresh this parent history index automatically.

If you keep an accumulated archive root with multiple tagged bundles locally, you can auto-select the best rollback candidate before retrieval:

```bash
bash scripts/select-release-rollback-target.sh \
  .release-bundle-history \
  mac \
  arm64 \
  0.1.61 \
  dual-channel
```

That command writes `rollback-target-selection.md/json/env`, chooses the newest archived version older than the current release, and enforces that the selected bundle still matches the requested recovery mode.

If you want to close selection and archived bundle retrieval in one step from that same accumulated history root:

```bash
bash scripts/prepare-release-rollback-from-history.sh \
  .fetched-release-artifacts \
  mac \
  arm64 \
  0.1.64 \
  dual-channel
```

That command regenerates `release-history-index.json` when needed, picks the newest valid prior release for the requested target and recovery mode, and then retrieves the canonical archived bundle into one prepared rollback directory.

If you want to populate that history root from recent remote releases first, use one of these wrappers:

```bash
bash scripts/prepare-release-rollback-from-github-history.sh \
  uulab-official/forge-desktop-framework \
  mac \
  arm64 \
  0.1.65 \
  dual-channel \
  5
```

```bash
bash scripts/prepare-release-rollback-from-s3-history.sh \
  forge-release-cache \
  mac \
  arm64 \
  0.1.65 \
  dual-channel \
  s3 \
  5
```

Those commands fetch up to the requested number of remote tags at or before the current version, refresh the accumulated `release-history-index.json`, and then prepare the canonical retrieved rollback bundle from the best matching older release.

If you already have the current release inventory on disk and want to run the full remote rollback drill in one pass:

```bash
bash scripts/run-remote-release-rollback-drill.sh \
  github \
  uulab-official/forge-desktop-framework \
  apps/app/release \
  mac \
  arm64 \
  0.1.66 \
  dual-channel \
  5
```

```bash
bash scripts/run-remote-release-rollback-drill.sh \
  s3 \
  forge-release-cache \
  apps/app/release \
  mac \
  arm64 \
  0.1.66 \
  dual-channel \
  5 \
  s3
```

Those commands fetch recent remote history for the requested provider, prepare the best matching older rollback bundle, and then run `scripts/run-rollback-drill.sh` against the current release directory.
They now also write `recovery-command-summary.md/json` next to the prepared output so maintainers can capture the chosen rollback target, archived asset list, rerun command, and follow-up operator actions as one recovery artifact.

### Build and Publish Locally

```bash
# Verify local release prerequisites
pnpm release:check
pnpm publish:check:github
pnpm package:verify
pnpm package:audit

# Generated app shortcut
pnpm publish:github

# CLI path
export GH_TOKEN="your-github-token"
forge publish

# S3/R2
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export S3_BUCKET="my-releases"
export S3_ENDPOINT="https://abc.r2.cloudflarestorage.com"
export S3_UPDATE_URL="https://releases.example.com"
pnpm publish:check:s3
pnpm package:verify:s3
pnpm package:audit:s3
pnpm publish:s3
forge publish --s3

# Both
forge publish --github --s3
```

## S3/R2 Setup

### Cloudflare R2

1. Go to **Cloudflare Dashboard > R2 > Create bucket**
2. Create a bucket (e.g., `forge-releases`)
3. Under **Settings > Public access**, enable public access or set up a custom domain
4. Generate **R2 API tokens** under **Manage R2 API Tokens**:
   - Permission: Object Read & Write
   - Specify bucket: your release bucket
5. Note down:
   - **Access Key ID** and **Secret Access Key**
   - **Endpoint**: `https://<account-id>.r2.cloudflarestorage.com`
   - **Public URL**: your custom domain or `https://pub-<hash>.r2.dev`

### AWS S3

1. Create an S3 bucket with public read access (or CloudFront distribution)
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` permissions
3. Note down Access Key ID, Secret Access Key, region, and bucket name

### Bucket Structure

After publishing, the bucket will contain:

```
releases/
  v0.1.0/
    Forge App-0.1.0.dmg
    Forge App-0.1.0-arm64.dmg
    Forge App Setup 0.1.0.exe
    Forge App-0.1.0.AppImage
    latest-mac.yml
    latest.yml
    latest-linux.yml
  v0.2.0/
    ...
  latest/
    latest-mac.yml
    latest.yml
    latest-linux.yml
```

## Auto-Update Configuration

The app uses `electron-updater` for automatic updates. To enable auto-update:

### GitHub Releases (default)

Set environment variables `GH_OWNER` and `GH_REPO` (or they default from the `publish` config in `electron-builder.yml`).

### S3/R2 (generic provider)

Use the `electron-builder.s3.yml` config which extends the base config and overrides the publish provider to `generic` with your `S3_UPDATE_URL`.

### In your app's main process

```typescript
import { autoUpdater } from 'electron-updater';
import { app } from 'electron';

// Only check in production
if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    // Prompt user to restart
    autoUpdater.quitAndInstall();
  });
}
```

## Testing Updates

1. Build and publish version `0.1.0`
2. Bump to `0.2.0` and publish again
3. Install `0.1.0`, launch it, and verify the updater detects `0.2.0`

### Local Testing

For local testing without publishing:

```bash
# Package the app locally
pnpm --filter @forge/app package

# The packaged app will be in apps/app/release/
# Install and run it to test
```

## Troubleshooting

### Code signing errors on macOS

- Ensure your certificate is a **Developer ID Application** certificate (not iOS distribution)
- Check that `CSC_LINK` is properly base64-encoded
- Run `security find-identity -v -p codesigning` to verify local certificates

### Notarization failures

- Verify `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` are correct
- Check Apple's notarization status: `xcrun notarytool log <submission-id> --apple-id <email> --team-id <team>`
- Ensure `hardenedRuntime: true` is set in electron-builder config

### S3 upload failures

- Verify AWS credentials have the correct permissions
- Check that `S3_ENDPOINT` is correct (include `https://`)
- For R2, ensure the region is set to `auto`
- Test with: `aws s3 ls s3://$S3_BUCKET/ --endpoint-url $S3_ENDPOINT`

### Auto-update not working

- The app must be code-signed for auto-update on macOS
- Check that `latest-mac.yml` / `latest.yml` / `latest-linux.yml` exist at the update URL
- Verify the update URL is publicly accessible
- Check the app logs for updater errors (usually in `~/Library/Logs/<app-name>/`)

### Build failures in CI

- Check that all secrets are properly set in GitHub Actions
- Verify the Python worker builds successfully by checking the worker step logs
- For Windows builds, ensure `WIN_CSC_LINK` is a `.pfx` certificate
