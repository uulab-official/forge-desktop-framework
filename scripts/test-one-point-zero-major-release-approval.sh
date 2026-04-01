#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-major-approval.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/one-point-zero-release-candidate.json" <<'EOF'
{
  "candidate": "ready-for-1.0-rc",
  "currentVersion": "0.1.76",
  "currentTag": "v0.1.76",
  "currentCommit": "deadbeef76",
  "nextVersion": "1.0.0",
  "nextChecklistPath": "docs/release-checklists/v1.0.0.md",
  "checklist": {
    "status": "ready",
    "summary": "turn the promotion plan into the exact first-major-release runbook.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-runbook.md/json as the operator-facing first-major-release execution handoff.",
    "followUpRisks": "the major-release runbook and promotion-plan payloads must stay aligned",
    "nextTarget": "emit one final approval artifact that joins the decision, promotion plan, and runbook layers"
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

cat > "$WORK_DIR/one-point-zero-decision.json" <<'EOF'
{
  "decision": "ready-for-1.0-review",
  "version": "0.1.76",
  "tag": "v0.1.76",
  "commit": "deadbeef76",
  "checklist": {
    "status": "ready",
    "summary": "turn the promotion plan into the exact first-major-release runbook.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-runbook.md/json as the operator-facing first-major-release execution handoff.",
    "followUpRisks": "the major-release runbook and promotion-plan payloads must stay aligned",
    "nextTarget": "emit one final approval artifact that joins the decision, promotion plan, and runbook layers"
  },
  "officialPresets": [
    { "preset": "launch-ready", "passed": true },
    { "preset": "support-ready", "passed": true },
    { "preset": "ops-ready", "passed": true },
    { "preset": "document-ready", "passed": true }
  ],
  "gateChecks": [
    { "name": "one-point-zero readiness passed", "passed": true }
  ],
  "recommendedActions": [
    "Use the 1.0 gate document and this decision artifact together before cutting any 1.0.0 tag."
  ]
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

bash scripts/generate-one-point-zero-major-release-runbook.sh \
  "$WORK_DIR/output/one-point-zero-promotion-plan.json" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-approval.sh \
  "$WORK_DIR/one-point-zero-decision.json" \
  "$WORK_DIR/output/one-point-zero-promotion-plan.json" \
  "$WORK_DIR/output/one-point-zero-major-release-runbook.json" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-major-release-approval.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-major-release-approval.json" ]]

node - "$WORK_DIR/output/one-point-zero-major-release-approval.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.approval !== 'approved-for-major-staging') {
  throw new Error(`Expected approval approved-for-major-staging, found ${payload.approval}`);
}

for (const command of ['pnpm release:promotion:test', 'pnpm release:ship major']) {
  if (!payload.commands.includes(command)) {
    throw new Error(`Missing expected command in approval artifact: ${command}`);
  }
}
NODE

echo "One Point Zero major release approval smoke test passed."
