#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-decision.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

bash scripts/audit-one-point-zero-readiness.sh "$WORK_DIR/one-point-zero"

cat > "$WORK_DIR/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.72",
  "entries": [
    {
      "artifactDir": "release-inventory-mac-arm64",
      "platform": "mac",
      "arch": "arm64",
      "version": "0.1.72",
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
      "version": "0.1.72",
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
  "tag": "v0.1.72",
  "commit": "deadbeef72",
  "version": "0.1.72",
  "targets": [
    "mac/arm64",
    "win/default"
  ]
}
EOF

cat > "$WORK_DIR/v0.1.72.md" <<'EOF'
# Release Checklist: v0.1.72

- Status: ready
- Date: 2026-04-01
- Bump Type: patch

## Scope

- Summary: generate a final one-point-zero decision artifact from the readiness, status, and freeze layers.
- User-facing change: maintainers now get `one-point-zero-decision.md/json` as the last 1.0 go or hold handoff artifact.

## Public Surface

- Docs: root README and deployment guide
- Scripts and release flow: decision report generation
- CLI or scaffold surface: none

## Validation Plan

- [x] `pnpm --filter create-forge-desktop build`
- [x] Narrow feature-specific smoke tests
- [x] `pnpm release:ship patch`
- [x] `pnpm version:check`

## Release Notes

- Changelog entry drafted: yes
- Follow-up risks: the decision report must stay aligned with readiness, release-status, and freeze payload shapes
- Next target: use the decision report as the explicit maintainer handoff before the framework cuts a 1.0 release candidate
EOF

bash scripts/generate-release-status-report.sh \
  "$WORK_DIR/one-point-zero/one-point-zero-readiness.json" \
  "$WORK_DIR/release-matrix-summary.json" \
  "$WORK_DIR/release-provenance.json" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-freeze-report.sh \
  "$WORK_DIR/output/release-status.json" \
  "$WORK_DIR/v0.1.72.md" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-decision-report.sh \
  "$WORK_DIR/one-point-zero/one-point-zero-readiness.json" \
  "$WORK_DIR/output/release-status.json" \
  "$WORK_DIR/output/one-point-zero-freeze.json" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-decision.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-decision.json" ]]

node - "$WORK_DIR/output/one-point-zero-decision.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.decision !== 'ready-for-1.0-review') {
  throw new Error(`Expected decision ready-for-1.0-review, found ${payload.decision}`);
}

if (payload.version !== '0.1.72') {
  throw new Error(`Expected version 0.1.72, found ${payload.version}`);
}

if (!payload.gateChecks.every((entry) => entry.passed)) {
  throw new Error('Expected every one-point-zero decision gate to pass');
}
NODE

echo "One Point Zero decision report smoke test passed."
