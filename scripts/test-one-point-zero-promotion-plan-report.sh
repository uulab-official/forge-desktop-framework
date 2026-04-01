#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-promotion-plan.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/one-point-zero-release-candidate.json" <<'EOF'
{
  "candidate": "ready-for-1.0-rc",
  "currentVersion": "0.1.74",
  "currentTag": "v0.1.74",
  "currentCommit": "deadbeef74",
  "nextVersion": "1.0.0",
  "nextChecklistPath": "docs/release-checklists/v1.0.0.md",
  "checklist": {
    "status": "ready",
    "summary": "turn the release-candidate handoff into a reproducible v1.0.0 checklist draft.",
    "userFacingChange": "maintainers can now materialize the first major-release checklist directly from the audited release-candidate artifact.",
    "followUpRisks": "the major checklist helper and release-candidate payload must stay aligned",
    "nextTarget": "generate a final promotion plan artifact that joins the release-candidate and prepared v1.0.0 checklist"
  },
  "officialPresets": [
    { "preset": "launch-ready", "passed": true },
    { "preset": "support-ready", "passed": true },
    { "preset": "ops-ready", "passed": true },
    { "preset": "document-ready", "passed": true }
  ],
  "gateChecks": [
    { "name": "one-point-zero decision ready for review", "passed": true }
  ],
  "recommendedActions": [
    "Prepare the next checklist at docs/release-checklists/v1.0.0.md before attempting the major release.",
    "Review the final decision artifact alongside the 1.0 gate document before cutting 1.0.0.",
    "When the product surface is frozen, run pnpm release:ship major to promote Forge to 1.0.0."
  ],
  "source": "fake"
}
EOF

TARGET="$WORK_DIR/v1.0.0.md"

bash scripts/prepare-one-point-zero-major-checklist.sh \
  "$WORK_DIR/one-point-zero-release-candidate.json" \
  "$TARGET"

bash scripts/generate-one-point-zero-promotion-plan-report.sh \
  "$WORK_DIR/one-point-zero-release-candidate.json" \
  "$TARGET" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-promotion-plan.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-promotion-plan.json" ]]

node - "$WORK_DIR/output/one-point-zero-promotion-plan.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.plan !== 'ready-to-stage-1.0.0') {
  throw new Error(`Expected plan ready-to-stage-1.0.0, found ${payload.plan}`);
}

if (payload.nextVersion !== '1.0.0') {
  throw new Error(`Expected nextVersion 1.0.0, found ${payload.nextVersion}`);
}

if (payload.checklist.status !== 'draft') {
  throw new Error(`Expected checklist status draft, found ${payload.checklist.status}`);
}

if (!payload.gateChecks.every((entry) => entry.passed)) {
  throw new Error('Expected every one-point-zero promotion-plan gate to pass');
}
NODE

echo "One Point Zero promotion plan report smoke test passed."
