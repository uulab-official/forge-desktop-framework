#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-major-runbook.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/one-point-zero-release-candidate.json" <<'EOF'
{
  "candidate": "ready-for-1.0-rc",
  "currentVersion": "0.1.75",
  "currentTag": "v0.1.75",
  "currentCommit": "deadbeef75",
  "nextVersion": "1.0.0",
  "nextChecklistPath": "docs/release-checklists/v1.0.0.md",
  "checklist": {
    "status": "ready",
    "summary": "join the release-candidate handoff with the prepared v1.0.0 checklist draft.",
    "userFacingChange": "maintainers now get one-point-zero-promotion-plan.md/json as the final first-major-release staging handoff.",
    "followUpRisks": "the promotion-plan report must stay aligned with the release-candidate payload and generated v1.0.0 checklist format",
    "nextTarget": "emit an operator-focused runbook that turns the promotion-plan artifact into the exact first-major-release command sequence"
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

bash scripts/generate-one-point-zero-major-release-runbook.sh \
  "$WORK_DIR/output/one-point-zero-promotion-plan.json" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-major-release-runbook.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-major-release-runbook.json" ]]

node - "$WORK_DIR/output/one-point-zero-major-release-runbook.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.runbook !== 'ready-for-major-ship') {
  throw new Error(`Expected runbook ready-for-major-ship, found ${payload.runbook}`);
}

if (payload.nextVersion !== '1.0.0') {
  throw new Error(`Expected nextVersion 1.0.0, found ${payload.nextVersion}`);
}

const commands = payload.steps.map((entry) => entry.command).filter(Boolean);

for (const command of ['pnpm release:promotion:test', 'pnpm release:ship major', 'pnpm version:check']) {
  if (!commands.includes(command)) {
    throw new Error(`Missing expected command in runbook: ${command}`);
  }
}
NODE

echo "One Point Zero major release runbook smoke test passed."
