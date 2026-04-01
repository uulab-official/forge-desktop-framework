#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-remote-rollback-drill.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

create_release_fixture() {
  local case_dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"
  local manifest="$6"
  local mode="$7"

  mkdir -p "$case_dir"

  cat > "$case_dir/artifact-summary.md" <<'EOF'
# Artifact Summary
EOF
  cat > "$case_dir/artifact-summary.json" <<EOF
{
  "version": "$version",
  "platform": "$platform",
  "arch": "$arch",
  "artifacts": [
    { "file": "$installer", "size": "42 MB", "kind": "installer", "path": "$installer" },
    { "file": "$manifest", "size": "1 KB", "kind": "manifest", "path": "$manifest" }
  ]
}
EOF

  cat > "$case_dir/manifest-audit.md" <<'EOF'
# Manifest Audit
EOF
  cat > "$case_dir/manifest-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "status": "passed",
  "manifests": [
    {
      "file": "$manifest",
      "version": "$version",
      "path": "$installer",
      "sha512Present": true,
      "versionMatches": true,
      "pathExists": true
    }
  ],
  "checks": {
    "allVersionsMatch": true,
    "allPathsExist": true,
    "allShaPresent": true
  }
}
EOF

  cat > "$case_dir/publish-audit.md" <<'EOF'
# Publish Audit
EOF
  cat > "$case_dir/publish-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "status": "passed"
}
EOF

  cat > "$case_dir/rollback-readiness.md" <<'EOF'
# Rollback Readiness
EOF
  cat > "$case_dir/rollback-readiness.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "version": "$version",
  "status": "passed",
  "requiredArtifacts": [
    "$installer",
    "$manifest"
  ]
}
EOF

  cat > "$case_dir/$manifest" <<EOF
version: $version
path: $installer
sha512: ${platform}${version}
files:
  - url: $installer
    sha512: ${platform}${version}
    size: 100
EOF
  touch "$case_dir/$installer"

  if [[ "$mode" == "dual-channel" ]]; then
    cat > "$case_dir/channel-parity.md" <<'EOF'
# Channel Parity
EOF
    cat > "$case_dir/channel-parity.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "status": "passed"
}
EOF
  fi

  bash scripts/generate-rollback-playbook.sh "$case_dir" "$platform" "$arch" "$version"
  bash scripts/audit-release-channel-recovery.sh "$case_dir" "$platform" "$arch" "$version" "$mode"
}

setup_github_fixtures() {
  local fixture_root="$1"

  mkdir -p "$fixture_root/v0.1.66" "$fixture_root/v0.1.65" "$fixture_root/v0.1.64"

  mkdir -p "$WORK_DIR/github-prev" "$WORK_DIR/github-older"
  create_release_fixture "$WORK_DIR/github-prev" "mac" "arm64" "0.1.65" "Forge-App-0.1.65.dmg" "latest-mac.yml" "dual-channel"
  create_release_fixture "$WORK_DIR/github-older" "mac" "arm64" "0.1.64" "Forge-App-0.1.64.dmg" "latest-mac.yml" "github-only"

  # Current tag can exist remotely too, but rollback should still pick the older one.
  create_release_fixture "$WORK_DIR/github-current-remote" "mac" "arm64" "0.1.66" "Forge-App-0.1.66.dmg" "latest-mac.yml" "dual-channel"

  bash scripts/bundle-release-inventory.sh "$WORK_DIR/github-current-remote" "$fixture_root/v0.1.66/release-inventory-mac-arm64" "mac" "arm64" "0.1.66"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/github-prev" "$fixture_root/v0.1.65/release-inventory-mac-arm64" "mac" "arm64" "0.1.65"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/github-older" "$fixture_root/v0.1.64/release-inventory-mac-arm64" "mac" "arm64" "0.1.64"

  for version in 0.1.66 0.1.65 0.1.64; do
    tag="v$version"
    bash scripts/generate-release-bundle-index.sh "$fixture_root/$tag" "$fixture_root/$tag"
    cat > "$fixture_root/$tag/release-matrix-summary.json" <<EOF
{
  "version": "$version",
  "targets": [
    {
      "platform": "mac",
      "arch": "arm64",
      "artifactDir": "release-inventory-mac-arm64"
    }
  ]
}
EOF
    cat > "$fixture_root/$tag/release-provenance.json" <<EOF
{
  "tag": "$tag",
  "commitSha": "deadbeef${version//./}",
  "version": "$version"
}
EOF
  done
}

