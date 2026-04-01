#!/bin/bash
set -euo pipefail

COCKPIT_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$COCKPIT_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-packet.sh <one-point-zero-major-release-cockpit.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$COCKPIT_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-packet.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-packet.json"

node - "$COCKPIT_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [cockpitPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const cockpit = JSON.parse(fs.readFileSync(cockpitPath, 'utf8'));
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
const checklistUserFacingChange = extractChecklistValue('User-facing change');
const checklistFollowUpRisks = extractChecklistValue('Follow-up risks');
const checklistNextTarget = extractChecklistValue('Next target');
const officialPresets = Array.isArray(cockpit.officialPresets) ? cockpit.officialPresets : [];

const gateChecks = [
  {
    name: 'major release cockpit remains green',
    passed: cockpit.status === 'major-release-cockpit-green',
  },
  {
    name: 'prepared checklist version remains 1.0.0',
    passed: checklistVersion === '1.0.0' && cockpit.nextVersion === '1.0.0',
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
    name: 'prepared checklist names the official preset surface',
    passed: officialPresets.length > 0 && officialPresets.every((preset) => checklist.includes(`\`${preset}\``)),
  },
  {
    name: 'prepared checklist still includes the major ship command',
    passed: checklist.includes('`pnpm release:ship major`'),
  },
  {
    name: 'cockpit still includes explicit major ship commands',
    passed: Array.isArray(cockpit.shipCommands) && cockpit.shipCommands.includes('pnpm release:ship major'),
  },
];

const packet = gateChecks.every((entry) => entry.passed) ? 'ready-for-human-signoff' : 'hold';
const validationCommands = Array.isArray(cockpit.validationCommands) ? cockpit.validationCommands : [];
const shipCommands = Array.isArray(cockpit.shipCommands) ? cockpit.shipCommands : [];

const markdown = [
  '# One Point Zero Major Release Packet',
  '',
  `- Packet: \`${packet}\``,
  `- Current Version: \`${cockpit.currentVersion}\``,
  `- Current Tag: \`${cockpit.currentTag}\``,
  `- Next Version: \`${cockpit.nextVersion}\``,
  `- Major Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Packet Gates',
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
  `- User-facing change: ${checklistUserFacingChange}`,
  `- Follow-up risks: ${checklistFollowUpRisks}`,
  `- Next target: ${checklistNextTarget}`,
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Major Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Follow-Up',
  '',
  ...(packet === 'ready-for-human-signoff'
    ? [
        '1. Use this packet, the `v1.0.0` checklist, and the cockpit artifact together for the final human approval meeting.',
        '2. Mark the checklist `ready` only after maintainers explicitly sign off on the packet gates above.',
        '3. Once sign-off is complete, run the major ship commands in order without changing the 1.0-facing surface.',
      ]
    : [
        '1. Do not start the first major release until the failed packet gates are corrected.',
        '2. Regenerate the cockpit summary and this packet after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  packet,
  currentVersion: cockpit.currentVersion,
  currentTag: cockpit.currentTag,
  nextVersion: cockpit.nextVersion,
  officialPresets,
  checklist: {
    path: checklistPath,
    version: checklistVersion,
    status: checklistStatus,
    bumpType: checklistBumpType,
    summary: checklistSummary,
    userFacingChange: checklistUserFacingChange,
    followUpRisks: checklistFollowUpRisks,
    nextTarget: checklistNextTarget,
  },
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    cockpit: cockpitPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (packet !== 'ready-for-human-signoff') {
  console.error('One Point Zero major release packet failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release packet written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
