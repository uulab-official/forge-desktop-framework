# Changelog

## 0.1.130 (2026-04-05)

### Production Operations Ready Pipeline

- added generated `pnpm ops:ready` plus `scripts/ops-ready.sh`, so scaffolded `production-ready` apps can refresh snapshot, evidence, report, bundle, index, doctor, refreshed index, and handoff into one final Markdown and JSON ready verdict under `ops/ready/`
- updated generated validate and tagged release workflows so scaffolded apps now run the single `ops:ready` pipeline and upload `ops/ready/` alongside the existing operator evidence directories
- extended release-surface audit coverage plus internal and external `production-ready` scaffold smoke so Forge now proves the one-shot ready pipeline emits bounded ready summaries after repeated production checks
- updated product docs so `ops:ready` is the documented production-grade orchestration path on top of the lower-level ops surfaces

## 0.1.129 (2026-04-05)

### Production Operations Handoff

- added generated `pnpm ops:handoff` plus `scripts/ops-handoff.sh`, so scaffolded `production-ready` apps can emit one final operator handoff package under `ops/handoffs/` with Markdown, JSON, and `ops-handoff.tgz`
- updated generated validate and tagged release workflows so scaffolded apps now upload `ops/handoffs/` alongside `ops/snapshots/`, `ops/evidence/`, `ops/reports/`, `ops/bundles/`, `ops/index/`, and `ops/doctors/`
- extended `ops:index`, `ops:retention`, release-surface audit coverage, and internal plus external `production-ready` smoke verification so Forge now proves repeated production audits keep final handoff packages bounded and present
- updated product docs so `ops:handoff` is part of the documented production-grade operating flow

## 0.1.128 (2026-04-05)

### Production Operations Doctor

- added generated `pnpm ops:doctor` plus `scripts/ops-doctor.sh`, so scaffolded `production-ready` apps can emit one final Markdown and JSON verdict under `ops/doctors/` that the latest snapshot, evidence, report, bundle, index, and optional release output are present and aligned
- updated generated validate and tagged release workflows so scaffolded apps now upload `ops/doctors/` alongside `ops/snapshots/`, `ops/evidence/`, `ops/reports/`, `ops/bundles/`, and `ops/index/`
- extended `ops:index`, `ops:retention`, release-surface audit coverage, and internal plus external `production-ready` smoke verification so Forge now proves repeated production audits keep final doctor verdicts bounded and present
- updated product docs so `ops:doctor` is part of the documented production-grade operating flow

## 0.1.127 (2026-04-05)

### Production Operations Bundles

- added generated `pnpm ops:bundle` plus `scripts/ops-bundle.sh`, so scaffolded `production-ready` apps can package the latest ops snapshot, evidence bundle, report, docs, env template, and release manifest inventory into one portable tarball under `ops/bundles/`
- updated generated validate and tagged release workflows so scaffolded apps now upload `ops/bundles/` alongside `ops/snapshots/`, `ops/evidence/`, `ops/reports/`, and `ops/index/`
- extended `ops:index`, `ops:retention`, release-surface audit coverage, and internal plus external `production-ready` smoke verification so Forge now proves repeated production audits keep portable operator bundles bounded and present
- updated product docs so `ops:bundle` is part of the documented production-grade operating flow

## 0.1.126 (2026-04-05)

### Production Operations Reports

- added generated `pnpm ops:report` plus `scripts/ops-report.sh`, so scaffolded `production-ready` apps can emit one consolidated Markdown and JSON operator handoff under `ops/reports/`
- updated generated validate and tagged release workflows so scaffolded apps now upload `ops/reports/` alongside `ops/snapshots/`, `ops/evidence/`, and `ops/index/`
- extended `ops:retention`, release-surface audit coverage, and internal plus external `production-ready` smoke verification so Forge now proves repeated production audits keep reports bounded and present
- updated product docs so `ops:report` is part of the documented production-grade operating flow
## 0.1.123 (2026-04-04)

### Production Operations Evidence Bundles

- added generated `pnpm ops:evidence` plus `scripts/ops-evidence.sh`, so scaffolded apps can package the latest operations snapshot, production docs, env template, and release manifest inventory into a reusable bundle under `ops/evidence/`
- updated generated `production:check`, validate workflow, and tagged release workflow so production-grade apps now emit evidence bundles during CI and upload `ops/evidence/` alongside `ops/snapshots/`
- extended release-surface audit coverage plus internal and external `production-ready` smoke verification so Forge now proves the evidence bundle command actually runs and writes operator-facing summary files before the framework version can move

## 0.1.122 (2026-04-04)

### Production Operations Snapshot Artifacts

- updated generated `validate.yml` and tagged `release.yml` workflows so scaffolded apps now upload `ops/snapshots/` as GitHub Actions artifacts instead of leaving operator-facing evidence only on runner disk
- enriched generated `pnpm ops:snapshot` output with CI execution context, including workflow name, run id, ref, commit SHA, and runner OS in both the Markdown and JSON snapshot payloads
- extended release-surface audit coverage plus production-ready docs so Forge now verifies and documents snapshot artifact retention as part of the production scaffold contract

## 0.1.121 (2026-04-04)

### Production Operations Snapshot