setup_s3_fixtures() {
  local fixture_root="$1"

  mkdir -p "$fixture_root/forge-release-cache/release-bundles/v0.1.66"
  mkdir -p "$fixture_root/forge-release-cache/release-bundles/v0.1.65"
  mkdir -p "$fixture_root/forge-release-cache/release-bundles/v0.1.64"

  create_release_fixture "$WORK_DIR/s3-current-remote" "mac" "arm64" "0.1.66" "Forge-App-0.1.66.dmg" "latest-mac.yml" "dual-channel"
  create_release_fixture "$WORK_DIR/s3-prev" "mac" "arm64" "0.1.65" "Forge-App-0.1.65.dmg" "latest-mac.yml" "dual-channel"
  create_release_fixture "$WORK_DIR/s3-older" "mac" "arm64" "0.1.64" "Forge-App-0.1.64.dmg" "latest-mac.yml" "github-only"

  bash scripts/bundle-release-inventory.sh "$WORK_DIR/s3-current-remote" "$fixture_root/forge-release-cache/release-bundles/v0.1.66" "mac-s3" "arm64" "0.1.66"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/s3-prev" "$fixture_root/forge-release-cache/release-bundles/v0.1.65" "mac-s3" "arm64" "0.1.65"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/s3-older" "$fixture_root/forge-release-cache/release-bundles/v0.1.64" "mac-s3" "arm64" "0.1.64"

  cat > "$fixture_root/forge-release-cache/release-bundles/v0.1.66/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.66",
  "targets": [
    { "platform": "mac-s3", "arch": "arm64", "artifactDir": "mac-s3-arm64-v0.1.66" }
  ]
}
EOF
  cat > "$fixture_root/forge-release-cache/release-bundles/v0.1.65/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.65",
  "targets": [
    { "platform": "mac-s3", "arch": "arm64", "artifactDir": "mac-s3-arm64-v0.1.65" }
  ]
}
EOF
  cat > "$fixture_root/forge-release-cache/release-bundles/v0.1.64/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.64",
  "targets": [
    { "platform": "mac-s3", "arch": "arm64", "artifactDir": "mac-s3-arm64-v0.1.64" }
  ]
}
EOF
}

setup_github_fixtures "$WORK_DIR/fake-gh-artifacts"
setup_s3_fixtures "$WORK_DIR/fake-s3-artifacts"

CURRENT_GITHUB="$WORK_DIR/current-github/release"
CURRENT_S3="$WORK_DIR/current-s3/release"
create_release_fixture "$CURRENT_GITHUB" "mac" "arm64" "0.1.66" "Forge-App-0.1.66.dmg" "latest-mac.yml" "dual-channel"
create_release_fixture "$CURRENT_S3" "mac" "arm64" "0.1.66" "Forge-App-0.1.66.dmg" "latest-mac.yml" "dual-channel"

mkdir -p "$WORK_DIR/bin"
cat > "$WORK_DIR/bin/gh" <<'EOF'
#!/bin/bash
set -euo pipefail

if [[ "$1" == "api" ]]; then
  case "$2" in
    repos/uulab-official/forge-desktop-framework/releases\?per_page=3)
      cat <<'JSON'
[
  { "tag_name": "v0.1.66", "draft": false, "prerelease": false },
  { "tag_name": "v0.1.65", "draft": false, "prerelease": false },
  { "tag_name": "v0.1.64", "draft": false, "prerelease": false }
]
JSON
      ;;
    repos/uulab-official/forge-desktop-framework/commits/v0.1.66)
      printf '{"sha":"deadbeef0166"}\n'
      ;;
    repos/uulab-official/forge-desktop-framework/commits/v0.1.65)
      printf '{"sha":"deadbeef0165"}\n'
      ;;
    repos/uulab-official/forge-desktop-framework/commits/v0.1.64)
      printf '{"sha":"deadbeef0164"}\n'
      ;;
    repos/uulab-official/forge-desktop-framework/actions/workflows/release.yml/runs\?event=push\&status=completed\&per_page=100)
      cat <<'JSON'
{
  "workflow_runs": [
    { "id": 777166, "head_sha": "deadbeef0166", "head_branch": "v0.1.66", "display_title": "v0.1.66", "conclusion": "success", "created_at": "2026-04-01T12:00:00Z", "run_attempt": 1 },
    { "id": 777165, "head_sha": "deadbeef0165", "head_branch": "v0.1.65", "display_title": "v0.1.65", "conclusion": "success", "created_at": "2026-04-01T11:00:00Z", "run_attempt": 1 },
    { "id": 777164, "head_sha": "deadbeef0164", "head_branch": "v0.1.64", "display_title": "v0.1.64", "conclusion": "success", "created_at": "2026-04-01T10:00:00Z", "run_attempt": 1 }
  ]
}
JSON
      ;;
    *)
      echo "unexpected gh api path: $2" >&2
      exit 1
      ;;
  esac
  exit 0
