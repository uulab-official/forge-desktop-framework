---
name: forge-framework-maintainer
description: Use when changing shared framework packages, repo-wide docs, or public conventions in forge-desktop-framework. Keep CLI, docs, examples, and scripts aligned as one product surface.
---

# Forge Framework Maintainer

## Use This Skill When
- the task changes shared packages under `packages/`
- the task changes public docs or onboarding
- a repo-wide convention or workflow is being introduced
- the user asks to "improve the framework" rather than a single app

## Workflow
1. Identify the public surface affected:
   - docs
   - scaffold CLI
   - examples
   - scripts or release flow
2. Check whether the same promise appears elsewhere in the repo.
3. Make the smallest coherent change that keeps those surfaces aligned.
4. Validate at the package level first, then with the narrowest repo-wide check that still proves the change.

## Repo Conventions
- `examples/` are the clearest product examples.
- `packages/create-forge-app/` is the public scaffold/distribution entry point.
- `docs/` should describe real workflows, not aspirational ones.
- When a feature is called "official" or "built-in", remove "upcoming" language from related examples and docs.

## Validation Shortlist
- `pnpm --filter create-forge-desktop build`
- `pnpm --filter @forge/app build`
- `pnpm typecheck`
