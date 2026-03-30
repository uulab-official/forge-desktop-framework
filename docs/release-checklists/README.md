# Release Checklists

Forge keeps one checklist per shipped version in this directory.

Rules:
- Create the next checklist before running `pnpm release:ship`.
- Keep the filename as `vX.Y.Z.md`.
- Set `- Status: ready` before shipping.
- Leave the checklist in the repo as the release planning record for that version.

Useful commands:

```bash
bash scripts/create-release-checklist.sh patch
bash scripts/verify-release-checklist.sh patch
```