- added generated `pnpm ops:snapshot` plus `scripts/ops-snapshot.sh`, so scaffolded apps can emit operator-facing Markdown and JSON snapshots of their current release surface under `ops/snapshots/`
- updated the generated release playbook, production-readiness guide, project README, package scripts, and GitHub Actions workflows so the operations snapshot is part of the documented `production-ready` validation path instead of an ad hoc maintainer step
- extended release-surface audit coverage plus internal and external `production-ready` smoke flows so Forge now proves the snapshot command actually runs and writes evidence before the framework version can move

## 0.1.120 (2026-04-04)

### Production Runtime Hygiene Baseline

- added generated `pnpm ops:check` plus `scripts/runtime-hygiene.sh`, so scaffolded apps can fail fast when managed log paths, crash-dump paths, or startup retention cleanup drift away from the framework production baseline
- hardened the generated minimal shell, the minimal example, the synced templates, and the reference app with explicit `app.setAppLogsPath`, managed `crashDumps` storage, and startup cleanup of old logs and dump files
- updated generated validation and tagged release workflows, release-surface audit coverage, and production-ready documentation so runtime-hygiene checks now run alongside Electron security, release, publish, and packaged-artifact checks

## 0.1.119 (2026-04-04)

### Production Security Baseline

- added generated `pnpm security:check` plus `scripts/security-baseline.sh`, so scaffolded apps can fail fast when Electron renderer isolation, sandboxing, external navigation guards, or preload API freezing drift away from the framework baseline
- hardened the generated minimal shell, the minimal example, the synced templates, and the reference app with `sandbox: true`, `webSecurity: true`, `setWindowOpenHandler`, `will-navigate` guards, and frozen preload APIs
- updated `production-ready` docs and release-surface audit coverage so production-grade starters now document and verify the Electron security baseline alongside release, publish, worker, and packaged-artifact checks

## 0.1.118 (2026-04-04)

### Production Readiness Commands

- added generated `pnpm production:check`, `pnpm production:check:s3`, and `pnpm production:check:all` commands plus `scripts/production-readiness.sh` and `docs/production-readiness.md`, so scaffolded apps now have one production-grade entry point for release preflight, worker build, desktop build, publish-env checks, and packaged-artifact audits
- updated the `production-ready` internal and external smoke paths plus release-surface audit so Forge proves that composite starter can pass the new production-readiness command before the framework version moves
- fixed generated release helper scripts that were being written with literal `\n` sequences instead of real newlines, which had turned some packaged-artifact and production-readiness checks into shell no-ops
- extended release/version alignment so distributable template copies under `packages/create-forge-app/templates/` are versioned and checked with the rest of the framework surface
- updated README, getting-started, deployment, and the CLI README so the production-grade starter path now points at the generated production-readiness workflow instead of only the lower-level release scripts

## 0.1.117 (2026-04-04)

### Production Ready Composite Preset

- added a new `production-ready` preset to `create-forge-desktop`, bundling the `launch-ready`, `support-ready`, `ops-ready`, and `document-ready` baselines into one production-grade starter for teams that want one official scaffold command
- extended internal scaffold smoke, external scaffold smoke, and release-surface audit coverage so the new composite preset is validated for GitHub publish checks, S3 publish checks, package verification, package audit, worker build, and app build before any framework version can move
- updated the root README, getting-started guide, deployment guide, CLI README, and `1.0` gate readiness audit so Forge documents and verifies `production-ready` as the recommended production-grade starter without changing the frozen `1.0` preset contract

## 0.1.116 (2026-04-04)

### One Point Zero Major Release Abstract

- added `scripts/generate-one-point-zero-major-release-abstract.sh` and `scripts/test-one-point-zero-major-release-abstract.sh` so Forge now emits `one-point-zero-major-release-abstract.md/json`, which turns the major-release brief artifact plus prepared `v1.0.0` checklist into one final immutable abstract surface
- wired `pnpm release:major:abstract:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` abstract artifact for every shipped version
- documented the new major-release abstract layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.116` release checklist

## 0.1.115 (2026-04-04)

### One Point Zero Major Release Brief

- added `scripts/generate-one-point-zero-major-release-brief.sh` and `scripts/test-one-point-zero-major-release-brief.sh` so Forge now emits `one-point-zero-major-release-brief.md/json`, which turns the major-release synopsis artifact plus prepared `v1.0.0` checklist into one final immutable brief surface
- wired `pnpm release:major:brief:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` brief artifact for every shipped version
- documented the new major-release brief layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.115` release checklist

## 0.1.114 (2026-04-04)

### One Point Zero Major Release Synopsis

- added `scripts/generate-one-point-zero-major-release-synopsis.sh` and `scripts/test-one-point-zero-major-release-synopsis.sh` so Forge now emits `one-point-zero-major-release-synopsis.md/json`, which turns the major-release digest artifact plus prepared `v1.0.0` checklist into one final immutable synopsis surface
- wired `pnpm release:major:synopsis:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` synopsis artifact for every shipped version
- documented the new major-release synopsis layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.114` release checklist

## 0.1.113 (2026-04-04)

### One Point Zero Major Release Digest

- added `scripts/generate-one-point-zero-major-release-digest.sh` and `scripts/test-one-point-zero-major-release-digest.sh` so Forge now emits `one-point-zero-major-release-digest.md/json`, which turns the major-release omnibus artifact plus prepared `v1.0.0` checklist into one final immutable digest surface
- wired `pnpm release:major:digest:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` digest artifact for every shipped version
- documented the new major-release digest layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.113` release checklist

## 0.1.112 (2026-04-04)

