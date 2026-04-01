#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-history-prepare.XXXXXX")"
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

make_release_tag_dir() {
  local tag_dir="$1"
  local version="$2"
  local platform="$3"
  local arch="$4"
  local installer="$5"
  local mode="$6"

  local release_dir="$WORK_DIR/release-${platform}-${arch}-${version}"
  make_release_dir "$release_dir" "$platform" "$arch" "$version" "$installer" "$mode"
  bash scripts/bundle-release-inventory.sh "$release_dir" "$tag_dir/release-inventory-${platform}-${arch}" "$platform" "$arch" "$version"
  bash scripts/generate-release-bundle-index.sh "$tag_dir" "$tag_dir"

  cat > "$tag_dir/release-provenance.json" <<EOF
{
  "tag": "v$version",
  "version": "$version",
  "commitSha": "sha-$version"
}
EOF
  cat > "$tag_dir/release-matrix-summary.json" <<EOF
{
  "tag": "v$version",
  "version": "$version",
  "status": "passed"
}
EOF
}

HISTORY_ROOT="$WORK_DIR/history-root"
mkdir -p "$HISTORY_ROOT/v0.1.59" "$HISTORY_ROOT/v0.1.60" "$HISTORY_ROOT/v0.1.61"

make_release_tag_dir "$HISTORY_ROOT/v0.1.59" "0.1.59" "mac" "arm64" "Forge-Desktop-0.1.59-arm64.dmg" "dual-channel"
make_release_tag_dir "$HISTORY_ROOT/v0.1.60" "0.1.60" "mac" "arm64" "Forge-Desktop-0.1.60-arm64.dmg" "github-only"
make_release_tag_dir "$HISTORY_ROOT/v0.1.61" "0.1.61" "win" "x64" "Forge-Desktop-0.1.61-x64.exe" "dual-channel"

bash scripts/generate-release-history-index.sh "$HISTORY_ROOT" "$HISTORY_ROOT"
[[ -f "$HISTORY_ROOT/release-history-index.json" ]]

bash scripts/prepare-release-rollback-from-history.sh "$HISTORY_ROOT" "mac" "arm64" "0.1.61" "github-only" "$WORK_DIR/prepared-github"
[[ -f "$WORK_DIR/prepared-github/prepared-rollback-target.json" ]]
[[ -f "$WORK_DIR/prepared-github/retrieved-bundle/retrieval-summary.json" ]]

node - "$WORK_DIR/prepared-github/prepared-rollback-target.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.selection.selected.version !== '0.1.60') {
  throw new Error(`Expected github-only rollback version 0.1.60, found ${payload.selection.selected.version}`);
}
if (payload.retrieval.version !== '0.1.60') {
  throw new Error(`Expected retrieved version 0.1.60, found ${payload.retrieval.version}`);
}
NODE

rm -f "$HISTORY_ROOT/release-history-index.json" "$HISTORY_ROOT/release-history-index.md"
bash scripts/prepare-release-rollback-from-history.sh "$HISTORY_ROOT" "mac" "arm64" "0.1.61" "dual-channel" "$WORK_DIR/prepared-dual"
[[ -f "$HISTORY_ROOT/release-history-index.json" ]]

node - "$WORK_DIR/prepared-dual/prepared-rollback-target.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.selection.selected.version !== '0.1.59') {
  throw new Error(`Expected dual-channel rollback version 0.1.59, found ${payload.selection.selected.version}`);
}
if (!String(payload.selection.selectedReleaseRoot || '').endsWith('/v0.1.59')) {
  throw new Error(`Expected selected release root to end with /v0.1.59, found ${payload.selection.selectedReleaseRoot}`);
}
NODE

if bash scripts/prepare-release-rollback-from-history.sh "$HISTORY_ROOT" "win" "x64" "0.1.61" "github-only" "$WORK_DIR/should-fail" >/dev/null 2>&1; then
  echo "Expected history rollback preparation to fail without an older bundle"
  exit 1
fi

echo "Release history rollback preparation smoke test passed."
