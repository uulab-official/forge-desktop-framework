#!/bin/bash
set -euo pipefail

TRIGGER_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$TRIGGER_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-rehearsal.sh <one-point-zero-major-release-trigger.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$TRIGGER_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-rehearsal.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-rehearsal.json"

node - "$TRIGGER_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [triggerPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const trigger = JSON.parse(fs.readFileSync(triggerPath, 'utf8'));
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
const officialPresets = Array.isArray(trigger.officialPresets) ? trigger.officialPresets : [];
const launchOperators = Array.isArray(trigger.launchOperators) ? trigger.launchOperators : [];
const triggerOwners = Array.isArray(trigger.triggerOwners) ? trigger.triggerOwners : [];
const commandOwnerChecks = Array.isArray(trigger.commandOwnerChecks) ? trigger.commandOwnerChecks : [];

const gateChecks = [
  {
    name: 'major release trigger remains ready for execution',
    passed: trigger.trigger === 'ready-for-major-release-trigger',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && trigger.nextVersion === '1.0.0',
  },
  {
    name: 'prepared checklist remains marked ready',
    passed: checklistStatus === 'ready',
  },
  {
    name: 'prepared checklist remains a major release checklist',
    passed: checklistBumpType === 'major',
  },
  {
    name: 'trigger still includes preflight and trigger validation',
    passed:
      Array.isArray(trigger.validationCommands) &&
      trigger.validationCommands.includes('pnpm release:major:preflight:test') &&
      trigger.validationCommands.includes('pnpm release:major:trigger:test'),
  },
  {
    name: 'trigger still includes explicit major ship command',
    passed: Array.isArray(trigger.shipCommands) && trigger.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'launch operators remain attached to the rehearsal surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'trigger owners remain attached to the rehearsal surface',
    passed: triggerOwners.length > 0,
  },
  {
    name: 'command owners remain attached to the rehearsal surface',
    passed: commandOwnerChecks.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const rehearsal = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-rehearsal' : 'hold';
const validationCommands = Array.isArray(trigger.validationCommands)
  ? [...trigger.validationCommands, 'pnpm release:major:rehearsal:test']
  : ['pnpm release:major:rehearsal:test'];
const shipCommands = Array.isArray(trigger.shipCommands) ? trigger.shipCommands : [];
const rehearsalOwners = [
  { role: 'major-release-rehearsal-caller', status: 'pending' },
  { role: 'major-release-rehearsal-observer', status: 'pending' },
];
const rehearsalSteps = [
  'Confirm the prepared v1.0.0 checklist still matches the major ship scope and status.',
  'Run the explicit trigger validation stack before the first pnpm release:ship major invocation.',
  'Record the rehearsal caller and observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Rehearsal',
  '',
  `- Rehearsal: \`${rehearsal}\``,
  `- Current Version: \`${trigger.currentVersion}\``,
  `- Current Tag: \`${trigger.currentTag}\``,
  `- Next Version: \`${trigger.nextVersion}\``,
  `- Trigger Artifact: \`${path.basename(triggerPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Rehearsal Gates',
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
  '## Trigger Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...triggerOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Rehearsal Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...rehearsalOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Rehearsal Steps',
  '',
  ...rehearsalSteps.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(rehearsal === 'ready-for-major-release-rehearsal'
    ? [
        '1. Treat this rehearsal artifact as the last dry-run layer before the first `pnpm release:ship major` execution.',
        '2. Record the rehearsal caller and observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, trigger gate, or major ship command changes, regenerate the trigger and rehearsal artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed rehearsal gates are corrected.',
        '2. Regenerate the trigger and rehearsal artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  rehearsal,
  currentVersion: trigger.currentVersion,
  currentTag: trigger.currentTag,
  nextVersion: trigger.nextVersion,
  officialPresets,
  launchOperators,
  triggerOwners,
  commandOwnerChecks,
  rehearsalOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  rehearsalSteps,
  sources: {
    trigger: triggerPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (rehearsal !== 'ready-for-major-release-rehearsal') {
  console.error('One Point Zero major release rehearsal failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release rehearsal written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
