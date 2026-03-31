#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-rollback-target.XXXXXX")"
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

ARCHIVE_ROOT="$WORK_DIR/archive-root"
mkdir -p "$ARCHIVE_ROOT"

MAC_59="$WORK_DIR/mac-59"
MAC_60="$WORK_DIR/mac-60"
CURRENT_RELEASE="$WORK_DIR/mac-61"
WIN_61="$WORK_DIR/win-61"

make_release_dir "$MAC_59" "mac" "arm64" "0.1.59" "Forge-Desktop-0.1.59-arm64.dmg" "dual-channel"
make_release_dir "$MAC_60" "mac" "arm64" "0.1.60" "Forge-Desktop-0.1.60-arm64.dmg" "github-only"
make_release_dir "$CURRENT_RELEASE" "mac" "arm64" "0.1.61" "Forge-Desktop-0.1.61-arm64.dmg" "dual-channel"
make_release_dir "$WIN_61" "win" "x64" "0.1.61" "Forge-Desktop-0.1.61-x64.exe" "dual-channel"

bash scripts/bundle-release-inventory.sh "$MAC_59" "$ARCHIVE_ROOT/mac-59" "mac" "arm64" "0.1.59"
bash scripts/bundle-release-inventory.sh "$MAC_60" "$ARCHIVE_ROOT/mac-60" "mac" "arm64" "0.1.60"
bash scripts/bundle-release-inventory.sh "$CURRENT_RELEASE" "$ARCHIVE_ROOT/mac-61" "mac" "arm64" "0.1.61"
bash scripts/bundle-release-inventory.sh "$WIN_61" "$ARCHIVE_ROOT/win-61" "win" "x64" "0.1.61"

bash scripts/select-release-rollback-target.sh "$ARCHIVE_ROOT" "mac" "arm64" "0.1.61" "github-only" "$WORK_DIR/select-github"
[[ -f "$WORK_DIR/select-github/rollback-target-selection.json" ]]

node - "$WORK_DIR/select-github/rollback-target-selection.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!payload.selected || payload.selected.version !== '0.1.60') {
  throw new Error(`Expected github-only rollback target 0.1.60, found ${payload.selected ? payload.selected.version : 'missing'}`);
}
NODE

rm -f "$ARCHIVE_ROOT/release-bundle-index.json" "$ARCHIVE_ROOT/release-bundle-index.md"
bash scripts/select-release-rollback-target.sh "$ARCHIVE_ROOT" "mac" "arm64" "0.1.61" "dual-channel" "$WORK_DIR/select-dual"
[[ -f "$ARCHIVE_ROOT/release-bundle-index.json" ]]

node - "$WORK_DIR/select-dual/rollback-target-selection.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!payload.selected || payload.selected.version !== '0.1.59') {
  throw new Error(`Expected dual-channel rollback target 0.1.59, found ${payload.selected ? payload.selected.version : 'missing'}`);
}
NODE

ROLLBACK_VERSION="$(
  node -e "const fs=require('node:fs'); const env=fs.readFileSync(process.argv[1],'utf8'); const line=env.split('\\n').find((entry)=>entry.startsWith('ROLLBACK_TARGET_SELECTED_VERSION=')); process.stdout.write((line || '').split('=')[1] || '');" \
    "$WORK_DIR/select-dual/rollback-target-selection.env"
)"

if [[ "$ROLLBACK_VERSION" != "0.1.59" ]]; then
  echo "Expected env output to resolve rollback version 0.1.59, found $ROLLBACK_VERSION"
  exit 1
fi

bash scripts/retrieve-release-inventory-bundle.sh "$ARCHIVE_ROOT" "mac" "arm64" "$ROLLBACK_VERSION" "$WORK_DIR/retrieved-target"
bash scripts/run-rollback-drill.sh "$CURRENT_RELEASE" "$WORK_DIR/retrieved-target" "mac" "arm64" "0.1.61" "$ROLLBACK_VERSION" "dual-channel"

if bash scripts/select-release-rollback-target.sh "$ARCHIVE_ROOT" "win" "x64" "0.1.61" "github-only" "$WORK_DIR/should-fail" >/dev/null 2>&1; then
  echo "Expected rollback target selection to fail without an older bundle"
  exit 1
fi

echo "Rollback target selection smoke test passed."
