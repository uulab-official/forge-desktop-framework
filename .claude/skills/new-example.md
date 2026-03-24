---
name: new-example
description: Scaffold a new example app from the minimal template
user_invocable: true
---

# New Example Skill

Create a new example app based on the minimal template.

## Usage
The user will say "/new-example <name>" (e.g., "/new-example image-editor")

## Steps

1. Parse the example name from args
2. Copy examples/minimal/ to examples/<name>/
3. Update package.json name to @forge-example/<name>
4. Update index.html title
5. Update App.tsx with a placeholder for the new example
6. Update worker actions for the new example domain (imports use `from forge_worker import register`)
7. Run `pnpm install`
8. Add to packages/create-forge-app/src/templates.ts
9. Report success
