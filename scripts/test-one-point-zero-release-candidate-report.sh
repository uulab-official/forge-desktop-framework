#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-rc.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

bash scripts/audit-one-point-zero-readiness.sh "$WORK_DIR/one-point-zero"

cat > "$WORK_DIR/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.73",
  "entries": [
    {
      "artifactDir": "release-inventory-mac-arm64",
      "platform": "mac",
      "arch": "arm64",
      "version": "0.1.73",
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
      "version": "0.1.73",
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
  "tag": "v0.1.73",
  "commit": "deadbeef73",
  "version": "0.1.73",
  "targets": [
    "mac/arm64",
    "win/default"
  ]
}
EOF

cat > "$WORK_DIR/v0.1.73.md" <<'EOF'
# Release Checklist: v0.1.73

- Status: ready
- Date: 2026-04-01
- Bump Type: patch

## Scope

- Summary: add a release-candidate artifact that points the current stable line at the final 1.0.0 promotion handoff.
- User-facing change: maintainers now get `one-point-zero-release-candidate.md/json` as the final 1.0 release-candidate handoff record.

## Public Surface

- Docs: root README and deployment guide
- Scripts and release flow: release-candidate report generation
- CLI or scaffold surface: none

## Validation Plan

- [x] `pnpm --filter create-forge-desktop build`
- [x] Narrow feature-specific smoke tests
- [x] `pnpm release:ship patch`
- [x] `pnpm version:check`

## Release Notes

- Changelog entry drafted: yes
- Follow-up risks: if decision payload shape changes, the release-candidate report must stay aligned with it
- Next target: prepare the `v1.0.0` checklist and use the release-candidate report as the last handoff before `pnpm release:ship major`
EOF

bash scripts/generate-release-status-report.sh \
  "$WORK_DIR/one-point-zero/one-point-zero-readiness.json" \
  "$WORK_DIR/release-matrix-summary.json" \
  "$WORK_DIR/release-provenance.json" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-freeze-report.sh \
  "$WORK_DIR/output/release-status.json" \
  "$WORK_DIR/v0.1.73.md" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-decision-report.sh \
  "$WORK_DIR/one-point-zero/one-point-zero-readiness.json" \
  "$WORK_DIR/output/release-status.json" \
  "$WORK_DIR/output/one-point-zero-freeze.json" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-release-candidate-report.sh \
  "$WORK_DIR/output/one-point-zero-decision.json" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-release-candidate.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-release-candidate.json" ]]

node - "$WORK_DIR/output/one-point-zero-release-candidate.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.candidate !== 'ready-for-1.0-rc') {
  throw new Error(`Expected candidate ready-for-1.0-rc, found ${payload.candidate}`);
}

if (payload.currentVersion !== '0.1.73') {
  throw new Error(`Expected currentVersion 0.1.73, found ${payload.currentVersion}`);
}

if (payload.nextVersion !== '1.0.0') {
  throw new Error(`Expected nextVersion 1.0.0, found ${payload.nextVersion}`);
}

if (!payload.gateChecks.every((entry) => entry.passed)) {
  throw new Error('Expected every one-point-zero release candidate gate to pass');
}
NODE

echo "One Point Zero release candidate report smoke test passed."