### One Point Zero Major Release Omnibus

- added `scripts/generate-one-point-zero-major-release-omnibus.sh` and `scripts/test-one-point-zero-major-release-omnibus.sh` so Forge now emits `one-point-zero-major-release-omnibus.md/json`, which turns the major-release anthology artifact plus prepared `v1.0.0` checklist into one final immutable omnibus surface
- wired `pnpm release:major:omnibus:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` omnibus artifact for every shipped version
- documented the new major-release omnibus layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.112` release checklist

## 0.1.111 (2026-04-04)

### One Point Zero Major Release Anthology

- added `scripts/generate-one-point-zero-major-release-anthology.sh` and `scripts/test-one-point-zero-major-release-anthology.sh` so Forge now emits `one-point-zero-major-release-anthology.md/json`, which turns the major-release compendium artifact plus prepared `v1.0.0` checklist into one final immutable anthology surface
- wired `pnpm release:major:anthology:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` anthology artifact for every shipped version
- documented the new major-release anthology layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.111` release checklist

## 0.1.110 (2026-04-03)

### One Point Zero Major Release Compendium

- added `scripts/generate-one-point-zero-major-release-compendium.sh` and `scripts/test-one-point-zero-major-release-compendium.sh` so Forge now emits `one-point-zero-major-release-compendium.md/json`, which turns the major-release portfolio artifact plus prepared `v1.0.0` checklist into one final immutable compendium surface
- wired `pnpm release:major:compendium:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` compendium artifact for every shipped version
- documented the new major-release compendium layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.110` release checklist

## 0.1.109 (2026-04-03)

### One Point Zero Major Release Portfolio

- added `scripts/generate-one-point-zero-major-release-portfolio.sh` and `scripts/test-one-point-zero-major-release-portfolio.sh` so Forge now emits `one-point-zero-major-release-portfolio.md/json`, which turns the major-release folio artifact plus prepared `v1.0.0` checklist into one final immutable portfolio surface
- wired `pnpm release:major:portfolio:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` portfolio artifact for every shipped version
- documented the new major-release portfolio layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.109` release checklist

## 0.1.108 (2026-04-03)

### One Point Zero Major Release Folio

- added `scripts/generate-one-point-zero-major-release-folio.sh` and `scripts/test-one-point-zero-major-release-folio.sh` so Forge now emits `one-point-zero-major-release-folio.md/json`, which turns the major-release dossier artifact plus prepared `v1.0.0` checklist into one final immutable folio surface
- wired `pnpm release:major:folio:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` folio artifact for every shipped version
- documented the new major-release folio layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.108` release checklist

## 0.1.107 (2026-04-03)

### One Point Zero Major Release Dossier

- added `scripts/generate-one-point-zero-major-release-dossier.sh` and `scripts/test-one-point-zero-major-release-dossier.sh` so Forge now emits `one-point-zero-major-release-dossier.md/json`, which turns the major-release manifest artifact plus prepared `v1.0.0` checklist into one final immutable dossier surface
- wired `pnpm release:major:dossier:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` dossier artifact for every shipped version
- documented the new major-release dossier layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.107` release checklist

## 0.1.106 (2026-04-03)

### One Point Zero Major Release Manifest

- added `scripts/generate-one-point-zero-major-release-manifest.sh` and `scripts/test-one-point-zero-major-release-manifest.sh` so Forge now emits `one-point-zero-major-release-manifest.md/json`, which turns the major-release directory artifact plus prepared `v1.0.0` checklist into one final immutable manifest surface
- wired `pnpm release:major:manifest:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` manifest artifact for every shipped version
- documented the new major-release manifest layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.106` release checklist

## 0.1.105 (2026-04-03)

### One Point Zero Major Release Directory

- added `scripts/generate-one-point-zero-major-release-directory.sh` and `scripts/test-one-point-zero-major-release-directory.sh` so Forge now emits `one-point-zero-major-release-directory.md/json`, which turns the major-release registry artifact plus prepared `v1.0.0` checklist into one final immutable directory surface
- wired `pnpm release:major:directory:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` directory artifact for every shipped version
- documented the new major-release directory layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.105` release checklist

## 0.1.104 (2026-04-03)

### One Point Zero Major Release Registry

- added `scripts/generate-one-point-zero-major-release-registry.sh` and `scripts/test-one-point-zero-major-release-registry.sh` so Forge now emits `one-point-zero-major-release-registry.md/json`, which turns the major-release vault artifact plus prepared `v1.0.0` checklist into one final immutable registry surface
- wired `pnpm release:major:registry:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` registry artifact for every shipped version
- documented the new major-release registry layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.104` release checklist

## 0.1.103 (2026-04-03)

### One Point Zero Major Release Vault

- added `scripts/generate-one-point-zero-major-release-vault.sh` and `scripts/test-one-point-zero-major-release-vault.sh` so Forge now emits `one-point-zero-major-release-vault.md/json`, which turns the major-release archive artifact plus prepared `v1.0.0` checklist into one final immutable vault surface
- wired `pnpm release:major:vault:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` vault artifact for every shipped version
- documented the new major-release vault layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.103` release checklist

## 0.1.102 (2026-04-03)

### One Point Zero Major Release Archive

