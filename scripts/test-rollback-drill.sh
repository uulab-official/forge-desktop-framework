#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-rollback-drill.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

create_release_fixture() {
  local case_dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"
  local manifest="$6"

  mkdir -p "$case_dir"

  cat > "$case_dir/artifact-summary.json" <<EOF
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

  cat > "$case_dir/manifest-audit.json" <<EOF
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
  ],
  "checks": {
    "allVersionsMatch": true,
    "allPathsExist": true,
    "allShaPresent": true
  }
}
EOF

  cat > "$case_dir/rollback-readiness.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "status": "passed"
}
EOF
}

CURRENT_GITHUB="$WORK_DIR/current-github/release"
ARCHIVED_GITHUB="$WORK_DIR/archived-github/release"
create_release_fixture "$CURRENT_GITHUB" "mac" "arm64" "0.1.55" "Forge-App-0.1.55.dmg" "latest-mac.yml"
create_release_fixture "$ARCHIVED_GITHUB" "mac" "arm64" "0.1.54" "Forge-App-0.1.54.dmg" "latest-mac.yml"
bash scripts/generate-rollback-playbook.sh "$CURRENT_GITHUB" "mac" "arm64" "0.1.55"
bash scripts/audit-release-channel-recovery.sh "$CURRENT_GITHUB" "mac" "arm64" "0.1.55" "github-only"
bash scripts/run-rollback-drill.sh "$CURRENT_GITHUB" "$ARCHIVED_GITHUB" "mac" "arm64" "0.1.55" "0.1.54" "github-only"
[[ -f "$CURRENT_GITHUB/rollback-drill.md" ]]
[[ -f "$CURRENT_GITHUB/rollback-drill.json" ]]

CURRENT_DUAL="$WORK_DIR/current-dual/release"
ARCHIVED_DUAL="$WORK_DIR/archived-dual/release"
create_release_fixture "$CURRENT_DUAL" "win" "x64" "0.1.55" "Forge-App-Setup-0.1.55.exe" "latest.yml"
create_release_fixture "$ARCHIVED_DUAL" "win" "x64" "0.1.54" "Forge-App-Setup-0.1.54.exe" "latest.yml"
cat > "$CURRENT_DUAL/channel-parity.json" <<'EOF'
{
  "platform": "win",
  "arch": "x64",
  "expectedVersion": "0.1.55",
  "status": "passed"
}
EOF
cat > "$ARCHIVED_DUAL/channel-parity.json" <<'EOF'
{
  "platform": "win",
  "arch": "x64",
  "expectedVersion": "0.1.54",
  "status": "passed"
}
EOF
bash scripts/generate-rollback-playbook.sh "$CURRENT_DUAL" "win" "x64" "0.1.55"
bash scripts/audit-release-channel-recovery.sh "$CURRENT_DUAL" "win" "x64" "0.1.55" "dual-channel"
bash scripts/run-rollback-drill.sh "$CURRENT_DUAL" "$ARCHIVED_DUAL" "win" "x64" "0.1.55" "0.1.54" "dual-channel"

BAD_CURRENT="$WORK_DIR/bad-current/release"
BAD_ARCHIVED="$WORK_DIR/bad-archived/release"
create_release_fixture "$BAD_CURRENT" "linux" "x64" "0.1.55" "Forge-App-0.1.55.AppImage" "latest-linux.yml"
mkdir -p "$BAD_ARCHIVED"
cat > "$BAD_ARCHIVED/artifact-summary.json" <<'EOF'
{
  "version": "0.1.54",
  "platform": "linux",
  "arch": "x64",
  "artifacts": [
    { "file": "Forge-App-0.1.54.AppImage", "size": "42 MB", "kind": "installer" },
    { "file": "latest.yml", "size": "1 KB", "kind": "manifest" }
  ]
}
EOF
cat > "$BAD_ARCHIVED/manifest-audit.json" <<'EOF'
{
  "platform": "linux",
  "arch": "x64",
  "expectedVersion": "0.1.54",
  "manifests": [
    {
      "file": "latest.yml",
      "version": "0.1.54",
      "path": "Forge-App-0.1.54.AppImage",
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
bash scripts/generate-rollback-playbook.sh "$BAD_CURRENT" "linux" "x64" "0.1.55"
bash scripts/audit-release-channel-recovery.sh "$BAD_CURRENT" "linux" "x64" "0.1.55" "github-only"
if bash scripts/run-rollback-drill.sh "$BAD_CURRENT" "$BAD_ARCHIVED" "linux" "x64" "0.1.55" "0.1.54" "github-only" >/dev/null 2>&1; then
  echo "Expected rollback drill to fail when archived manifest names do not match the current playbook"
  exit 1
fi

echo "Rollback drill smoke test passed."
