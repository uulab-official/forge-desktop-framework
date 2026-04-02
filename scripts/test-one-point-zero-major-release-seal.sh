#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-major-seal.XXXXXX")"
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
  "version": "0.1.93",
  "tag": "v0.1.93",
  "commit": "deadbeef93"
}
EOF

cat > "$WORK_DIR/one-point-zero-release-candidate.json" <<'EOF'
{
  "candidate": "ready-for-1.0-rc",
  "currentVersion": "0.1.93",
  "currentTag": "v0.1.93",
  "currentCommit": "deadbeef93",
  "nextVersion": "1.0.0",
  "nextChecklistPath": "docs/release-checklists/v1.0.0.md",
  "checklist": {
    "status": "ready",
    "summary": "add a final one-point-zero major-release seal artifact that turns the attestation artifact plus prepared v1.0.0 checklist into the last immutable seal before the first 1.0.0 ship.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-seal.md/json as the final seal surface before the first 1.0.0 ship.",
    "followUpRisks": "the seal artifact must stay aligned with the attestation artifact and prepared v1.0.0 checklist",
    "nextTarget": "use the seal artifact as the last immutable seal before pnpm release:ship major"
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
  "version": "0.1.93",
  "tag": "v0.1.93",
  "commit": "deadbeef93",
  "checklist": {
    "status": "ready",
    "summary": "add a final one-point-zero major-release seal artifact that turns the attestation artifact plus prepared v1.0.0 checklist into the last immutable seal before the first 1.0.0 ship.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-seal.md/json as the final seal surface before the first 1.0.0 ship.",
    "followUpRisks": "the seal artifact must stay aligned with the attestation artifact and prepared v1.0.0 checklist",
    "nextTarget": "use the seal artifact as the last immutable seal before pnpm release:ship major"
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

node - "$TARGET" <<'NODE'
const fs = require('node:fs');
const checklistPath = process.argv[2];
const content = fs.readFileSync(checklistPath, 'utf8').replace('- Status: draft', '- Status: ready');
fs.writeFileSync(checklistPath, content);
NODE

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

bash scripts/generate-one-point-zero-major-release-preflight.sh \
  "$WORK_DIR/output/one-point-zero-major-release-command-card.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-trigger.sh \
  "$WORK_DIR/output/one-point-zero-major-release-preflight.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-rehearsal.sh \
  "$WORK_DIR/output/one-point-zero-major-release-trigger.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-go-live.sh \
  "$WORK_DIR/output/one-point-zero-major-release-rehearsal.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-activation.sh \
  "$WORK_DIR/output/one-point-zero-major-release-go-live.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-execution.sh \
  "$WORK_DIR/output/one-point-zero-major-release-activation.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-attestation.sh \
  "$WORK_DIR/output/one-point-zero-major-release-execution.json" \
  "$TARGET" \
  "$WORK_DIR/output"

bash scripts/generate-one-point-zero-major-release-seal.sh \
  "$WORK_DIR/output/one-point-zero-major-release-attestation.json" \
  "$TARGET" \
  "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-major-release-seal.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-major-release-seal.json" ]]

node - "$WORK_DIR/output/one-point-zero-major-release-seal.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.seal !== 'ready-for-major-release-seal') {
  throw new Error(`Expected seal ready-for-major-release-seal, found ${payload.seal}`);
}

for (const command of ['pnpm release:major:execution:test', 'pnpm release:major:attestation:test', 'pnpm release:major:seal:test', 'pnpm release:ship major']) {
  if (!payload.validationCommands.includes(command) && !payload.shipCommands.includes(command)) {
    throw new Error(`Missing expected command in seal artifact: ${command}`);
  }
}
NODE

echo "One Point Zero major release seal smoke test passed."
