# Forge Desktop Framework — Deployment Guide

This guide covers building, releasing, and publishing Forge Desktop apps using the `create-forge-desktop` and GitHub Actions.

## Prerequisites

- **Node.js 20+** and **pnpm 10+**
- **Python 3.12+** with `pip`
- **Git** with push access to your GitHub repository
- **AWS CLI** (only if publishing to S3/R2)

### Code Signing (optional but recommended for production)

- **macOS**: Apple Developer certificate (Developer ID Application), exported as `.p12`
- **Windows**: Code signing certificate (`.pfx` or `.p12`)
- **Apple Notarization**: Apple ID with app-specific password and Team ID

## CLI Commands

Install the CLI globally or use it from the monorepo:

```bash
# From monorepo
pnpm --filter create-forge-desktop build
npx forge --help

# Or install globally
npm install -g create-forge-desktop
```

### Available Commands

| Command | Description |
|---------|-------------|
| `forge create [name]` | Scaffold a new Forge app from a template |
| `forge build` | Build packages, Python worker, and Electron app |
| `forge release [type]` | Bump version, create git commit and tag |
| `forge publish` | Build and publish to GitHub Releases |
| `forge publish --s3` | Build and publish to S3/R2 |
| `forge dev [target]` | Start development mode |

Scaffolded apps now include baseline packaging files:
- `electron-builder.yml`
- `electron-builder.s3.yml`
- `build/entitlements.mac.plist`
- `.env.example`
- `.github/workflows/validate.yml`
- `.github/workflows/release.yml`
- `docs/release-playbook.md`
- `scripts/setup-python.sh`
- `scripts/build-worker.sh`
- `scripts/build-app.sh`
- `scripts/preflight-release.sh`

Scaffolded apps also include:
- `pnpm release:check` for local release preflight
- tagged GitHub Actions publishing via `.github/workflows/release.yml`

The `minimal` starter also supports feature packs during scaffolding:

```bash
forge create my-app --template minimal --feature settings --feature updater --feature diagnostics
```

For the fastest production baseline, use the preset:

```bash
forge create my-app --template minimal --preset launch-ready
```

You can also seed release metadata up front:

```bash
forge create my-app --template minimal \
  --product-name "My App" \
  --app-id "com.acme.myapp" \
  --github-owner acme \
  --github-repo my-app
```

## Setting Up GitHub Actions Secrets

Navigate to your repository **Settings > Secrets and variables > Actions** and add:

### Required

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions |

### macOS Code Signing

| Secret | Description |
|--------|-------------|
| `CSC_LINK` | Base64-encoded `.p12` certificate |
| `CSC_KEY_PASSWORD` | Password for the `.p12` certificate |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password (generate at appleid.apple.com) |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

### Windows Code Signing

| Secret | Description |
|--------|-------------|
| `WIN_CSC_LINK` | Base64-encoded `.pfx` certificate |
| `WIN_CSC_KEY_PASSWORD` | Password for the `.pfx` certificate |

### S3/R2 Publishing (optional)

| Secret / Variable | Description |
|--------------------|-------------|
| `AWS_ACCESS_KEY_ID` | S3/R2 access key |
| `AWS_SECRET_ACCESS_KEY` | S3/R2 secret key |
| `S3_BUCKET` | Bucket name |
| `S3_ENDPOINT` | S3-compatible endpoint URL |
| `S3_UPDATE_URL` | Public URL for auto-update (e.g., `https://releases.example.com`) |
| `S3_ENABLED` (variable) | Set to `true` to enable S3 upload in CI |
| `AWS_REGION` (variable) | AWS region (default: `auto` for R2) |

To encode a certificate as base64:

```bash
base64 -i certificate.p12 | pbcopy  # macOS
base64 -w 0 certificate.p12         # Linux
```

## Local Deployment

### Build and Publish to GitHub

```bash
# 1. Bump version and tag
forge release patch    # or minor, major

# 2. Push to trigger CI
git push && git push --tags
```

The repo release script now runs scaffold verification before the version bump. If you want to run the same check manually first, use:

