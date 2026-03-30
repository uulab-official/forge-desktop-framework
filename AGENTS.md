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
