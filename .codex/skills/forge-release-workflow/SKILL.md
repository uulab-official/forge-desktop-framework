---
name: forge-release-workflow
description: Use when changing build, release, versioning, publish, or packaging flows in forge-desktop-framework. Verify real workspace paths, app output paths, and required environment variables before shipping.
---

# Forge Release Workflow

## Use This Skill When
- editing `packages/create-forge-app/src/commands/build.ts`
- editing `packages/create-forge-app/src/commands/release.ts`
- editing `packages/create-forge-app/src/commands/publish.ts`
- editing `scripts/build-app.sh`, `scripts/release.sh`, or deployment docs

## Checks Before Editing
- Confirm actual workspace roots under `apps/`, `packages/`, and `examples/`.
- Confirm packaging output path from `apps/app/electron-builder.yml`.
- Check whether docs describe the same command and output path.

## Guardrails
- Version bumps should cover every published workspace that carries a version.
- Do not assume `app/` exists at repo root; verify whether the real path is `apps/app/`.
- Do not require `release/` artifacts to exist before the packaging step that creates them.
- Keep CLI behavior and `docs/deployment.md` consistent.

## Validation
- `pnpm --filter create-forge-desktop build`
- targeted command smoke tests when possible
- review `git diff` for path regressions in docs and code