- added `scripts/generate-one-point-zero-major-release-archive.sh` and `scripts/test-one-point-zero-major-release-archive.sh` so Forge now emits `one-point-zero-major-release-archive.md/json`, which turns the major-release ledger artifact plus prepared `v1.0.0` checklist into one final immutable archive surface
- wired `pnpm release:major:archive:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` archive artifact for every shipped version
- documented the new major-release archive layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.102` release checklist

## 0.1.101 (2026-04-03)

### One Point Zero Major Release Ledger

- added `scripts/generate-one-point-zero-major-release-ledger.sh` and `scripts/test-one-point-zero-major-release-ledger.sh` so Forge now emits `one-point-zero-major-release-ledger.md/json`, which turns the major-release capsule artifact plus prepared `v1.0.0` checklist into one final immutable ledger surface
- wired `pnpm release:major:ledger:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` ledger artifact for every shipped version
- documented the new major-release ledger layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.101` release checklist

## 0.1.100 (2026-04-03)

### One Point Zero Major Release Capsule

- added `scripts/generate-one-point-zero-major-release-capsule.sh` and `scripts/test-one-point-zero-major-release-capsule.sh` so Forge now emits `one-point-zero-major-release-capsule.md/json`, which turns the major-release compact artifact plus prepared `v1.0.0` checklist into one final immutable capsule surface
- wired `pnpm release:major:capsule:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` capsule artifact for every shipped version
- documented the new major-release capsule layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.100` release checklist

## 0.1.99 (2026-04-03)

### One Point Zero Major Release Compact

- added `scripts/generate-one-point-zero-major-release-compact.sh` and `scripts/test-one-point-zero-major-release-compact.sh` so Forge now emits `one-point-zero-major-release-compact.md/json`, which turns the major-release covenant artifact plus prepared `v1.0.0` checklist into one final immutable compact surface
- wired `pnpm release:major:compact:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` compact artifact for every shipped version
- documented the new major-release compact layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.99` release checklist

## 0.1.98 (2026-04-03)

### One Point Zero Major Release Covenant

- added `scripts/generate-one-point-zero-major-release-covenant.sh` and `scripts/test-one-point-zero-major-release-covenant.sh` so Forge now emits `one-point-zero-major-release-covenant.md/json`, which turns the major-release constitution artifact plus prepared `v1.0.0` checklist into one final immutable covenant surface
- wired `pnpm release:major:covenant:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` covenant artifact for every shipped version
- documented the new major-release covenant layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.98` release checklist

## 0.1.97 (2026-04-03)

### One Point Zero Major Release Constitution

- added `scripts/generate-one-point-zero-major-release-constitution.sh` and `scripts/test-one-point-zero-major-release-constitution.sh` so Forge now emits `one-point-zero-major-release-constitution.md/json`, which turns the major-release canon artifact plus prepared `v1.0.0` checklist into one final immutable constitution surface
- wired `pnpm release:major:constitution:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` constitution artifact for every shipped version
- documented the new major-release constitution layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.97` release checklist

## 0.1.96 (2026-04-02)

### One Point Zero Major Release Canon

- added `scripts/generate-one-point-zero-major-release-canon.sh` and `scripts/test-one-point-zero-major-release-canon.sh` so Forge now emits `one-point-zero-major-release-canon.md/json`, which turns the major-release charter artifact plus prepared `v1.0.0` checklist into one final immutable canon surface
- wired `pnpm release:major:canon:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` canon artifact for every shipped version
- documented the new major-release canon layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.96` release checklist

## 0.1.95 (2026-04-02)

### One Point Zero Major Release Charter

- added `scripts/generate-one-point-zero-major-release-charter.sh` and `scripts/test-one-point-zero-major-release-charter.sh` so Forge now emits `one-point-zero-major-release-charter.md/json`, which turns the major-release seal artifact plus prepared `v1.0.0` checklist into one final immutable charter surface
- wired `pnpm release:major:charter:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` charter artifact for every shipped version
- documented the new major-release charter layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.95` release checklist

## 0.1.94 (2026-04-02)

### One Point Zero Major Release Seal

- added `scripts/generate-one-point-zero-major-release-seal.sh` and `scripts/test-one-point-zero-major-release-seal.sh` so Forge now emits `one-point-zero-major-release-seal.md/json`, which turns the major-release attestation artifact plus prepared `v1.0.0` checklist into one final immutable seal surface
- wired `pnpm release:major:seal:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` seal artifact for every shipped version
- documented the new major-release seal layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.94` release checklist

## 0.1.93 (2026-04-02)

### One Point Zero Major Release Attestation

- added `scripts/generate-one-point-zero-major-release-attestation.sh` and `scripts/test-one-point-zero-major-release-attestation.sh` so Forge now emits `one-point-zero-major-release-attestation.md/json`, which turns the major-release execution artifact plus prepared `v1.0.0` checklist into one final immutable attestation surface
- wired `pnpm release:major:attestation:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` attestation artifact for every shipped version
- documented the new major-release attestation layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.93` release checklist

## 0.1.92 (2026-04-02)

### One Point Zero Major Release Execution

- added `scripts/generate-one-point-zero-major-release-execution.sh` and `scripts/test-one-point-zero-major-release-execution.sh` so Forge now emits `one-point-zero-major-release-execution.md/json`, which turns the major-release activation artifact plus prepared `v1.0.0` checklist into one final execution confirmation surface
- wired `pnpm release:major:execution:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` execution artifact for every shipped version
- documented the new major-release execution layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.92` release checklist

## 0.1.91 (2026-04-02)

### One Point Zero Major Release Activation

- added `scripts/generate-one-point-zero-major-release-activation.sh` and `scripts/test-one-point-zero-major-release-activation.sh` so Forge now emits `one-point-zero-major-release-activation.md/json`, which turns the major-release go-live artifact plus prepared `v1.0.0` checklist into one final execution confirmation surface
- wired `pnpm release:major:activation:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` activation artifact for every shipped version
- documented the new major-release activation layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.91` release checklist

