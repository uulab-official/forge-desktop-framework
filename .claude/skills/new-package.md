---
name: new-package
description: Scaffold a new @forge package in the monorepo
user_invocable: true
---

# New Package Skill

Create a new framework package with the standard structure.

## Usage
The user will say "/new-package <name>" (e.g., "/new-package theme-manager")

## Steps

1. Parse the package name from args
2. Create `packages/<name>/` directory
3. Create package.json:
   - name: `@forge/<name>`
   - version matching root package.json
   - type: module
   - exports, scripts (build, dev, typecheck, clean)
   - devDependencies: typescript
4. Create tsconfig.json extending ../../tsconfig.base.json
5. Create src/index.ts with a placeholder export
6. Run `pnpm install` to link the new package
7. Run `pnpm --filter @forge/<name> build` to verify
8. Report success
