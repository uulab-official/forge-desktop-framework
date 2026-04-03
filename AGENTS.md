# forge-desktop-framework

## Purpose
Forge is a framework product, not just a monorepo. Keep the public story aligned across:
- `docs/`
- `packages/create-forge-app/`
- `examples/`
- `scripts/`

If a change affects onboarding, packaging, scaffolding, or examples, update the matching docs and CLI behavior in the same pass.

## Repo Map
- `apps/app/` — reference Electron app
- `apps/worker/` — reference Python worker
- `packages/` — reusable framework packages
- `packages/create-forge-app/` — public CLI (`create-forge-desktop`, `forge-desktop`)
- `examples/` — source of truth for scaffold templates
- `docs/` — product documentation
- `scripts/` — monorepo automation

## Working Rules
- Prefer changing `examples/` first when the scaffolded app behavior should change.
- Treat `packages/create-forge-app/templates/` as generated copies. Sync them from `examples/` with `scripts/sync-templates.sh`.
- Keep terms consistent. If docs say a package or workflow is "official", the code should already support it.
- When touching build, release, or publish flows, verify actual paths under `apps/`, `packages/`, and `examples/` rather than assuming old monorepo layouts.
- Framework-facing work should bump the repo version. Default to `./scripts/release.sh patch` unless the change clearly needs `minor` or `major`.
- Use `./scripts/ship-release.sh patch` when the framework change is ready to validate, version, commit, tag, and push in one pass from `main`.
- Never bump the framework version before running scaffold build verification. Use `bash scripts/test-scaffold-builds.sh`, `bash scripts/test-external-scaffold.sh`, or the release script, which now runs both automatically.
- Before shipping from `main`, prefer `pnpm release:ship patch`; it now includes internal scaffold smoke, external scaffold smoke, and official preset release-surface audit.
- Before shipping from `main`, create and mark the next version checklist `ready` under `docs/release-checklists/vX.Y.Z.md`; `release:ship` now verifies that file before any release gate runs.
- Keep `.github/workflows/ci.yml` aligned with those guards so PRs catch release regressions before maintainers run `release:ship`.
- Keep `.github/workflows/release.yml` aligned too: packaged release jobs should emit human-readable inventories, generated rollback playbooks, channel recovery audits, a final matrix summary plus provenance record, and fail early when signing secrets, platform-specific installers, publish channel parity, rollback readiness, or `latest*.yml` manifest contents are wrong.
- Use the archived-release rollback drill helpers when you need to validate that a previous tagged inventory can satisfy the generated rollback playbook before touching a live channel.
- Prefer the standardized release inventory bundle as the archived rollback input shape; keep bundle contents and retrieval tooling aligned with the drill helpers and tagged release artifacts.
- Keep the archived bundle index aligned with retrieval helpers so maintainers can discover available rollback targets before running drills.
- Keep release history indexing aligned with remote fetch helpers so multiple cached tags can be reasoned about without manual directory browsing.
- Keep rollback target selection aligned with the archived bundle index so maintainers can choose the newest valid previous version without hand-browsing archived bundles.
- Keep history-root rollback preparation aligned with selectors and retrieval helpers so accumulated cached tags can turn into one drill-ready bundle without manual path stitching.
- Keep remote GitHub artifact fetch helpers aligned with bundle retrieval so a tagged release can be reconstructed from `gh` without manual artifact browsing.
- Keep object-storage bundle mirroring aligned with retrieval helpers so S3 or R2 rollback inputs match the same archive shape as GitHub artifact downloads.
- Keep remote multi-tag history fetch wrappers aligned with the single-tag GitHub and S3 fetch helpers so provider-specific recovery flows do not drift.
- Keep the final remote rollback drill wrapper aligned with both provider-specific history wrappers and the local rollback drill so maintainers have one coherent recovery path.
- Keep the recovery-command summary aligned with the final remote rollback drill wrapper so maintainers can trust the emitted rerun command, selected target, and next actions.
- Keep `docs/one-point-zero-gate.md` aligned with the actual release and recovery guards, and keep `pnpm release:onepointzero:test` green before shipping.
- Keep the final `release-status.md/json` summary aligned with the 1.0 readiness audit, matrix summary, and provenance so maintainers can review one stable release-health artifact instead of stitching audits together by hand.
- Keep the final `one-point-zero-freeze.md/json` summary aligned with both the release-status artifact and the version checklist so the freeze decision remains auditable.
- Keep the final `one-point-zero-decision.md/json` summary aligned with readiness, release-status, and freeze so the last `1.0` go or hold handoff stays reproducible.
- Keep the final `one-point-zero-release-candidate.md/json` summary aligned with the decision artifact so the `1.0.0` promotion handoff and next-checklist target remain explicit.
- Keep the `prepare-one-point-zero-major-checklist.sh` helper aligned with the release-candidate artifact so the generated `v1.0.0` checklist draft matches the documented promotion path.
- Keep the final `one-point-zero-promotion-plan.md/json` summary aligned with the release-candidate artifact and prepared `v1.0.0` checklist so the first major-release staging plan stays reproducible.
- Keep the final `one-point-zero-major-release-runbook.md/json` summary aligned with the promotion plan so the first `1.0.0` ship sequence stays explicit and reproducible.
- Keep the final `one-point-zero-major-release-approval.md/json` summary aligned with the decision, promotion plan, and major-runbook layers so the first `1.0.0` go/no-go handoff stays reproducible.
- Keep the final `one-point-zero-major-release-cockpit.md/json` summary aligned with readiness, release-status, decision, promotion plan, runbook, and approval so the first `1.0.0` operator view stays reproducible.
- Keep the final `one-point-zero-major-release-packet.md/json` summary aligned with the green cockpit artifact and prepared `v1.0.0` checklist so the first `1.0.0` human sign-off packet stays reproducible.
- Keep the final `one-point-zero-major-release-signoff.md/json` summary aligned with the packet and prepared `v1.0.0` checklist so the first `1.0.0` reviewer signoff sheet stays reproducible.
- Keep the final `one-point-zero-major-release-board.md/json` summary aligned with the signoff sheet and prepared `v1.0.0` checklist so the first `1.0.0` board review artifact stays reproducible.
- Keep the final `one-point-zero-major-release-verdict.md/json` summary aligned with the board artifact and prepared `v1.0.0` checklist so the first `1.0.0` maintainer go/no-go sheet stays reproducible.
- Keep the final `one-point-zero-major-release-authorization.md/json` summary aligned with the verdict artifact and prepared `v1.0.0` checklist so the first `1.0.0` execution authorization sheet stays reproducible.
- Keep the final `one-point-zero-major-release-warrant.md/json` summary aligned with the authorization artifact and prepared `v1.0.0` checklist so the first `1.0.0` launch-side warrant sheet stays reproducible.
- Keep the final `one-point-zero-major-release-launch-sheet.md/json` summary aligned with the warrant artifact and prepared `v1.0.0` checklist so the first `1.0.0` execution handoff stays reproducible.
- Keep the final `one-point-zero-major-release-command-card.md/json` summary aligned with the launch-sheet artifact and prepared `v1.0.0` checklist so the first `1.0.0` command surface stays reproducible.
- Keep the final `one-point-zero-major-release-preflight.md/json` summary aligned with the command-card artifact and prepared `v1.0.0` checklist so the first `1.0.0` preflight gate stays reproducible.
- Keep the final `one-point-zero-major-release-trigger.md/json` summary aligned with the preflight artifact and prepared `v1.0.0` checklist so the first `1.0.0` execution trigger stays reproducible.
- Keep the final `one-point-zero-major-release-rehearsal.md/json` summary aligned with the trigger artifact and prepared `v1.0.0` checklist so the first `1.0.0` dry-run rehearsal stays reproducible.
- Keep the final `one-point-zero-major-release-seal.md/json` summary aligned with the attestation artifact and prepared `v1.0.0` checklist so the first `1.0.0` immutable seal stays reproducible.
- Keep the final `one-point-zero-major-release-charter.md/json` summary aligned with the seal artifact and prepared `v1.0.0` checklist so the first `1.0.0` immutable charter stays reproducible.
- Keep the final `one-point-zero-major-release-canon.md/json` summary aligned with the charter artifact and prepared `v1.0.0` checklist so the first `1.0.0` immutable canon stays reproducible.
- Keep the final `one-point-zero-major-release-constitution.md/json`, `one-point-zero-major-release-covenant.md/json`, `one-point-zero-major-release-compact.md/json`, `one-point-zero-major-release-capsule.md/json`, `one-point-zero-major-release-ledger.md/json`, `one-point-zero-major-release-archive.md/json`, `one-point-zero-major-release-vault.md/json`, `one-point-zero-major-release-registry.md/json`, `one-point-zero-major-release-directory.md/json`, `one-point-zero-major-release-manifest.md/json`, and `one-point-zero-major-release-dossier.md/json` summaries aligned with the canon artifact and prepared `v1.0.0` checklist so the first `1.0.0` immutable constitution, covenant, compact, capsule, ledger, archive, vault, registry, directory, manifest, and dossier stay reproducible.

## Validation
- Framework-wide checks: `pnpm build`, `pnpm typecheck`
- CLI package: `pnpm --filter create-forge-desktop build`
- Scaffold verification: `bash scripts/test-scaffold-builds.sh`
- External scaffold verification: `bash scripts/test-external-scaffold.sh`
- Reference app: `pnpm --filter @forge/app build`
- Python worker smoke test: `bash scripts/test-workers.sh`

## Codex Notes
- Codex reads `AGENTS.md` from the repo. Use this file for the short operational contract.
- Repo-local playbooks live in `.codex/`.
- Start with `.codex/project.md` for framework priorities.
- Open the matching skill when the task fits:
  - `.codex/skills/forge-framework-maintainer/SKILL.md`
  - `.codex/skills/forge-template-workflow/SKILL.md`
  - `.codex/skills/forge-release-workflow/SKILL.md`