## 0.1.90 (2026-04-02)

### One Point Zero Major Release Go Live

- added `scripts/generate-one-point-zero-major-release-go-live.sh` and `scripts/test-one-point-zero-major-release-go-live.sh` so Forge now emits `one-point-zero-major-release-go-live.md/json`, which turns the major-release rehearsal artifact plus prepared `v1.0.0` checklist into one final execution surface
- wired `pnpm release:major:go-live:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` go-live artifact for every shipped version
- documented the new major-release go-live layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.90` release checklist

## 0.1.89 (2026-04-02)

### One Point Zero Major Release Rehearsal

- added `scripts/generate-one-point-zero-major-release-rehearsal.sh` and `scripts/test-one-point-zero-major-release-rehearsal.sh` so Forge now emits `one-point-zero-major-release-rehearsal.md/json`, which turns the major-release trigger artifact plus prepared `v1.0.0` checklist into one final dry-run rehearsal
- wired `pnpm release:major:rehearsal:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` rehearsal artifact for every shipped version
- documented the new major-release rehearsal layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.89` release checklist

## 0.1.88 (2026-04-02)

### One Point Zero Major Release Trigger

- added `scripts/generate-one-point-zero-major-release-trigger.sh` and `scripts/test-one-point-zero-major-release-trigger.sh` so Forge now emits `one-point-zero-major-release-trigger.md/json`, which turns the major-release preflight artifact plus prepared `v1.0.0` checklist into one final execution trigger
- wired `pnpm release:major:trigger:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` trigger artifact for every shipped version
- documented the new major-release trigger layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.88` release checklist

## 0.1.87 (2026-04-02)

### One Point Zero Major Release Preflight

- added `scripts/generate-one-point-zero-major-release-preflight.sh` and `scripts/test-one-point-zero-major-release-preflight.sh` so Forge now emits `one-point-zero-major-release-preflight.md/json`, which turns the major-release command-card artifact plus prepared `v1.0.0` checklist into one final ready-to-ship preflight gate
- wired `pnpm release:major:preflight:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` preflight artifact for every shipped version
- documented the new major-release preflight layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.87` release checklist

## 0.1.86 (2026-04-02)

### One Point Zero Major Release Command Card

- added `scripts/generate-one-point-zero-major-release-command-card.sh` and `scripts/test-one-point-zero-major-release-command-card.sh` so Forge now emits `one-point-zero-major-release-command-card.md/json`, which turns the major-release launch-sheet artifact into one final command-only execution card
- wired `pnpm release:major:command-card:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` command-card artifact for every shipped version
- documented the new major-release command-card layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.86` release checklist

## 0.1.85 (2026-04-02)

### One Point Zero Major Release Launch Sheet

- added `scripts/generate-one-point-zero-major-release-launch-sheet.sh` and `scripts/test-one-point-zero-major-release-launch-sheet.sh` so Forge now emits `one-point-zero-major-release-launch-sheet.md/json`, which turns the major-release warrant artifact into one final operator-facing execution handoff
- wired `pnpm release:major:launch-sheet:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` launch-sheet artifact for every shipped version
- documented the new major-release launch-sheet layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the `1.0` gate doc, and the `v0.1.85` release checklist

## 0.1.84 (2026-04-02)

### One Point Zero Major Release Warrant

- added `scripts/generate-one-point-zero-major-release-warrant.sh` and `scripts/test-one-point-zero-major-release-warrant.sh` so Forge now emits `one-point-zero-major-release-warrant.md/json`, which turns the major-release authorization artifact into one final launch-side warrant sheet
- wired `pnpm release:major:warrant:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` warrant artifact for every shipped version
- documented the new major-release warrant layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.84` release checklist

## 0.1.83 (2026-04-02)

### One Point Zero Major Release Authorization

- added `scripts/generate-one-point-zero-major-release-authorization.sh` and `scripts/test-one-point-zero-major-release-authorization.sh` so Forge now emits `one-point-zero-major-release-authorization.md/json`, which turns the major-release verdict artifact into one final execution authorization sheet
- wired `pnpm release:major:authorization:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` authorization artifact for every shipped version
- documented the new major-release authorization layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.83` release checklist

## 0.1.82 (2026-04-02)

### One Point Zero Major Release Verdict

- added `scripts/generate-one-point-zero-major-release-verdict.sh` and `scripts/test-one-point-zero-major-release-verdict.sh` so Forge now emits `one-point-zero-major-release-verdict.md/json`, which turns the major-release board artifact into one final maintainer go/no-go sheet
- wired `pnpm release:major:verdict:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` verdict artifact for every shipped version
- documented the new major-release verdict layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.82` release checklist

## 0.1.81 (2026-04-02)

### One Point Zero Major Release Board

