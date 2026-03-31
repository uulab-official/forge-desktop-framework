#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-bundle.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

create_release_fixture() {
  local dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"
  local manifest="$6"

  mkdir -p "$dir"

  cat > "$dir/artifact-summary.md" <<EOF
# Release Artifact Summary

- Version: \`$version\`
EOF

  cat > "$dir/artifact-summary.json" <<EOF
{
  "version": "$version",
  "platform": "$platform",
  "arch": "$arch",
  "artifacts": [
    { "file": "$installer", "size": "42 MB", "kind": "installer" },
    { "file": "$manifest", "size": "1 KB", "kind": "manifest" }
  ]
}
EOF

  cat > "$dir/manifest-audit.md" <<EOF
# Manifest Audit
EOF

  cat > "$dir/manifest-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "manifests": [
    {
      "file": "$manifest",
      "version": "$version",
      "path": "$installer",
      "sha512Present": true,
      "versionMatches": true,
      "pathExists": true
    }
  ]
}
EOF

  cat > "$dir/publish-audit.md" <<EOF
# Publish Audit
EOF

  cat > "$dir/publish-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "checks": {
    "hasExpectedInstaller": true,
    "hasManifest": true
  }
}
EOF

  cat > "$dir/rollback-readiness.md" <<EOF
# Rollback Readiness
EOF

  cat > "$dir/rollback-readiness.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "status": "passed"
}
EOF

  cat > "$dir/$manifest" <<EOF
version: $version
path: $installer
sha512: fake
EOF
}

GITHUB_RELEASE="$WORK_DIR/github-release"
create_release_fixture "$GITHUB_RELEASE" "mac" "arm64" "0.1.56" "Forge-App-0.1.56.dmg" "latest-mac.yml"
bash scripts/generate-rollback-playbook.sh "$GITHUB_RELEASE" "mac" "arm64" "0.1.56"
bash scripts/audit-release-channel-recovery.sh "$GITHUB_RELEASE" "mac" "arm64" "0.1.56" "github-only"
bash scripts/bundle-release-inventory.sh "$GITHUB_RELEASE" "$WORK_DIR/bundles" "mac" "arm64" "0.1.56"
[[ -f "$WORK_DIR/bundles/mac-arm64-v0.1.56/bundle-summary.md" ]]
[[ -f "$WORK_DIR/bundles/mac-arm64-v0.1.56/bundle-summary.json" ]]
[[ -f "$WORK_DIR/bundles/mac-arm64-v0.1.56/files/rollback-playbook.json" ]]

DUAL_RELEASE="$WORK_DIR/dual-release"
create_release_fixture "$DUAL_RELEASE" "win" "x64" "0.1.56" "Forge-App-Setup-0.1.56.exe" "latest.yml"
cat > "$DUAL_RELEASE/channel-parity.md" <<EOF
# Channel Parity
EOF
cat > "$DUAL_RELEASE/channel-parity.json" <<'EOF'
{
  "platform": "win",
  "arch": "x64",
  "expectedVersion": "0.1.56",
  "status": "passed"
}
EOF
bash scripts/generate-rollback-playbook.sh "$DUAL_RELEASE" "win" "x64" "0.1.56"
bash scripts/audit-release-channel-recovery.sh "$DUAL_RELEASE" "win" "x64" "0.1.56" "dual-channel"
bash scripts/bundle-release-inventory.sh "$DUAL_RELEASE" "$WORK_DIR/bundles" "win" "x64" "0.1.56"
[[ -f "$WORK_DIR/bundles/win-x64-v0.1.56/files/channel-parity.json" ]]

BAD_RELEASE="$WORK_DIR/bad-release"
create_release_fixture "$BAD_RELEASE" "linux" "x64" "0.1.56" "Forge-App-0.1.56.AppImage" "latest-linux.yml"
rm -f "$BAD_RELEASE/channel-recovery.json"
if bash scripts/bundle-release-inventory.sh "$BAD_RELEASE" "$WORK_DIR/bundles" "linux" "x64" "0.1.56" >/dev/null 2>&1; then
  echo "Expected release inventory bundle to fail when channel recovery metadata is missing"
  exit 1
fi

echo "Release inventory bundle smoke test passed."
