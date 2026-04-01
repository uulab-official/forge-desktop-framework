#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-status.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

bash scripts/audit-one-point-zero-readiness.sh "$WORK_DIR/one-point-zero"

cat > "$WORK_DIR/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.70",
  "entries": [
    {
      "artifactDir": "release-inventory-mac-arm64",
      "platform": "mac",
      "arch": "arm64",
      "version": "0.1.70",
      "signingStatus": "passed",
      "signingMissingEnv": [],
      "installers": 1,
      "manifests": 1,
      "publishChecks": {
        "hasExpectedInstaller": true,
        "hasManifest": true
      },
      "manifestChecks": {
        "allVersionsMatch": true,
        "allPathsExist": true,
        "allShaPresent": true
      },
      "rollbackStatus": "passed",
      "rollbackChecks": {
        "hasInstaller": true
      }
    },
    {
      "artifactDir": "release-inventory-win-default",
      "platform": "win",
      "arch": "default",
      "version": "0.1.70",
      "signingStatus": "passed",
      "signingMissingEnv": [],
      "installers": 1,
      "manifests": 1,
      "publishChecks": {
        "hasExpectedInstaller": true,
        "hasManifest": true
      },
      "manifestChecks": {
        "allVersionsMatch": true,
        "allPathsExist": true,
        "allShaPresent": true
      },
      "rollbackStatus": "passed",
      "rollbackChecks": {
        "hasInstaller": true
      }
    }
  ]
}
EOF

cat > "$WORK_DIR/release-provenance.json" <<'EOF'
{
  "tag": "v0.1.70",
  "commit": "deadbeef70",
  "version": "0.1.70",
  "targets": [
    "mac/arm64",
    "win/default"
  ]
}
EOF

bash scripts/generate-release-status-report.sh \
  "$WORK_DIR/one-point-zero/one-point-zero-readiness.json" \
  "$WORK_DIR/release-matrix-summary.json" \
  "$WORK_DIR/release-provenance.json" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/release-status.md" ]]
[[ -f "$WORK_DIR/output/release-status.json" ]]

node - "$WORK_DIR/output/release-status.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.status !== 'passed') {
  throw new Error(`Expected release status to pass, found ${payload.status}`);
}

if (payload.version !== '0.1.70') {
  throw new Error(`Expected version 0.1.70, found ${payload.version}`);
}

if (payload.officialPresets.length !== 4) {
  throw new Error(`Expected 4 official presets, found ${payload.officialPresets.length}`);
}

if (!payload.gateChecks.find((entry) => entry.name === 'one-point-zero readiness' && entry.passed)) {
  throw new Error('Expected one-point-zero readiness gate to pass');
}
NODE

echo "Release status report smoke test passed."
