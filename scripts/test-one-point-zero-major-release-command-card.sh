#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-major-command-card.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/one-point-zero-readiness.json" <<'EOF'
{
  "status": "passed",
  "officialPresets": [
    { "preset": "launch-ready", "passed": true },
    { "preset": "support-ready", "passed": true },
    { "preset": "ops-ready", "passed": true },
    { "preset": "document-ready", "passed": true }
  ]
}
EOF

cat > "$WORK_DIR/release-status.json" <<'EOF'
{
  "status": "passed",
  "version": "0.1.85",
  "tag": "v0.1.85",
  "commit": "deadbeef85"
}
EOF

cat > "$WORK_DIR/one-point-zero-release-candidate.json" <<'EOF'
{
  "candidate": "ready-for-1.0-rc",
  "currentVersion": "0.1.85",
  "currentTag": "v0.1.85",
  "currentCommit": "deadbeef85",
  "nextVersion": "1.0.0",
  "nextChecklistPath": "docs/release-checklists/v1.0.0.md",
  "checklist": {
    "status": "ready",
    "summary": "turn the final launch-sheet artifact into an explicit major-release command-card surface.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-command-card.md/json as the final command-only handoff before the first 1.0.0 ship.",
    "followUpRisks": "the command card must stay aligned with the launch-sheet artifact and prepared v1.0.0 checklist",
    "nextTarget": "use the command card as the final command-only execution surface before pnpm release:ship major"
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
  "version": "0.1.85",
  "tag": "v0.1.85",
  "commit": "deadbeef85",
  "checklist": {
    "status": "ready",
    "summary": "turn the final launch-sheet artifact into an explicit major-release command-card surface.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-command-card.md/json as the final command-only handoff before the first 1.0.0 ship.",
    "followUpRisks": "the command card must stay aligned with the launch-sheet artifact and prepared v1.0.0 checklist",
    "nextTarget": "use the command card as the final command-only execution surface before pnpm release:ship major"
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

bash scripts/generate-one-point-zero-major-release-cockpit.sh \
  "$WORK_DIR/one-point-zero-readiness.json" \
  "$WORK_DIR/release-status.json" \
  "$WORK_DIR/one-point-zero-decision.json" \
  "$WORK_DIR/output/one-point-zero-promotion-plan.json" \
  "$WORK_DIR/output/one-point-zero-major-release-runbook.json" \
  "$WORK_DIR/output/one-point-zero-major-release-approval.json" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-packet.sh \
  "$WORK_DIR/output/one-point-zero-major-release-cockpit.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-signoff.sh \
  "$WORK_DIR/output/one-point-zero-major-release-packet.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-board.sh \
  "$WORK_DIR/output/one-point-zero-major-release-signoff.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-verdict.sh \
  "$WORK_DIR/output/one-point-zero-major-release-board.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-authorization.sh \
  "$WORK_DIR/output/one-point-zero-major-release-verdict.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-warrant.sh \
  "$WORK_DIR/output/one-point-zero-major-release-authorization.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-launch-sheet.sh \
  "$WORK_DIR/output/one-point-zero-major-release-warrant.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-command-card.sh \
  "$WORK_DIR/output/one-point-zero-major-release-launch-sheet.json" \
  "$TARGET" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-major-release-command-card.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-major-release-command-card.json" ]]

node - "$WORK_DIR/output/one-point-zero-major-release-command-card.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.commandCard !== 'ready-for-major-command-execution') {
  throw new Error(`Expected commandCard ready-for-major-command-execution, found ${payload.commandCard}`);
}

for (const command of ['pnpm release:major:launch-sheet:test', 'pnpm release:major:command-card:test', 'pnpm release:ship major']) {
  if (!payload.validationCommands.includes(command) && !payload.shipCommands.includes(command)) {
    throw new Error(`Missing expected command in command-card artifact: ${command}`);
  }
}
NODE

echo "One Point Zero major release command card smoke test passed."
