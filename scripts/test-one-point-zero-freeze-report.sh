#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-freeze.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/release-status.json" <<'EOF'
{
  "status": "passed",
  "version": "0.1.71",
  "tag": "v0.1.71",
  "commit": "deadbeef71"
}
EOF

cat > "$WORK_DIR/v0.1.71.md" <<'EOF'
# Release Checklist: v0.1.71

- Status: ready
- Date: 2026-04-01
- Bump Type: patch

## Scope

- Summary: freeze the 1.0 decision path with a final go or no-go artifact.
- User-facing change: maintainers now get `one-point-zero-freeze.md/json` as the final freeze decision record.

## Public Surface

- Docs: root README and deployment guide
- Scripts and release flow: freeze report generation
- CLI or scaffold surface: none

## Validation Plan

- [x] `pnpm --filter create-forge-desktop build`
- [x] Narrow feature-specific smoke tests
- [x] `pnpm release:ship patch`
- [x] `pnpm version:check`

## Release Notes

- Changelog entry drafted: yes
- Follow-up risks: the freeze report must stay aligned with release-status and checklist shape
- Next target: use the freeze report as the explicit go or no-go record for the 1.0 release decision
EOF

bash scripts/generate-one-point-zero-freeze-report.sh \
  "$WORK_DIR/release-status.json" \
  "$WORK_DIR/v0.1.71.md" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-freeze.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-freeze.json" ]]

node - "$WORK_DIR/output/one-point-zero-freeze.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.decision !== 'go') {
  throw new Error(`Expected freeze decision to be go, found ${payload.decision}`);
}

if (payload.version !== '0.1.71') {
  throw new Error(`Expected version 0.1.71, found ${payload.version}`);
}

if (!payload.gateChecks.every((entry) => entry.passed)) {
  throw new Error('Expected every freeze gate to pass');
}
NODE

echo "One Point Zero freeze report smoke test passed."
