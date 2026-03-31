# Scaffold Test Global Shortcut 79141 Release Playbook

## 1. Set Metadata

- Verify `electron-builder.yml` still matches your release identity: `Scaffold Test Global Shortcut 79141` / `com.forge.scaffoldtestglobalshortcut79141`.
- Replace placeholder icons and assets inside `build/` and `resources/`.
- Confirm `package.json` version before tagging a release.

## 2. Configure Secrets

- Copy `.env.example` to `.env` for local packaging smoke tests.
- Add the same values as GitHub Actions secrets and variables for CI releases.
- Default GitHub target for publishing is `your-github-org-or-user/scaffoldtestglobalshortcut79141`. Override with `GH_OWNER` and `GH_REPO` if needed.
- macOS signing requires `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.
- Windows signing requires `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

## 3. Local Smoke Test

```bash
pnpm install
pnpm release:check
pnpm publish:check:github
pnpm setup:python
pnpm build:app
pnpm package:verify
pnpm package:audit
```

## 4. CI Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

Pushing a `v*` tag triggers `.github/workflows/release.yml` and publishes artifacts via `electron-builder`.

## 5. Auto-Update Channel

- GitHub Releases works out of the box for `your-github-org-or-user/scaffoldtestglobalshortcut79141` unless you override `GH_OWNER` and `GH_REPO`.
- For generic/S3 hosting, switch to `electron-builder.s3.yml` and populate the S3 variables in `.env.example`.
- Run `pnpm publish:check:s3` before a generic/S3 publish so missing bucket, endpoint, or update URL values fail fast.
