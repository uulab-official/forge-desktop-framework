---
name: version-bump
description: Bump framework version across all packages and prepare for release
user_invocable: true
---

# Version Bump Skill

Bump the version of all packages in the forge-desktop-framework monorepo.

## Usage
The user will say something like "/version-bump patch" or "/version-bump minor" or "/version-bump major".

## Steps

1. Parse the bump type from the user's message (default: patch)
2. Read the current version from root package.json
3. Calculate the new version
4. Run `./scripts/release.sh <type>` to update all package.json files
5. Show the user what changed
6. Ask if they want to commit and tag
