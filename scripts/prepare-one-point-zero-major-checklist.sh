#!/bin/bash
set -euo pipefail

RELEASE_CANDIDATE_JSON="${1:-}"
TARGET_CHECKLIST_PATH="${2:-}"

if [[ -z "$RELEASE_CANDIDATE_JSON" ]]; then
  echo "Usage: bash scripts/prepare-one-point-zero-major-checklist.sh <one-point-zero-release-candidate.json> [target-checklist-path]"
  exit 1
fi

if [[ ! -f "$RELEASE_CANDIDATE_JSON" ]]; then
  echo "Required input not found: $RELEASE_CANDIDATE_JSON"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "$TARGET_CHECKLIST_PATH" ]]; then
  TARGET_CHECKLIST_PATH="$(node -e "const fs=require('node:fs'); const payload=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(payload.nextChecklistPath || 'docs/release-checklists/v1.0.0.md');" "$RELEASE_CANDIDATE_JSON")"
fi

mkdir -p "$(dirname "$TARGET_CHECKLIST_PATH")"

if [[ -f "$TARGET_CHECKLIST_PATH" ]]; then
  echo "One Point Zero major checklist already exists: $TARGET_CHECKLIST_PATH"
  exit 0
fi

CURRENT_DATE="$(date +%F)"

node - "$RELEASE_CANDIDATE_JSON" "$TARGET_CHECKLIST_PATH" "$CURRENT_DATE" <<'NODE'
const fs = require('node:fs');

const [candidatePath, checklistPath, currentDate] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));

if (payload.candidate !== 'ready-for-1.0-rc') {
  console.error(`Expected release-candidate artifact to be ready-for-1.0-rc, found ${payload.candidate}`);
  process.exit(1);
}

const nextVersion = payload.nextVersion || '1.0.0';
const majorChecklist = [
  `# Release Checklist: v${nextVersion}`,
  '',
  '- Status: draft',
  `- Date: ${currentDate}`,
  '- Bump Type: major',
  '',
  '## Scope',
  '',
  `- Summary: promote Forge from ${payload.currentVersion} to ${nextVersion} using the final release-candidate handoff.`,
  '- User-facing change: Forge will publish its first `1.0.0` release with the official preset surface and release-recovery contract frozen.',
  '',
  '## Public Surface',
  '',
  '- Docs: root README, getting started, deployment guide, CLI package README, and 1.0 gate doc',
  '- Scripts and release flow: 1.0 gate, status, freeze, decision, release-candidate, and release ship major path',
  '- CLI or scaffold surface: official presets `launch-ready`, `support-ready`, `ops-ready`, `document-ready`',
  '',
  '## Validation Plan',
  '',
  '- [ ] `pnpm --filter create-forge-desktop build`',
  '- [ ] `pnpm scaffold:external:test`',
  '- [ ] `pnpm release:audit`',
  '- [ ] `pnpm release:onepointzero:test`',
  '- [ ] `pnpm release:status:test`',
  '- [ ] `pnpm release:freeze:test`',
  '- [ ] `pnpm release:decision:test`',
  '- [ ] `pnpm release:rc:test`',
  '- [ ] `pnpm release:ship major`',
  '- [ ] `pnpm version:check`',
  '',
  '## Release Notes',
  '',
  '- Changelog entry drafted: no',
  `- Follow-up risks: ${payload.checklist?.followUpRisks || 'confirm that the final 1.0 promotion does not drift from the release-candidate handoff'}`,
  `- Next target: ${payload.recommendedActions?.[2] || 'cut Forge 1.0.0 once the product surface is frozen'}`,
  '',
].join('\n');

fs.writeFileSync(checklistPath, `${majorChecklist}\n`);
NODE

echo "Prepared One Point Zero major checklist: $TARGET_CHECKLIST_PATH"
