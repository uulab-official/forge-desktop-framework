#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-channel-recovery.XXXXXX")"
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

GITHUB_DIR="$WORK_DIR/github/release"
create_release_fixture "$GITHUB_DIR" "mac" "arm64" "0.1.54" "Forge-App-0.1.54.dmg" "latest-mac.yml"
bash scripts/generate-rollback-playbook.sh "$GITHUB_DIR" "mac" "arm64" "0.1.54"
bash scripts/audit-release-channel-recovery.sh "$GITHUB_DIR" "mac" "arm64" "0.1.54" "github-only"
[[ -f "$GITHUB_DIR/channel-recovery.md" ]]
[[ -f "$GITHUB_DIR/channel-recovery.json" ]]

DUAL_DIR="$WORK_DIR/dual/release"
create_release_fixture "$DUAL_DIR" "win" "x64" "0.1.54" "Forge-App-Setup-0.1.54.exe" "latest.yml"
cat > "$DUAL_DIR/channel-parity.json" <<'EOF'
{
  "platform": "win",
  "arch": "x64",
  "expectedVersion": "0.1.54",
  "status": "passed"
}
EOF
bash scripts/generate-rollback-playbook.sh "$DUAL_DIR" "win" "x64" "0.1.54"
bash scripts/audit-release-channel-recovery.sh "$DUAL_DIR" "win" "x64" "0.1.54" "dual-channel"

BAD_DIR="$WORK_DIR/bad/release"
create_release_fixture "$BAD_DIR" "linux" "x64" "0.1.54" "Forge-App-0.1.54.AppImage" "latest-linux.yml"
bash scripts/generate-rollback-playbook.sh "$BAD_DIR" "linux" "x64" "0.1.54"
if bash scripts/audit-release-channel-recovery.sh "$BAD_DIR" "linux" "x64" "0.1.54" "dual-channel" >/dev/null 2>&1; then
  echo "Expected release channel recovery audit to fail when dual-channel metadata is missing"
  exit 1
fi

echo "Release channel recovery audit smoke test passed."
