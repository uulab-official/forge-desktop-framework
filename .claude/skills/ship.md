---
name: ship
description: Commit current changes, bump patch version, tag, and push. One command to ship.
user_invocable: true
---

# Ship Skill

The all-in-one "I'm done, ship it" command. Commits staged changes, bumps patch version, tags, and pushes.

## Usage

- `/ship` — commit + patch bump + tag + push
- `/ship minor` — commit + minor bump + tag + push
- `/ship "fix: resolve worker timeout"` — commit with custom message + patch bump + tag + push

## Steps

1. Check `git status` for uncommitted changes. If clean, tell user "Nothing to ship."

2. Parse args:
   - If arg is "minor" or "major", use that as bump type
   - If arg is a string starting with a letter, use it as commit message
   - Default: patch bump, auto-generated commit message

3. If no custom commit message, analyze the diff to generate one:
   - Run `git diff --cached --stat` (or `git diff --stat` if nothing staged)
   - Generate a concise conventional commit message based on changed files

4. Stage all changes:
   ```bash
   git add -A
   ```

5. Commit:
   ```bash
   git commit -m "<message>"
   ```

6. Bump version (run release.sh):
   ```bash
   ./scripts/release.sh <patch|minor|major>
   ```

7. Commit the version bump:
   ```bash
   git add package.json apps/*/package.json packages/*/package.json
   git commit -m "release: v<NEW_VERSION>"
   ```

8. Tag:
   ```bash
   git tag v<NEW_VERSION>
   ```

9. Push:
   ```bash
   git push origin main
   git push origin v<NEW_VERSION>
   ```

10. Report:
    ```
    Shipped v<NEW_VERSION>
    - Commit: <short hash> <message>
    - Tag: v<NEW_VERSION>
    - CI release triggered
    ```

## Important
- Always show the user what will be committed (file list) before proceeding
- If there are untracked files that look sensitive (.env, credentials), warn before staging
- The push triggers the GitHub Actions release workflow
