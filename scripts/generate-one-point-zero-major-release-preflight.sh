#!/bin/bash
set -euo pipefail

COMMAND_CARD_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$COMMAND_CARD_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-preflight.sh <one-point-zero-major-release-command-card.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$COMMAND_CARD_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-preflight.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-preflight.json"

node - "$COMMAND_CARD_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [commandCardPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const commandCard = JSON.parse(fs.readFileSync(commandCardPath, 'utf8'));
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
const officialPresets = Array.isArray(commandCard.officialPresets) ? commandCard.officialPresets : [];
const launchOperators = Array.isArray(commandCard.launchOperators) ? commandCard.launchOperators : [];
const commandOwnerChecks = Array.isArray(commandCard.commandOwnerChecks) ? commandCard.commandOwnerChecks : [];

const gateChecks = [
  {
    name: 'major release command card remains ready for command execution',
    passed: commandCard.commandCard === 'ready-for-major-command-execution',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && commandCard.nextVersion === '1.0.0',
  },
  {
    name: 'prepared checklist is now marked ready for the first major ship',
    passed: checklistStatus === 'ready',
  },
  {
    name: 'prepared checklist remains a major release checklist',
    passed: checklistBumpType === 'major',
  },
  {
    name: 'command card still includes launch-sheet and command-card validation',
    passed:
      Array.isArray(commandCard.validationCommands) &&
      commandCard.validationCommands.includes('pnpm release:major:launch-sheet:test') &&
      commandCard.validationCommands.includes('pnpm release:major:command-card:test'),
  },
  {
    name: 'command card still includes explicit major ship command',
    passed: Array.isArray(commandCard.shipCommands) && commandCard.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'launch operators remain attached to the preflight surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'command owners remain attached to the preflight surface',
    passed: commandOwnerChecks.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const preflight = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-ship-preflight' : 'hold';
const validationCommands = Array.isArray(commandCard.validationCommands)
  ? [...commandCard.validationCommands, 'pnpm release:major:preflight:test']
  : ['pnpm release:major:preflight:test'];
const shipCommands = Array.isArray(commandCard.shipCommands) ? commandCard.shipCommands : [];
const preflightOwners = [
  { role: 'release-operator', status: 'pending' },
  { role: 'release-maintainer', status: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Preflight',
  '',
  `- Preflight: \`${preflight}\``,
  `- Current Version: \`${commandCard.currentVersion}\``,
  `- Current Tag: \`${commandCard.currentTag}\``,
  `- Next Version: \`${commandCard.nextVersion}\``,
  `- Command Card Artifact: \`${path.basename(commandCardPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Preflight Gates',
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
  '## Preflight Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...preflightOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
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
  ...(preflight === 'ready-for-major-ship-preflight'
    ? [
        '1. Treat this preflight as the final readiness gate before the first `pnpm release:ship major` run.',
        '2. Record the release operator and release maintainer statuses above before executing the major ship command.',
        '3. If any `1.0` checklist line, command-card gate, or major ship command changes, regenerate the command card and preflight artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed preflight gates are corrected.',
        '2. Regenerate the command card and preflight artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  preflight,
  currentVersion: commandCard.currentVersion,
  currentTag: commandCard.currentTag,
  nextVersion: commandCard.nextVersion,
  officialPresets,
  launchOperators,
  commandOwnerChecks,
  preflightOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    commandCard: commandCardPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (preflight !== 'ready-for-major-ship-preflight') {
  console.error('One Point Zero major release preflight failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release preflight written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
