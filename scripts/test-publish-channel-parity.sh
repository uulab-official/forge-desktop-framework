#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-channel-parity.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

create_release_dir() {
  local dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"
  local manifest_name="$6"

  mkdir -p "$dir"

  cat > "$dir/artifact-summary.json" <<EOF
{
  "version": "$version",
  "platform": "$platform",
  "arch": "$arch",
  "totals": {
    "files": 2,
    "installers": 1,
    "manifests": 1
  },
  "artifacts": [
    { "file": "$installer", "size": "42 MB", "kind": "installer" },
    { "file": "$manifest_name", "size": "1 KB", "kind": "manifest" }
  ]
}
EOF

  cat > "$dir/manifest-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "manifests": [
    {
      "file": "$manifest_name",
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
}

PRIMARY_DIR="$WORK_DIR/github-release"
SECONDARY_DIR="$WORK_DIR/s3-release"
create_release_dir "$PRIMARY_DIR" "mac" "arm64" "0.1.52" "Forge-App-0.1.52.dmg" "latest-mac.yml"
create_release_dir "$SECONDARY_DIR" "mac" "arm64" "0.1.52" "Forge-App-0.1.52.dmg" "latest-mac.yml"

bash scripts/audit-publish-channel-parity.sh "$PRIMARY_DIR" "$SECONDARY_DIR" "mac" "arm64" "0.1.52"
[[ -f "$SECONDARY_DIR/channel-parity.md" ]]
[[ -f "$SECONDARY_DIR/channel-parity.json" ]]

BAD_DIR="$WORK_DIR/bad-s3-release"
create_release_dir "$BAD_DIR" "mac" "arm64" "0.1.52" "Forge-App-0.1.52.zip" "latest-mac.yml"

if bash scripts/audit-publish-channel-parity.sh "$PRIMARY_DIR" "$BAD_DIR" "mac" "arm64" "0.1.52" >/dev/null 2>&1; then
  echo "Expected publish channel parity audit to fail for mismatched installer filenames"
  exit 1
fi

echo "Publish channel parity smoke test passed."
