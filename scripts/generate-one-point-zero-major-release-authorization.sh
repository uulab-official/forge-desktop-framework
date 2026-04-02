#!/bin/bash
set -euo pipefail

VERDICT_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$VERDICT_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-authorization.sh <one-point-zero-major-release-verdict.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$VERDICT_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-authorization.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-authorization.json"

node - "$VERDICT_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [verdictPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const verdict = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
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
const checklistBumpType = extractChecklistValue('Bump Type');
const checklistSummary = extractChecklistValue('Summary');
const checklistFollowUpRisks = extractChecklistValue('Follow-up risks');
const officialPresets = Array.isArray(verdict.officialPresets) ? verdict.officialPresets : [];
const boardSlots = Array.isArray(verdict.boardSlots) ? verdict.boardSlots : [];

const gateChecks = [
  {
    name: 'major release verdict remains ready for major go-no-go',
    passed: verdict.verdict === 'ready-for-major-go-no-go',
  },
  {
    name: 'prepared checklist still targets 1.0.0',
    passed: checklistVersion === '1.0.0' && verdict.nextVersion === '1.0.0',
  },
  {
    name: 'prepared checklist remains a major release checklist',
    passed: checklistBumpType === 'major',
  },
  {
    name: 'prepared checklist remains draft or ready',
    passed: checklistStatus === 'draft' || checklistStatus === 'ready',
  },
  {
    name: 'verdict still includes explicit major ship command',
    passed: Array.isArray(verdict.shipCommands) && verdict.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'verdict still includes explicit verdict validation',
    passed: Array.isArray(verdict.validationCommands) && verdict.validationCommands.includes('pnpm release:major:verdict:test'),
  },
  {
    name: 'board slots remain attached to the authorization surface',
    passed: boardSlots.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const authorization = gateChecks.every((entry) => entry.passed) ? 'authorized-for-major-ship' : 'hold';
const validationCommands = Array.isArray(verdict.validationCommands)
  ? [...verdict.validationCommands, 'pnpm release:major:authorization:test']
  : ['pnpm release:major:authorization:test'];
const shipCommands = Array.isArray(verdict.shipCommands) ? verdict.shipCommands : [];
const authorizationOwners = [
  { role: 'framework-release-owner', status: 'pending' },
  { role: 'operational-approver', status: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Authorization',
  '',
  `- Authorization: \`${authorization}\``,
  `- Current Version: \`${verdict.currentVersion}\``,
  `- Current Tag: \`${verdict.currentTag}\``,
  `- Next Version: \`${verdict.nextVersion}\``,
  `- Verdict Artifact: \`${path.basename(verdictPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Authorization Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Checklist Context',
  '',
  `- Status: ${checklistStatus}`,
  `- Bump Type: ${checklistBumpType}`,
  `- Summary: ${checklistSummary}`,
  `- Follow-up risks: ${checklistFollowUpRisks}`,
  '',
  '## Authorization Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...authorizationOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Board Slots',
  '',
  '| Role | Resolution |',
  '| --- | --- |',
  ...boardSlots.map((entry) => `| \`${entry.role}\` | ${entry.resolution} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Follow-Up',
  '',
  ...(authorization === 'authorized-for-major-ship'
    ? [
        '1. Treat this authorization sheet as the last maintainer execution handoff before the first `pnpm release:ship major` run.',
        '2. Record the final release owner and operational approver statuses above before promoting the `v1.0.0` checklist to `ready`.',
        '3. If any 1.0-facing preset, verdict gate, or major ship command changes, regenerate the verdict and authorization artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed authorization gates are corrected.',
        '2. Regenerate the verdict and authorization artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  authorization,
  currentVersion: verdict.currentVersion,
  currentTag: verdict.currentTag,
  nextVersion: verdict.nextVersion,
  officialPresets,
  boardSlots,
  authorizationOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    verdict: verdictPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (authorization !== 'authorized-for-major-ship') {
  console.error('One Point Zero major release authorization failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release authorization written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
