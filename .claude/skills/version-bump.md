---
name: version-bump
description: Bump version, commit, tag, and optionally push. Use after making changes.
user_invocable: true
---

# Version Bump Skill

Bump the version of ALL packages in the monorepo, commit the change, and create a git tag.

## Usage

- `/version-bump` — patch bump (0.1.0 → 0.1.1), commit, tag
- `/version-bump minor` — minor bump (0.1.0 → 0.2.0), commit, tag
- `/version-bump major` — major bump (0.1.0 → 1.0.0), commit, tag
- `/version-bump patch --push` — bump + commit + tag + push (triggers CI release)

## Steps

1. Parse bump type from args (default: `patch`). Check if `--push` flag is present.

2. Read current version from root `package.json`.

3. Run the release script to update ALL package.json files:
   ```bash
   ./scripts/release.sh <patch|minor|major>
   ```

4. Stage and commit all changed package.json files:
   ```bash
   git add package.json apps/*/package.json packages/*/package.json
   git commit -m "release: v<NEW_VERSION>"
   ```

5. Create git tag:
   ```bash
   git tag v<NEW_VERSION>
   ```

6. If `--push` flag was provided:
   ```bash
   git push origin main
   git push origin v<NEW_VERSION>
   ```
   Tell the user this will trigger the CI release workflow.

7. If no `--push`, tell the user:
   ```
   Version bumped to v<NEW_VERSION>
   To publish: git push origin main && git push origin v<NEW_VERSION>
   ```

## Important
- Always show the user the old version → new version before committing
- Never push without the `--push` flag or explicit user confirmation
- The release.sh script handles updating ALL workspace package.json files
