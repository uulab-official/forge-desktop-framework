#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-major-portfolio.XXXXXX")"
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
  "version": "0.1.108",
  "tag": "v0.1.108",
  "commit": "deadbeef108"
}
EOF

cat > "$WORK_DIR/one-point-zero-release-candidate.json" <<'EOF'
{
  "candidate": "ready-for-1.0-rc",
  "currentVersion": "0.1.108",
  "currentTag": "v0.1.108",
  "currentCommit": "deadbeef108",
  "nextVersion": "1.0.0",
  "nextChecklistPath": "docs/release-checklists/v1.0.0.md",
  "checklist": {
    "status": "ready",
    "summary": "add a final one-point-zero major-release portfolio artifact that turns the folio artifact plus prepared v1.0.0 checklist into the last immutable portfolio before the first 1.0.0 ship.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-portfolio.md/json as the final portfolio surface before the first 1.0.0 ship.",
    "followUpRisks": "the portfolio artifact must stay aligned with the folio artifact and prepared v1.0.0 checklist",
    "nextTarget": "use the portfolio artifact as the last immutable portfolio before pnpm release:ship major"
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
  "version": "0.1.108",
  "tag": "v0.1.108",
  "commit": "deadbeef108",
  "checklist": {
    "status": "ready",
    "summary": "add a final one-point-zero major-release portfolio artifact that turns the folio artifact plus prepared v1.0.0 checklist into the last immutable portfolio before the first 1.0.0 ship.",
    "userFacingChange": "maintainers now get one-point-zero-major-release-portfolio.md/json as the final portfolio surface before the first 1.0.0 ship.",
    "followUpRisks": "the portfolio artifact must stay aligned with the folio artifact and prepared v1.0.0 checklist",
    "nextTarget": "use the portfolio artifact as the last immutable portfolio before pnpm release:ship major"
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

bash scripts/generate-one-point-zero-promotion-plan-report.sh "$WORK_DIR/one-point-zero-release-candidate.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-runbook.sh "$WORK_DIR/output/one-point-zero-promotion-plan.json" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-approval.sh "$WORK_DIR/one-point-zero-decision.json" "$WORK_DIR/output/one-point-zero-promotion-plan.json" "$WORK_DIR/output/one-point-zero-major-release-runbook.json" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-cockpit.sh "$WORK_DIR/one-point-zero-readiness.json" "$WORK_DIR/release-status.json" "$WORK_DIR/one-point-zero-decision.json" "$WORK_DIR/output/one-point-zero-promotion-plan.json" "$WORK_DIR/output/one-point-zero-major-release-runbook.json" "$WORK_DIR/output/one-point-zero-major-release-approval.json" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-packet.sh "$WORK_DIR/output/one-point-zero-major-release-cockpit.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-signoff.sh "$WORK_DIR/output/one-point-zero-major-release-packet.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-board.sh "$WORK_DIR/output/one-point-zero-major-release-signoff.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-verdict.sh "$WORK_DIR/output/one-point-zero-major-release-board.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-authorization.sh "$WORK_DIR/output/one-point-zero-major-release-verdict.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-warrant.sh "$WORK_DIR/output/one-point-zero-major-release-authorization.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-launch-sheet.sh "$WORK_DIR/output/one-point-zero-major-release-warrant.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-command-card.sh "$WORK_DIR/output/one-point-zero-major-release-launch-sheet.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-preflight.sh "$WORK_DIR/output/one-point-zero-major-release-command-card.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-trigger.sh "$WORK_DIR/output/one-point-zero-major-release-preflight.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-rehearsal.sh "$WORK_DIR/output/one-point-zero-major-release-trigger.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-go-live.sh "$WORK_DIR/output/one-point-zero-major-release-rehearsal.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-activation.sh "$WORK_DIR/output/one-point-zero-major-release-go-live.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-execution.sh "$WORK_DIR/output/one-point-zero-major-release-activation.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-attestation.sh "$WORK_DIR/output/one-point-zero-major-release-execution.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-seal.sh "$WORK_DIR/output/one-point-zero-major-release-attestation.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-charter.sh "$WORK_DIR/output/one-point-zero-major-release-seal.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-canon.sh "$WORK_DIR/output/one-point-zero-major-release-charter.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-constitution.sh "$WORK_DIR/output/one-point-zero-major-release-canon.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-covenant.sh "$WORK_DIR/output/one-point-zero-major-release-constitution.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-compact.sh "$WORK_DIR/output/one-point-zero-major-release-covenant.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-capsule.sh "$WORK_DIR/output/one-point-zero-major-release-compact.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-ledger.sh "$WORK_DIR/output/one-point-zero-major-release-capsule.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-archive.sh "$WORK_DIR/output/one-point-zero-major-release-ledger.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-vault.sh "$WORK_DIR/output/one-point-zero-major-release-archive.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-registry.sh "$WORK_DIR/output/one-point-zero-major-release-vault.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-directory.sh "$WORK_DIR/output/one-point-zero-major-release-registry.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-manifest.sh "$WORK_DIR/output/one-point-zero-major-release-directory.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-dossier.sh "$WORK_DIR/output/one-point-zero-major-release-manifest.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-folio.sh "$WORK_DIR/output/one-point-zero-major-release-dossier.json" "$TARGET" "$WORK_DIR/output"
bash scripts/generate-one-point-zero-major-release-portfolio.sh "$WORK_DIR/output/one-point-zero-major-release-folio.json" "$TARGET" "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-major-release-portfolio.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-major-release-portfolio.json" ]]

node - "$WORK_DIR/output/one-point-zero-major-release-portfolio.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.portfolio !== 'ready-for-major-release-portfolio') {
  throw new Error(`Expected portfolio ready-for-major-release-portfolio, found ${payload.portfolio}`);
}

for (const command of [
  'pnpm release:major:execution:test',
  'pnpm release:major:attestation:test',
  'pnpm release:major:seal:test',
  'pnpm release:major:charter:test',
  'pnpm release:major:canon:test',
  'pnpm release:major:constitution:test',
  'pnpm release:major:covenant:test',
  'pnpm release:major:compact:test',
  'pnpm release:major:capsule:test',
  'pnpm release:major:ledger:test',
  'pnpm release:major:archive:test',
  'pnpm release:major:vault:test',
  'pnpm release:major:registry:test',
  'pnpm release:major:directory:test',
  'pnpm release:major:manifest:test',
  'pnpm release:major:dossier:test',
  'pnpm release:major:folio:test',
  'pnpm release:major:portfolio:test',
  'pnpm release:ship major'
]) {
  if (!payload.validationCommands.includes(command) && !payload.shipCommands.includes(command)) {
    throw new Error(`Missing expected command in portfolio artifact: ${command}`);
  }
}
NODE

echo "One Point Zero major release portfolio smoke test passed."
