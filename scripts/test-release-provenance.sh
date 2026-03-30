#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-provenance.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.48",
  "expectedTargets": [
    { "platform": "mac", "arch": "arm64" },
    { "platform": "mac", "arch": "x64" },
    { "platform": "win", "arch": "default" },
    { "platform": "linux", "arch": "default" }
  ],
  "entries": [
    {
      "artifactDir": "release-inventory-mac-arm64",
      "platform": "mac",
      "arch": "arm64",
      "version": "0.1.48",
      "signingStatus": "passed",
      "signingMissingEnv": [],
      "installers": 1,
      "manifests": 1,
      "publishChecks": {
        "hasExpectedInstaller": true,
        "hasManifest": true
      }
    },
    {
      "artifactDir": "release-inventory-linux-default",
      "platform": "linux",
      "arch": "default",
      "version": "0.1.48",
      "signingStatus": "passed",
      "signingMissingEnv": [],
      "installers": 1,
      "manifests": 1,
      "publishChecks": {
        "hasExpectedInstaller": true,
        "hasManifest": true
      }
    }
  ]
}
EOF

bash scripts/generate-release-provenance.sh "$TMP_DIR/release-matrix-summary.json" "$TMP_DIR/output" "v0.1.48" "deadbeef1234"

[[ -f "$TMP_DIR/output/release-provenance.md" ]]
[[ -f "$TMP_DIR/output/release-provenance.json" ]]
grep -q 'v0.1.48' "$TMP_DIR/output/release-provenance.md"
grep -q 'deadbeef1234' "$TMP_DIR/output/release-provenance.md"

if bash scripts/generate-release-provenance.sh "$TMP_DIR/release-matrix-summary.json" "$TMP_DIR/bad-output" "v9.9.9" "deadbeef1234" >/dev/null 2>&1; then
  echo "Expected provenance generation to fail on tag/version mismatch"
  exit 1
fi

echo "Release provenance smoke test passed."