- added `scripts/generate-one-point-zero-major-release-board.sh` and `scripts/test-one-point-zero-major-release-board.sh` so Forge now emits `one-point-zero-major-release-board.md/json`, which turns the major-release signoff sheet into one final board-facing review artifact
- wired `pnpm release:major:board:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` board review artifact for every shipped version
- documented the new major-release board layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.81` release checklist

## 0.1.80 (2026-04-01)

### One Point Zero Major Release Signoff

- added `scripts/generate-one-point-zero-major-release-signoff.sh` and `scripts/test-one-point-zero-major-release-signoff.sh` so Forge now emits `one-point-zero-major-release-signoff.md/json`, which turns the major-release packet into one final reviewer-facing signoff sheet
- wired `pnpm release:major:signoff:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` signoff sheet for every shipped version
- documented the new major-release signoff layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.80` release checklist

## 0.1.79 (2026-04-01)

### One Point Zero Major Release Packet

- added `scripts/generate-one-point-zero-major-release-packet.sh` and `scripts/test-one-point-zero-major-release-packet.sh` so Forge now emits `one-point-zero-major-release-packet.md/json`, which joins the green cockpit artifact with the prepared `v1.0.0` checklist as one final human sign-off packet
- wired `pnpm release:major:packet:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` sign-off packet for every shipped version
- documented the new major-release packet layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.79` release checklist

## 0.1.78 (2026-04-01)

### One Point Zero Major Release Cockpit

- added `scripts/generate-one-point-zero-major-release-cockpit.sh` and `scripts/test-one-point-zero-major-release-cockpit.sh` so Forge now emits `one-point-zero-major-release-cockpit.md/json`, which condenses readiness, release-status, decision, promotion, runbook, and approval into one final first-major-release operator summary
- wired `pnpm release:major:cockpit:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit `1.0.0` cockpit artifact for every shipped version
- documented the new major-release cockpit layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.78` release checklist

## 0.1.77 (2026-04-01)

### One Point Zero Major Release Approval

- added `scripts/generate-one-point-zero-major-release-approval.sh` and `scripts/test-one-point-zero-major-release-approval.sh` so Forge now emits `one-point-zero-major-release-approval.md/json`, which joins the `1.0` decision, promotion plan, and major-runbook layers into one final first-major-release approval artifact
- wired `pnpm release:major:approval:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit first-major-release approval handoff for every shipped version
- documented the new major-release approval layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.77` release checklist

## 0.1.76 (2026-04-01)

### One Point Zero Major Release Runbook

- added `scripts/generate-one-point-zero-major-release-runbook.sh` and `scripts/test-one-point-zero-major-release-runbook.sh` so Forge now emits `one-point-zero-major-release-runbook.md/json`, which turns the promotion-plan artifact into one explicit first-major-release execution sequence
- wired `pnpm release:major:runbook:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one operator-focused `1.0.0` runbook for every shipped version
- documented the new major-release runbook layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.76` release checklist

## 0.1.75 (2026-04-01)

### One Point Zero Promotion Plan

- added `scripts/generate-one-point-zero-promotion-plan-report.sh` and `scripts/test-one-point-zero-promotion-plan-report.sh` so Forge now emits `one-point-zero-promotion-plan.md/json`, which joins the audited release-candidate handoff with the prepared `v1.0.0` checklist draft as one final staging artifact
- wired `pnpm release:promotion:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit first-major-release promotion plan for every shipped version
- documented the new promotion-plan layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.75` release checklist

## 0.1.74 (2026-04-01)

### One Point Zero Major Checklist Preparation

- added `scripts/prepare-one-point-zero-major-checklist.sh` and `scripts/test-one-point-zero-major-checklist-preparation.sh` so Forge can turn the audited `one-point-zero-release-candidate.md/json` handoff into a prefilled `v1.0.0` checklist draft
- wired `pnpm release:major:prepare:test` into `scripts/release.sh` and the Ubuntu `release-readiness` CI job so the first `1.0.0` checklist path stays reproducible before any major ship run
- documented the new major-checklist preparation layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.74` release checklist

## 0.1.73 (2026-04-01)

### One Point Zero Release Candidate Artifact

- added `scripts/generate-one-point-zero-release-candidate-report.sh` and `scripts/test-one-point-zero-release-candidate-report.sh` so Forge now emits `one-point-zero-release-candidate.md/json`, a final `1.0.0` promotion handoff derived from the one-point-zero decision artifact
- wired `pnpm release:rc:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit release-candidate artifact for every shipped version
- documented the new release-candidate layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.73` release checklist

## 0.1.72 (2026-04-01)

### One Point Zero Decision Artifact

- added `scripts/generate-one-point-zero-decision-report.sh` and `scripts/test-one-point-zero-decision-report.sh` so Forge now emits `one-point-zero-decision.md/json`, a final maintainer handoff derived from readiness, release-status, and freeze artifacts
- wired `pnpm release:decision:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit final 1.0 decision artifact for every shipped version
- documented the new decision layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.72` release checklist

## 0.1.71 (2026-04-01)

### One Point Zero Freeze Artifact

- added `scripts/generate-one-point-zero-freeze-report.sh` and `scripts/test-one-point-zero-freeze-report.sh` so Forge now emits `one-point-zero-freeze.md/json`, a final go/no-go artifact derived from the release-status summary and the matching version checklist
- wired `pnpm release:freeze:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release follow-up so maintainers can validate and publish one explicit freeze-decision artifact for every shipped version
- documented the new freeze layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.71` release checklist

## 0.1.70 (2026-04-01)

### Release Status Artifact