```bash
pnpm scaffold:test
```

### Build and Publish Locally

```bash
# Verify local release prerequisites
pnpm release:check

# GitHub Releases
export GH_TOKEN="your-github-token"
forge publish

# S3/R2
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export S3_BUCKET="my-releases"
export S3_ENDPOINT="https://abc.r2.cloudflarestorage.com"
export S3_UPDATE_URL="https://releases.example.com"
forge publish --s3

# Both
forge publish --github --s3
```

## S3/R2 Setup

### Cloudflare R2

1. Go to **Cloudflare Dashboard > R2 > Create bucket**
2. Create a bucket (e.g., `forge-releases`)
3. Under **Settings > Public access**, enable public access or set up a custom domain
4. Generate **R2 API tokens** under **Manage R2 API Tokens**:
   - Permission: Object Read & Write
   - Specify bucket: your release bucket
5. Note down:
   - **Access Key ID** and **Secret Access Key**
   - **Endpoint**: `https://<account-id>.r2.cloudflarestorage.com`
   - **Public URL**: your custom domain or `https://pub-<hash>.r2.dev`

### AWS S3

1. Create an S3 bucket with public read access (or CloudFront distribution)
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` permissions
3. Note down Access Key ID, Secret Access Key, region, and bucket name

### Bucket Structure

After publishing, the bucket will contain:

```
releases/
  v0.1.0/
    Forge App-0.1.0.dmg
    Forge App-0.1.0-arm64.dmg
    Forge App Setup 0.1.0.exe
    Forge App-0.1.0.AppImage
    latest-mac.yml
    latest.yml
    latest-linux.yml
  v0.2.0/
    ...
  latest/
    latest-mac.yml
    latest.yml
    latest-linux.yml
```

## Auto-Update Configuration

The app uses `electron-updater` for automatic updates. To enable auto-update:

### GitHub Releases (default)

Set environment variables `GH_OWNER` and `GH_REPO` (or they default from the `publish` config in `electron-builder.yml`).

### S3/R2 (generic provider)

Use the `electron-builder.s3.yml` config which extends the base config and overrides the publish provider to `generic` with your `S3_UPDATE_URL`.

### In your app's main process

```typescript
import { autoUpdater } from 'electron-updater';
import { app } from 'electron';

// Only check in production
if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    // Prompt user to restart
    autoUpdater.quitAndInstall();
  });
}
```

## Testing Updates

1. Build and publish version `0.1.0`
2. Bump to `0.2.0` and publish again
3. Install `0.1.0`, launch it, and verify the updater detects `0.2.0`

### Local Testing

For local testing without publishing:

```bash
# Package the app locally
pnpm --filter @forge/app package

# The packaged app will be in apps/app/release/
# Install and run it to test
```

## Troubleshooting

### Code signing errors on macOS

- Ensure your certificate is a **Developer ID Application** certificate (not iOS distribution)
- Check that `CSC_LINK` is properly base64-encoded
- Run `security find-identity -v -p codesigning` to verify local certificates

### Notarization failures

- Verify `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` are correct
- Check Apple's notarization status: `xcrun notarytool log <submission-id> --apple-id <email> --team-id <team>`
- Ensure `hardenedRuntime: true` is set in electron-builder config

### S3 upload failures

- Verify AWS credentials have the correct permissions
- Check that `S3_ENDPOINT` is correct (include `https://`)
- For R2, ensure the region is set to `auto`
- Test with: `aws s3 ls s3://$S3_BUCKET/ --endpoint-url $S3_ENDPOINT`

### Auto-update not working

- The app must be code-signed for auto-update on macOS
- Check that `latest-mac.yml` / `latest.yml` / `latest-linux.yml` exist at the update URL
- Verify the update URL is publicly accessible
- Check the app logs for updater errors (usually in `~/Library/Logs/<app-name>/`)

### Build failures in CI

- Check that all secrets are properly set in GitHub Actions
- Verify the Python worker builds successfully by checking the worker step logs
- For Windows builds, ensure `WIN_CSC_LINK` is a `.pfx` certificate
