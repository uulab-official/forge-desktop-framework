---
name: forge-template-workflow
description: Use when changing scaffold templates, examples, or the create-forge-desktop package. Examples are the source of truth; keep template copies and template metadata in sync.
---

# Forge Template Workflow

## Use This Skill When
- editing `examples/*`
- editing `packages/create-forge-app/`
- adding or removing templates
- changing scaffolded project structure or next-step instructions

## Source Of Truth
- Author behavior in `examples/` first when possible.
- Sync generated template copies with `scripts/sync-templates.sh`.
- Treat `packages/create-forge-app/templates/` as distributable artifacts, not the canonical implementation.

## Required Checks
1. Update the matching example or confirm the change is CLI-only.
2. Keep `src/templates.ts` aligned with the available templates.
3. If scaffold output changes, check `src/scaffold.ts` and `src/commands/create.ts`.
4. If the user journey changes, update docs or template README files in the same pass.

## Validation
- `bash scripts/sync-templates.sh`
- `pnpm --filter create-forge-desktop build`
- Smoke-test one affected template if the task changes generated output