- added `scripts/generate-release-status-report.sh` and `scripts/test-release-status-report.sh` so Forge now emits `release-status.md/json`, a condensed operator-facing summary built from the 1.0 readiness audit, release matrix summary, and release provenance
- wired `pnpm release:status:test` into `scripts/release.sh`, the Ubuntu `release-readiness` CI job, and the tagged release matrix-summary follow-up so maintainers can validate and publish one final release-health artifact every time
- documented the new release-status layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, the 1.0 gate doc, and the `v0.1.70` release checklist

## 0.1.69 (2026-04-01)

### Forge 1.0 Release Gate

- added `docs/one-point-zero-gate.md`, `scripts/audit-one-point-zero-readiness.sh`, and `scripts/test-one-point-zero-readiness.sh` so Forge now has an explicit documented `1.0` contract plus a maintainer smoke test that emits `one-point-zero-readiness.md/json`
- wired `pnpm release:onepointzero:test` into `scripts/release.sh` and the Ubuntu `release-readiness` CI job so `release:ship` and pull requests both fail when the documented `1.0` gate drifts from repo scripts, official presets, or public docs
- documented the new 1.0 gate in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the `v0.1.69` release checklist

## 0.1.68 (2026-04-01)

### Recovery Command Summary

- added `scripts/generate-recovery-command-summary.sh` so provider-agnostic remote rollback drills now emit a stable `recovery-command-summary.md/json` artifact with the selected rollback target, archived asset list, rerun command, and operator follow-up actions
- updated `scripts/run-remote-release-rollback-drill.sh` and `scripts/test-remote-release-rollback-drill.sh` so both GitHub and S3 recovery paths validate that summary artifact as part of the existing remote rollback drill smoke
- documented the recovery summary output in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the `v0.1.68` release checklist

## 0.1.67 (2026-04-01)

### Provider-Agnostic Remote Rollback Drill

- added `scripts/run-remote-release-rollback-drill.sh` and `scripts/test-remote-release-rollback-drill.sh` so maintainers can fetch recent remote history, prepare the best matching rollback bundle, and run the rollback drill from one provider-agnostic command
- wired remote rollback drill smoke into `scripts/release.sh`, exposed it as `pnpm release:rollback:remote:test`, and added it to the Ubuntu `release-readiness` CI job so the final maintainer recovery wrapper regresses before `release:ship`
- documented the new provider-agnostic remote rollback drill flow in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the `v0.1.67` release checklist

## 0.1.66 (2026-04-01)

### Remote History Rollback Preparation

- added `scripts/fetch-release-history-from-github.sh`, `scripts/fetch-release-history-from-s3.sh`, `scripts/prepare-release-rollback-from-github-history.sh`, and `scripts/prepare-release-rollback-from-s3-history.sh` so maintainers can fetch several recent remote tags into one local history root and immediately prepare the best matching rollback bundle
- added `scripts/test-release-remote-history-preparation.sh`, wired it into `scripts/release.sh`, exposed it as `pnpm release:history:remote:test`, and added it to the Ubuntu `release-readiness` CI job so provider-specific history wrappers regress before `release:ship`
- documented the new remote-history rollback preparation flow in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the `v0.1.66` release checklist

## 0.1.65 (2026-04-01)

### History-Root Rollback Preparation

- added `scripts/prepare-release-rollback-from-history.sh` and `scripts/test-release-rollback-history-preparation.sh` so maintainers can go from a multi-tag `release-history-index.json` directly to a retrieved rollback bundle without manually stitching selector and retrieval steps together
- wired history-root rollback preparation smoke into `scripts/release.sh`, exposed it as `pnpm release:rollback:prepare:test`, and added it to the Ubuntu `release-readiness` CI job so PRs catch selector-to-retrieval regressions before `release:ship`
- documented the new one-command history-root rollback preparation flow in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the `v0.1.65` release checklist

## 0.1.64 (2026-03-31)

### Remote Release History Index

- added `scripts/generate-release-history-index.sh` and `scripts/test-release-history-index.sh` so maintainers can aggregate multiple fetched tag directories into one `release-history-index.md/json` view with per-tag and per-target history
- updated the GitHub and S3 archived bundle fetch helpers to refresh the parent release history index automatically, and included that presence in their fetch summaries
- wired release-history smoke into `scripts/release.sh`, exposed it as `pnpm release:history:test`, and added it to the Ubuntu `release-readiness` CI job so multi-tag recovery metadata stays healthy before `release:ship`

## 0.1.63 (2026-03-31)

### Archived Rollback Target Selection

- added `scripts/select-release-rollback-target.sh` and `scripts/test-release-rollback-target-selection.sh` so maintainers can choose the newest valid archived rollback candidate for a platform, arch, and recovery mode directly from `release-bundle-index.json`
- wired rollback-target selection smoke into `scripts/release.sh`, exposed it as `pnpm release:rollback:target:test`, and added it to the Ubuntu `release-readiness` CI job so PRs catch selector regressions before `release:ship`
- documented the new rollback-target selector in the repo README, deployment guide, CLI package README, AGENTS notes, and Codex project notes, and recorded the change in the `v0.1.63` release checklist

## 0.1.62 (2026-03-31)

### Archived Bundle S3 Fetch

