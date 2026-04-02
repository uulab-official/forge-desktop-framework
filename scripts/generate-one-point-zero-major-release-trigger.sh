#!/bin/bash
set -euo pipefail

PREFLIGHT_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$PREFLIGHT_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-trigger.sh <one-point-zero-major-release-preflight.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$PREFLIGHT_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-trigger.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-trigger.json"

node - "$PREFLIGHT_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [preflightPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
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
const officialPresets = Array.isArray(preflight.officialPresets) ? preflight.officialPresets : [];
const launchOperators = Array.isArray(preflight.launchOperators) ? preflight.launchOperators : [];
const commandOwnerChecks = Array.isArray(preflight.commandOwnerChecks) ? preflight.commandOwnerChecks : [];
const preflightOwners = Array.isArray(preflight.preflightOwners) ? preflight.preflightOwners : [];

const gateChecks = [
  {
    name: 'major release preflight remains ready for ship execution',
    passed: preflight.preflight === 'ready-for-major-ship-preflight',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && preflight.nextVersion === '1.0.0',
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
    name: 'preflight still includes command-card and preflight validation',
    passed:
      Array.isArray(preflight.validationCommands) &&
      preflight.validationCommands.includes('pnpm release:major:command-card:test') &&
      preflight.validationCommands.includes('pnpm release:major:preflight:test'),
  },
  {
    name: 'preflight still includes explicit major ship command',
    passed: Array.isArray(preflight.shipCommands) && preflight.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'launch operators remain attached to the trigger surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'command owners remain attached to the trigger surface',
    passed: commandOwnerChecks.length > 0,
  },
  {
    name: 'preflight owners remain attached to the trigger surface',
    passed: preflightOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const trigger = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-trigger' : 'hold';
const validationCommands = Array.isArray(preflight.validationCommands)
  ? [...preflight.validationCommands, 'pnpm release:major:trigger:test']
  : ['pnpm release:major:trigger:test'];
const shipCommands = Array.isArray(preflight.shipCommands) ? preflight.shipCommands : [];
const triggerOwners = [
  { role: 'major-release-caller', status: 'pending' },
  { role: 'major-release-observer', status: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Trigger',
  '',
  `- Trigger: \`${trigger}\``,
  `- Current Version: \`${preflight.currentVersion}\``,
  `- Current Tag: \`${preflight.currentTag}\``,
  `- Next Version: \`${preflight.nextVersion}\``,
  `- Preflight Artifact: \`${path.basename(preflightPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Trigger Gates',
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
  '## Trigger Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...triggerOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
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
  ...(trigger === 'ready-for-major-release-trigger'
    ? [
        '1. Treat this trigger as the final execution trigger before the first `pnpm release:ship major` run.',
        '2. Record the major release caller and observer statuses above before executing the major ship command.',
        '3. If any `1.0` checklist line, preflight gate, or major ship command changes, regenerate the preflight and trigger artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed trigger gates are corrected.',
        '2. Regenerate the preflight and trigger artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  trigger,
  currentVersion: preflight.currentVersion,
  currentTag: preflight.currentTag,
  nextVersion: preflight.nextVersion,
  officialPresets,
  launchOperators,
  commandOwnerChecks,
  preflightOwners,
  triggerOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    preflight: preflightPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (trigger !== 'ready-for-major-release-trigger') {
  console.error('One Point Zero major release trigger failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release trigger written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
