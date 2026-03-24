---
name: dev
description: Start development mode for a specific package or example
user_invocable: true
---

# Dev Skill

Start development mode for any part of the framework.

## Usage
- "/dev" — start the reference app (app)
- "/dev <example>" — start an example (e.g., "/dev minimal")
- "/dev <package>" — watch-build a package

## Steps

1. Parse the target from args
2. If no target: run `pnpm --filter @forge/app dev`
3. If target matches an example name: run `pnpm --filter @forge-example/<target> dev`
4. If target matches a package name: run `pnpm --filter @forge/<target> dev`
5. Run the command in background and tell the user
