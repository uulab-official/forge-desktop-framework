#!/bin/bash
set -euo pipefail

LAUNCH_SHEET_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$LAUNCH_SHEET_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-command-card.sh <one-point-zero-major-release-launch-sheet.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$LAUNCH_SHEET_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-command-card.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-command-card.json"

node - "$LAUNCH_SHEET_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [launchSheetPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const launchSheet = JSON.parse(fs.readFileSync(launchSheetPath, 'utf8'));
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
const officialPresets = Array.isArray(launchSheet.officialPresets) ? launchSheet.officialPresets : [];
const launchOperators = Array.isArray(launchSheet.launchOperators) ? launchSheet.launchOperators : [];

const gateChecks = [
  {
    name: 'major release launch sheet remains ready for execution',
    passed: launchSheet.launchSheet === 'ready-for-major-launch-execution',
  },
  {
    name: 'prepared checklist still targets 1.0.0',
    passed: checklistVersion === '1.0.0' && launchSheet.nextVersion === '1.0.0',
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
    name: 'launch sheet still includes explicit major ship command',
    passed: Array.isArray(launchSheet.shipCommands) && launchSheet.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'launch sheet still includes explicit launch-sheet validation',
    passed: Array.isArray(launchSheet.validationCommands) && launchSheet.validationCommands.includes('pnpm release:major:launch-sheet:test'),
  },
  {
    name: 'launch operators remain attached to the command card surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const commandCard = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-command-execution' : 'hold';
const validationCommands = Array.isArray(launchSheet.validationCommands)
  ? [...launchSheet.validationCommands, 'pnpm release:major:command-card:test']
  : ['pnpm release:major:command-card:test'];
const shipCommands = Array.isArray(launchSheet.shipCommands) ? launchSheet.shipCommands : [];
const commandOwnerChecks = [
  { role: 'release-operator', status: 'pending' },
  { role: 'command-caller', status: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Command Card',
  '',
  `- Command Card: \`${commandCard}\``,
  `- Current Version: \`${launchSheet.currentVersion}\``,
  `- Current Tag: \`${launchSheet.currentTag}\``,
  `- Next Version: \`${launchSheet.nextVersion}\``,
  `- Launch Sheet Artifact: \`${path.basename(launchSheetPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Command Gates',
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
  '',
  '## Launch Operators',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...launchOperators.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Command Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...commandOwnerChecks.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
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
  ...(commandCard === 'ready-for-major-command-execution'
    ? [
        '1. Treat this command card as the final command-only surface before the first `pnpm release:ship major` run.',
        '2. Record the release operator and command caller statuses above before promoting the `v1.0.0` checklist to `ready`.',
        '3. If any 1.0-facing preset, launch-sheet gate, or major ship command changes, regenerate the launch sheet and command card artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed command gates are corrected.',
        '2. Regenerate the launch sheet and command card artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  commandCard,
  currentVersion: launchSheet.currentVersion,
  currentTag: launchSheet.currentTag,
  nextVersion: launchSheet.nextVersion,
  officialPresets,
  launchOperators,
  commandOwnerChecks,
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    launchSheet: launchSheetPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (commandCard !== 'ready-for-major-command-execution') {
  console.error('One Point Zero major release command card failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release command card written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