- added `scripts/fetch-release-inventory-bundle-from-s3.sh` and `scripts/test-release-bundle-fetch-from-s3.sh` so maintainers can sync the archived bundle cache from S3 or R2, regenerate the bundle index if needed, and hand the retrieved bundle straight to rollback tooling
- updated the tagged release workflow to mirror `.release-bundles/` plus the generated bundle index, matrix summary, and provenance files into `s3://<bucket>/release-bundles/vX.Y.Z/` whenever `S3_ENABLED=true`
- wired S3 bundle-fetch smoke into `scripts/release.sh`, exposed it as `pnpm release:bundle:fetch:s3:test`, and documented the object-storage fetch path in the repo README, deployment guide, CLI package README, AGENTS notes, and Codex project notes

## 0.1.61 (2026-03-31)

### Archived Bundle Remote Fetch

- added `scripts/fetch-release-inventory-bundle-from-github.sh` and `scripts/test-release-bundle-fetch.sh` so maintainers can pull tagged GitHub Actions release artifacts with `gh`, restore the archived bundle index locally, and hand the result directly to rollback tooling
- wired GitHub bundle-fetch smoke into `scripts/release.sh`, exposed it as `pnpm release:bundle:fetch:test`, and documented the remote fetch path in the repo README, deployment guide, CLI package README, AGENTS notes, and Codex project notes
- recorded the new archived bundle fetch flow in the `v0.1.61` release checklist so `release:ship` can gate this version against the new recovery input path

## 0.1.60 (2026-03-31)

### Archived Bundle Index

- added `scripts/generate-release-bundle-index.sh` and `scripts/test-release-bundle-index.sh` so maintainers can build a versioned index of archived release bundles by platform and arch
- updated `scripts/retrieve-release-inventory-bundle.sh` to use `release-bundle-index.json` when present before falling back to raw bundle scanning
- wired bundle-index smoke into `scripts/release.sh`, exposed it as `pnpm release:bundle:index:test`, and made the release-matrix summary job upload `release-bundle-index.md/json`

## 0.1.59 (2026-03-31)

### Archived Bundle Retrieval

- Added `scripts/retrieve-release-inventory-bundle.sh` so maintainers can recover a canonical archived release inventory bundle by platform, arch, and version from downloaded workflow artifacts
- Added `scripts/test-release-inventory-retrieval.sh`, wired it into `scripts/release.sh`, and exposed it as `pnpm release:bundle:retrieve:test`
- Taught `scripts/run-rollback-drill.sh` to accept a retrieved bundle directory directly by resolving its bundled `files/` payload as rollback input
- Updated tagged release artifact uploads to preserve the full standardized bundle directory instead of only bundle summary files

## 0.1.57 (2026-03-31)

### Archived Release Inventory Bundles

- Added `scripts/bundle-release-inventory.sh` and `scripts/test-release-inventory-bundle.sh` so Forge can package release audit metadata, updater manifests, and rollback outputs into one reusable archived inventory bundle per platform
- Wired release inventory bundle smoke into `scripts/release.sh`, added root `pnpm release:bundle:test`, and made the tagged release workflow upload bundle summaries for both GitHub release output and S3 release output when enabled
- Documented the standardized archived bundle workflow in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the new `v0.1.57` release checklist

## 0.1.56 (2026-03-31)

### Rollback Drill Automation

- Added `scripts/run-rollback-drill.sh` and `scripts/test-rollback-drill.sh` so Forge maintainers can validate a candidate rollback target against archived prior-release metadata before touching a live channel
- Wired rollback drill smoke into `scripts/release.sh`, added root `pnpm release:drill:test`, and documented the archived-release drill flow alongside the existing rollback playbook and channel recovery layers
- Recorded the new drill workflow in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the new `v0.1.56` release checklist

## 0.1.55 (2026-03-31)

### Release Channel Recovery Audit

- Added `scripts/audit-release-channel-recovery.sh` and `scripts/test-release-channel-recovery.sh` so Forge can fail when rollback playbooks, release metadata, and publish-channel expectations drift between GitHub-only and GitHub+S3 recovery modes
- Wired channel recovery smoke into `scripts/release.sh`, added root `pnpm release:recovery:test`, and made the tagged release workflow upload `channel-recovery.md/json` for both the GitHub release output and the S3 parity output when enabled
- Documented the new recovery audit layer in the repo README, deployment guide, CLI package README, AGENTS notes, Codex project notes, and the new `v0.1.55` release checklist

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
## 0.1.124 (2026-04-04)

### Production Operations Retention

- added generated `pnpm ops:retention` and `scripts/ops-retention.sh` to the `production-ready` starter so repeated production audits prune stale `ops/snapshots/` and `ops/evidence/` directories
- wired generated validate and tagged release workflows to run `pnpm ops:retention -- --keep 3` before fresh ops snapshot and evidence collection
- extended scaffold smoke tests and release-surface audit to verify production-ready apps keep bounded operator evidence after repeated audits
- updated product docs to treat `ops:retention` as part of the production-grade release and operations flow
## 0.1.125 (2026-04-04)

### Production Operations Index

- added generated `pnpm ops:index` and `scripts/ops-index.sh` to the `production-ready` starter so operators can see the current snapshot and evidence inventory in one Markdown and JSON surface
- updated generated validate and tagged release workflows to upload `ops/index/` alongside `ops/snapshots/` and `ops/evidence/`
- extended production-ready scaffold smoke and release-surface audit to verify generated apps emit an ops index after retention and evidence generation
- updated production docs so `ops:index` is part of the default production-grade operating flow
