#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-major-checklist.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/one-point-zero-release-candidate.json" <<'EOF'
{
  "candidate": "ready-for-1.0-rc",
  "currentVersion": "0.1.73",
  "currentTag": "v0.1.73",
  "currentCommit": "deadbeef73",
  "nextVersion": "1.0.0",
  "nextChecklistPath": "docs/release-checklists/v1.0.0.md",
  "checklist": {
    "status": "ready",
    "summary": "add a final release-candidate artifact that points the current stable line at the last 1.0.0 promotion handoff.",
    "userFacingChange": "maintainers now get one-point-zero-release-candidate.md/json as the final 1.0 promotion artifact.",
    "followUpRisks": "the release-candidate report must stay aligned with the decision payload and the 1.0 promotion rule",
    "nextTarget": "prepare docs/release-checklists/v1.0.0.md and use the release-candidate report as the handoff before pnpm release:ship major"
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

[[ -f "$TARGET" ]]

node - "$TARGET" <<'NODE'
const fs = require('node:fs');

const checklist = fs.readFileSync(process.argv[2], 'utf8');

const requiredSnippets = [
  '# Release Checklist: v1.0.0',
  '- Bump Type: major',
  '- [ ] `pnpm release:rc:test`',
  '- [ ] `pnpm release:ship major`',
  'official presets `launch-ready`, `support-ready`, `ops-ready`, `document-ready`',
];

for (const snippet of requiredSnippets) {
  if (!checklist.includes(snippet)) {
    throw new Error(`Missing expected snippet: ${snippet}`);
  }
}
NODE

echo "One Point Zero major checklist preparation smoke test passed."
