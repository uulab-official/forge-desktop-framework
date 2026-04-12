# Stewardship Repro 28934 Release Playbook

## 1. Set Metadata

- Verify `electron-builder.yml` still matches your release identity: `Stewardship Repro 28934` / `com.forge.stewardshiprepro28934`.
- Replace placeholder icons and assets inside `build/` and `resources/`.
- Confirm `package.json` version before tagging a release.

## 2. Configure Secrets

- Copy `.env.example` to `.env` for local packaging smoke tests.
- Add the same values as GitHub Actions secrets and variables for CI releases.
- Default GitHub target for publishing is `your-github-org-or-user/stewardshiprepro28934`. Override with `GH_OWNER` and `GH_REPO` if needed.
- macOS signing requires `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.
- Windows signing requires `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

## 3. Local Smoke Test

```bash
pnpm install
pnpm release:check
pnpm security:check
pnpm ops:check
pnpm ops:retention -- --keep 3
pnpm production:check
pnpm package
pnpm ops:stewardship -- --label release-smoke --require-release-output
```

Use `pnpm production:check:s3 -- --require-release-output` when the app will ship through a generic/S3 update channel.

## 4. CI Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

Pushing a `v*` tag triggers `.github/workflows/release.yml` and publishes artifacts via `electron-builder`.

## 4.5 Final Ops Handoff

```bash
pnpm ops:oversight -- --label release-oversight --require-release-output
pnpm ops:control -- --label release-control --require-release-output
pnpm ops:authority -- --label release-authority --require-release-output
pnpm ops:stewardship -- --label release-stewardship --require-release-output
```

Use `pnpm ops:oversight` when you want the final production oversight packet under `ops/oversight/`, `pnpm ops:control` when you want one last operator-facing control packet under `ops/control/`, `pnpm ops:authority` when you want the final production authority packet under `ops/authority/`, and `pnpm ops:stewardship` when you want one last production stewardship packet under `ops/stewardship/` before close-out.

## 5. Auto-Update Channel

- GitHub Releases works out of the box for `your-github-org-or-user/stewardshiprepro28934` unless you override `GH_OWNER` and `GH_REPO`.
- For generic/S3 hosting, switch to `electron-builder.s3.yml` and populate the S3 variables in `.env.example`.
- Run `pnpm publish:check:s3` before a generic/S3 publish so missing bucket, endpoint, or update URL values fail fast.
- Run `pnpm production:check:all -- --require-release-output` after local packaging when you want one command that rechecks every configured channel.
