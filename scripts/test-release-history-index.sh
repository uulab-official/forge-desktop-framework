#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-history-index.XXXXXX")"
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
  "status": "passed"
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

HISTORY_ROOT="$WORK_DIR/history-root"
TAG_61="$HISTORY_ROOT/v0.1.61"
TAG_62="$HISTORY_ROOT/v0.1.62"
mkdir -p "$TAG_61" "$TAG_62"

MAC_61="$WORK_DIR/mac-61"
WIN_61="$WORK_DIR/win-61"
MAC_62="$WORK_DIR/mac-62"
LINUX_62="$WORK_DIR/linux-62"

make_release_dir "$MAC_61" "mac" "arm64" "0.1.61" "Forge-Desktop-0.1.61-arm64.dmg" "github-only"
make_release_dir "$WIN_61" "win" "x64" "0.1.61" "Forge-Desktop-0.1.61-x64.exe" "dual-channel"
make_release_dir "$MAC_62" "mac" "arm64" "0.1.62" "Forge-Desktop-0.1.62-arm64.dmg" "dual-channel"
make_release_dir "$LINUX_62" "linux" "x64" "0.1.62" "Forge-Desktop-0.1.62-x64.AppImage" "github-only"

bash scripts/bundle-release-inventory.sh "$MAC_61" "$TAG_61/release-inventory-mac-arm64" "mac" "arm64" "0.1.61"
bash scripts/bundle-release-inventory.sh "$WIN_61" "$TAG_61/release-inventory-win-x64" "win" "x64" "0.1.61"
bash scripts/generate-release-bundle-index.sh "$TAG_61" "$TAG_61"
cat > "$TAG_61/release-provenance.json" <<'EOF'
{
  "tag": "v0.1.61",
  "commitSha": "deadbeef61",
  "version": "0.1.61"
}
EOF
cat > "$TAG_61/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.61",
  "targets": [
    { "platform": "mac", "arch": "arm64" },
    { "platform": "win", "arch": "x64" }
  ]
}
EOF

bash scripts/bundle-release-inventory.sh "$MAC_62" "$TAG_62/release-inventory-mac-arm64" "mac" "arm64" "0.1.62"
bash scripts/bundle-release-inventory.sh "$LINUX_62" "$TAG_62/release-inventory-linux-x64" "linux" "x64" "0.1.62"
bash scripts/generate-release-bundle-index.sh "$TAG_62" "$TAG_62"
cat > "$TAG_62/release-provenance.json" <<'EOF'
{
  "tag": "v0.1.62",
  "commitSha": "deadbeef62",
  "version": "0.1.62"
}
EOF
cat > "$TAG_62/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.62",
  "targets": [
    { "platform": "mac", "arch": "arm64" },
    { "platform": "linux", "arch": "x64" }
  ]
}
EOF

bash scripts/generate-release-history-index.sh "$HISTORY_ROOT" "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/release-history-index.json" ]]
[[ -f "$WORK_DIR/output/release-history-index.md" ]]

node - "$WORK_DIR/output/release-history-index.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.releases.length !== 2) {
  throw new Error(`Expected 2 releases, found ${payload.releases.length}`);
}
if (payload.bundles.length !== 4) {
  throw new Error(`Expected 4 bundles, found ${payload.bundles.length}`);
}
const macLatest = payload.latestPerTarget.find((entry) => entry.platform === 'mac' && entry.arch === 'arm64');
if (!macLatest || macLatest.version !== '0.1.62' || macLatest.tag !== 'v0.1.62') {
  throw new Error(`Expected latest mac/arm64 target to resolve to v0.1.62, found ${macLatest ? `${macLatest.tag}:${macLatest.version}` : 'missing'}`);
}
const winHistory = payload.versionsPerTarget.find((entry) => entry.platform === 'win' && entry.arch === 'x64');
if (!winHistory || winHistory.versions.length !== 1) {
  throw new Error('Expected win/x64 history to contain one version');
}
NODE

if bash scripts/generate-release-history-index.sh "$WORK_DIR/empty" "$WORK_DIR/should-fail" >/dev/null 2>&1; then
  echo "Expected release history index generation to fail on an empty history root"
  exit 1
fi

echo "Release history index smoke test passed."
