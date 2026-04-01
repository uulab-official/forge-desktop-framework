#!/bin/bash
set -euo pipefail

RELEASE_STATUS_JSON="${1:-}"
RELEASE_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$RELEASE_STATUS_JSON" || -z "$RELEASE_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-freeze-report.sh <release-status.json> <release-checklist.md> [output-dir]"
  exit 1
fi

if [[ ! -f "$RELEASE_STATUS_JSON" ]]; then
  echo "Release status JSON not found: $RELEASE_STATUS_JSON"
  exit 1
fi

if [[ ! -f "$RELEASE_CHECKLIST_MD" ]]; then
  echo "Release checklist not found: $RELEASE_CHECKLIST_MD"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-freeze.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-freeze.json"

node - "$RELEASE_STATUS_JSON" "$RELEASE_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');

const [releaseStatusPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const releaseStatus = JSON.parse(fs.readFileSync(releaseStatusPath, 'utf8'));
const checklist = fs.readFileSync(checklistPath, 'utf8');

const extractChecklistValue = (label) => {
  const pattern = new RegExp(`^- ${label}:\\s*(.*)$`, 'm');
  const match = checklist.match(pattern);
  return match ? match[1].trim() : '';
};

const versionMatch = checklist.match(/^# Release Checklist: v([0-9]+\.[0-9]+\.[0-9]+)$/m);
if (!versionMatch) {
  console.error(`Unable to parse checklist version from ${checklistPath}`);
  process.exit(1);
}

const checklistVersion = versionMatch[1];
const checklistStatus = extractChecklistValue('Status');
const checklistSummary = extractChecklistValue('Summary');
const checklistUserFacing = extractChecklistValue('User-facing change');
const checklistRisks = extractChecklistValue('Follow-up risks');
const checklistNextTarget = extractChecklistValue('Next target');

const gateChecks = [
  {
    name: 'release-status passed',
    passed: releaseStatus.status === 'passed',
  },
  {
    name: 'checklist status ready',
    passed: checklistStatus === 'ready',
  },
  {
    name: 'checklist version matches release status',
    passed: checklistVersion === releaseStatus.version,
  },
  {
    name: 'checklist summary recorded',
    passed: checklistSummary.length > 0,
  },
  {
    name: 'checklist user-facing change recorded',
    passed: checklistUserFacing.length > 0,
  },
  {
    name: 'checklist follow-up risks recorded',
    passed: checklistRisks.length > 0,
  },
  {
    name: 'checklist next target recorded',
    passed: checklistNextTarget.length > 0,
  },
];

const goNoGo = gateChecks.every((entry) => entry.passed) ? 'go' : 'no-go';

const recommendedActions = [
  `Use \`${releaseStatusPath}\` as the condensed release health summary for version \`${releaseStatus.version}\`.`,
  `Keep \`${checklistPath}\` as the maintainer planning record for version \`${checklistVersion}\`.`,
  goNoGo === 'go'
    ? 'Proceed with the next 1.0 freeze decision only if no additional breaking-surface changes are queued.'
    : 'Do not treat this version as 1.0-freeze-ready until the failed gate above is corrected.',
];

const markdown = [
  '# One Point Zero Freeze',
  '',
  `- Decision: \`${goNoGo}\``,
  `- Version: \`${releaseStatus.version}\``,
  `- Tag: \`${releaseStatus.tag}\``,
  `- Checklist: \`${checklistPath}\``,
  '',
  '## Gate Checks',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Checklist Summary',
  '',
  `- Summary: ${checklistSummary}`,
  `- User-facing change: ${checklistUserFacing}`,
  `- Follow-up risks: ${checklistRisks}`,
  `- Next target: ${checklistNextTarget}`,
  '',
  '## Follow-Up',
  '',
  ...recommendedActions.map((action, index) => `${index + 1}. ${action}`),
  '',
].join('\n');

const payload = {
  decision: goNoGo,
  version: releaseStatus.version,
  tag: releaseStatus.tag,
  releaseStatusPath,
  checklistPath,
  checklist: {
    status: checklistStatus,
    summary: checklistSummary,
    userFacingChange: checklistUserFacing,
    followUpRisks: checklistRisks,
    nextTarget: checklistNextTarget,
  },
  gateChecks,
  recommendedActions,
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (goNoGo !== 'go') {
  console.error('One Point Zero freeze report failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero freeze report written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
