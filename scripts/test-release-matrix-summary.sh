#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-matrix.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

ARTIFACT_ROOT="$TMP_DIR/artifacts"
OUTPUT_ROOT="$TMP_DIR/output"
mkdir -p "$ARTIFACT_ROOT"

create_inventory_dir() {
  local dir_name="$1"
  local platform="$2"
  local arch="$3"
  local expected_suffix="$4"
  local dir_path="$ARTIFACT_ROOT/$dir_name"
  mkdir -p "$dir_path"

  cat > "$dir_path/signing-readiness.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "status": "passed",
  "requiredEnv": ["GH_TOKEN"],
  "presentEnv": ["GH_TOKEN"],
  "missingEnv": []
}
EOF

  cat > "$dir_path/artifact-summary.json" <<EOF
{
  "version": "0.1.47",
  "platform": "$platform",
  "arch": "$arch",
  "totals": {
    "files": 2,
    "installers": 1,
    "manifests": 1
  },
  "artifacts": [
    { "file": "Forge$expected_suffix", "size": "42 MB", "kind": "installer" },
    { "file": "latest.yml", "size": "1 KB", "kind": "manifest" }
  ]
}
EOF

  cat > "$dir_path/publish-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedInstallerSuffix": "$expected_suffix",
  "checks": {
    "hasExpectedInstaller": true,
    "hasManifest": true,
    "hasBlockmap": false,
    "hasZip": false
  }
}
EOF

  cat > "$dir_path/manifest-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "0.1.47",
  "manifests": [
    {
      "file": "latest.yml",
      "version": "0.1.47",
      "path": "Forge$expected_suffix",
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

create_inventory_dir "release-inventory-mac-arm64" "mac" "arm64" ".dmg"
create_inventory_dir "release-inventory-mac-x64" "mac" "x64" ".dmg"
create_inventory_dir "release-inventory-win-default" "win" "default" ".exe"
create_inventory_dir "release-inventory-linux-default" "linux" "default" ".AppImage"

bash scripts/summarize-release-matrix.sh "$ARTIFACT_ROOT" "$OUTPUT_ROOT"

[[ -f "$OUTPUT_ROOT/release-matrix-summary.md" ]]
[[ -f "$OUTPUT_ROOT/release-matrix-summary.json" ]]
grep -q 'mac/arm64' "$OUTPUT_ROOT/release-matrix-summary.md"
grep -q 'linux/default' "$OUTPUT_ROOT/release-matrix-summary.md"

echo "Release matrix summary smoke test passed."
