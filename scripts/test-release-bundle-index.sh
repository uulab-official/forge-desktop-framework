#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-bundle-index.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

make_release_dir() {
  local release_dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"
  local mode="$6"

  mkdir -p "$release_dir"

  cat > "$release_dir/artifact-summary.md" <<'EOF'
# Artifact Summary
EOF
  cat > "$release_dir/artifact-summary.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "version": "$version",
  "artifacts": [
    {
      "file": "$installer",
      "kind": "installer",
      "path": "$installer"
    }
  ]
}
EOF
  cat > "$release_dir/manifest-audit.md" <<'EOF'
# Manifest Audit
EOF
  cat > "$release_dir/manifest-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "status": "passed",
  "manifests": [
    {
      "file": "latest-${platform}.yml",
      "path": "$installer"
    }
  ]
}
EOF
  cat > "$release_dir/publish-audit.md" <<'EOF'
# Publish Audit
EOF
  cat > "$release_dir/publish-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "status": "passed",
  "checks": {
    "hasExpectedInstaller": true,
    "hasManifest": true
  }
}
EOF
  cat > "$release_dir/rollback-readiness.md" <<'EOF'
# Rollback Readiness
EOF
  cat > "$release_dir/rollback-readiness.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "version": "$version",
  "status": "passed",
  "checks": {
    "hasInstaller": true
  }
}
EOF
  cat > "$release_dir/latest-${platform}.yml" <<EOF
version: $version
path: $installer
sha512: ${platform}${version}
files:
  - url: $installer
    sha512: ${platform}${version}
    size: 100
EOF
  touch "$release_dir/$installer"

  if [[ "$mode" == "dual-channel" ]]; then
    cat > "$release_dir/channel-parity.md" <<'EOF'
# Channel Parity
EOF
    cat > "$release_dir/channel-parity.json" <<'EOF'
{
  "status": "passed"
}
EOF
  fi
  bash scripts/generate-rollback-playbook.sh "$release_dir" "$platform" "$arch" "$version"
  bash scripts/audit-release-channel-recovery.sh "$release_dir" "$platform" "$arch" "$version" "$mode"
}

ARCHIVE_ROOT="$WORK_DIR/archive-root"
mkdir -p "$ARCHIVE_ROOT"

MAC_OLD="$WORK_DIR/mac-old"
MAC_NEW="$WORK_DIR/mac-new"
WIN_NEW="$WORK_DIR/win-new"

make_release_dir "$MAC_OLD" "mac" "arm64" "0.1.58" "Forge-Desktop-0.1.58-arm64.dmg" "github-only"
make_release_dir "$MAC_NEW" "mac" "arm64" "0.1.59" "Forge-Desktop-0.1.59-arm64.dmg" "github-only"
make_release_dir "$WIN_NEW" "win" "x64" "0.1.59" "Forge-Desktop-0.1.59-x64.exe" "dual-channel"

bash scripts/bundle-release-inventory.sh "$MAC_OLD" "$ARCHIVE_ROOT/mac-old" "mac" "arm64" "0.1.58"
bash scripts/bundle-release-inventory.sh "$MAC_NEW" "$ARCHIVE_ROOT/mac-new" "mac" "arm64" "0.1.59"
bash scripts/bundle-release-inventory.sh "$WIN_NEW" "$ARCHIVE_ROOT/win-new" "win" "x64" "0.1.59"

bash scripts/generate-release-bundle-index.sh "$ARCHIVE_ROOT" "$WORK_DIR/index"

[[ -f "$WORK_DIR/index/release-bundle-index.json" ]]
[[ -f "$WORK_DIR/index/release-bundle-index.md" ]]

node - "$WORK_DIR/index/release-bundle-index.json" <<'NODE'
const fs = require('node:fs');
const index = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (index.bundles.length !== 3) {
  throw new Error(`Expected 3 bundles, found ${index.bundles.length}`);
}
const macLatest = index.latestPerTarget.find((entry) => entry.platform === 'mac' && entry.arch === 'arm64');
if (!macLatest || macLatest.version !== '0.1.59') {
  throw new Error(`Expected mac/arm64 latest bundle to be 0.1.59, found ${macLatest ? macLatest.version : 'missing'}`);
}
NODE

bash scripts/retrieve-release-inventory-bundle.sh "$ARCHIVE_ROOT" "mac" "arm64" "0.1.58" "$WORK_DIR/retrieved/mac-old"
[[ -f "$WORK_DIR/retrieved/mac-old/retrieval-summary.json" ]]

if bash scripts/generate-release-bundle-index.sh "$WORK_DIR/empty" "$WORK_DIR/should-fail" >/dev/null 2>&1; then
  echo "Expected bundle index generation to fail on a missing archive root"
  exit 1
fi

echo "Release bundle index smoke test passed."