fi

if [[ "$1" == "run" && "$2" == "download" ]]; then
  RUN_ID="$3"
  shift 3
  DEST_DIR=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo)
        shift 2
        ;;
      --dir|-D)
        DEST_DIR="$2"
        shift 2
        ;;
      *)
        echo "unexpected gh run download args: $*" >&2
        exit 1
        ;;
    esac
  done
  [[ -n "$DEST_DIR" ]] || { echo "missing --dir" >&2; exit 1; }
  mkdir -p "$DEST_DIR"
  case "$RUN_ID" in
    777166) cp -R "$FORGE_FAKE_GH_FIXTURE_ROOT/v0.1.66"/. "$DEST_DIR"/ ;;
    777165) cp -R "$FORGE_FAKE_GH_FIXTURE_ROOT/v0.1.65"/. "$DEST_DIR"/ ;;
    777164) cp -R "$FORGE_FAKE_GH_FIXTURE_ROOT/v0.1.64"/. "$DEST_DIR"/ ;;
    *) echo "unexpected run id: $RUN_ID" >&2; exit 1 ;;
  esac
  exit 0
fi

echo "unexpected gh invocation: $*" >&2
exit 1
EOF
chmod +x "$WORK_DIR/bin/gh"

cat > "$WORK_DIR/bin/aws" <<'EOF'
#!/bin/bash
set -euo pipefail

if [[ "$1" == "s3" && "$2" == "ls" ]]; then
  cat <<'OUT'
                           PRE v0.1.66/
                           PRE v0.1.65/
                           PRE v0.1.64/
OUT
  exit 0
fi

if [[ "$1" == "s3" && "$2" == "sync" ]]; then
  SOURCE="$3"
  DEST="$4"
  STRIPPED="${SOURCE#s3://}"
  BUCKET="${STRIPPED%%/*}"
  KEY="${STRIPPED#*/}"
  mkdir -p "$DEST"
  cp -R "$FORGE_FAKE_S3_ROOT/$BUCKET/$KEY"/. "$DEST"/
  exit 0
fi

echo "unexpected aws invocation: $*" >&2
exit 1
EOF
chmod +x "$WORK_DIR/bin/aws"

PATH="$WORK_DIR/bin:$PATH" \
FORGE_FAKE_GH_FIXTURE_ROOT="$WORK_DIR/fake-gh-artifacts" \
  bash scripts/run-remote-release-rollback-drill.sh \
    "github" \
    "uulab-official/forge-desktop-framework" \
    "$CURRENT_GITHUB" \
    "mac" \
    "arm64" \
    "0.1.66" \
    "dual-channel" \
    "3" \
    "s3" \
    "$WORK_DIR/github-history" \
    "$WORK_DIR/github-output"

[[ -f "$CURRENT_GITHUB/rollback-drill.json" ]]
[[ -f "$WORK_DIR/github-output/remote-rollback-drill.json" ]]

node - "$WORK_DIR/github-output/remote-rollback-drill.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.rollbackDrill.rollbackVersion !== '0.1.65') {
  throw new Error(`Expected GitHub remote rollback drill target 0.1.65, found ${payload.rollbackDrill.rollbackVersion}`);
}
NODE

PATH="$WORK_DIR/bin:$PATH" \
FORGE_FAKE_S3_ROOT="$WORK_DIR/fake-s3-artifacts" \
S3_ENDPOINT="https://example.r2.invalid" \
  bash scripts/run-remote-release-rollback-drill.sh \
    "s3" \
    "forge-release-cache" \
    "$CURRENT_S3" \
    "mac" \
    "arm64" \
    "0.1.66" \
    "dual-channel" \
    "3" \
    "s3" \
    "$WORK_DIR/s3-history" \
    "$WORK_DIR/s3-output"

[[ -f "$CURRENT_S3/rollback-drill.json" ]]
[[ -f "$WORK_DIR/s3-output/remote-rollback-drill.json" ]]

node - "$WORK_DIR/s3-output/remote-rollback-drill.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.rollbackDrill.rollbackVersion !== '0.1.65') {
  throw new Error(`Expected S3 remote rollback drill target 0.1.65, found ${payload.rollbackDrill.rollbackVersion}`);
}
NODE

echo "Remote rollback drill smoke test passed."
