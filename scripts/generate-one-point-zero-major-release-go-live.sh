#!/bin/bash
set -euo pipefail

REHEARSAL_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$REHEARSAL_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-go-live.sh <one-point-zero-major-release-rehearsal.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$REHEARSAL_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-go-live.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-go-live.json"

node - "$REHEARSAL_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rehearsalPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const rehearsal = JSON.parse(fs.readFileSync(rehearsalPath, 'utf8'));
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
const officialPresets = Array.isArray(rehearsal.officialPresets) ? rehearsal.officialPresets : [];
const launchOperators = Array.isArray(rehearsal.launchOperators) ? rehearsal.launchOperators : [];
const triggerOwners = Array.isArray(rehearsal.triggerOwners) ? rehearsal.triggerOwners : [];
const rehearsalOwners = Array.isArray(rehearsal.rehearsalOwners) ? rehearsal.rehearsalOwners : [];

const gateChecks = [
  {
    name: 'major release rehearsal remains ready for dry-run execution',
    passed: rehearsal.rehearsal === 'ready-for-major-release-rehearsal',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && rehearsal.nextVersion === '1.0.0',
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
    name: 'rehearsal still includes trigger and rehearsal validation',
    passed:
      Array.isArray(rehearsal.validationCommands) &&
      rehearsal.validationCommands.includes('pnpm release:major:trigger:test') &&
      rehearsal.validationCommands.includes('pnpm release:major:rehearsal:test'),
  },
  {
    name: 'rehearsal still includes explicit major ship command',
    passed: Array.isArray(rehearsal.shipCommands) && rehearsal.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'launch operators remain attached to the go-live surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'trigger owners remain attached to the go-live surface',
    passed: triggerOwners.length > 0,
  },
  {
    name: 'rehearsal owners remain attached to the go-live surface',
    passed: rehearsalOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const goLive = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-go-live' : 'hold';
const validationCommands = Array.isArray(rehearsal.validationCommands)
  ? [...rehearsal.validationCommands, 'pnpm release:major:go-live:test']
  : ['pnpm release:major:go-live:test'];
const shipCommands = Array.isArray(rehearsal.shipCommands) ? rehearsal.shipCommands : [];
const goLiveOwners = [
  { role: 'major-release-go-live-caller', status: 'pending' },
  { role: 'major-release-go-live-observer', status: 'pending' },
];
const launchChecklist = [
  'Confirm the prepared v1.0.0 checklist still matches the first major ship scope and status.',
  'Run the explicit rehearsal validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the go-live caller and observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Go Live',
  '',
  `- Go Live: \`${goLive}\``,
  `- Current Version: \`${rehearsal.currentVersion}\``,
  `- Current Tag: \`${rehearsal.currentTag}\``,
  `- Next Version: \`${rehearsal.nextVersion}\``,
  `- Rehearsal Artifact: \`${path.basename(rehearsalPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Go-Live Gates',
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
  '## Go-Live Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...goLiveOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Launch Checklist',
  '',
  ...launchChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(goLive === 'ready-for-major-release-go-live'
    ? [
        '1. Treat this go-live artifact as the final execution surface before the first `pnpm release:ship major` run.',
        '2. Record the go-live caller and observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, rehearsal gate, or major ship command changes, regenerate the rehearsal and go-live artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed go-live gates are corrected.',
        '2. Regenerate the rehearsal and go-live artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  goLive,
  currentVersion: rehearsal.currentVersion,
  currentTag: rehearsal.currentTag,
  nextVersion: rehearsal.nextVersion,
  officialPresets,
  launchOperators,
  triggerOwners,
  rehearsalOwners,
  goLiveOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  launchChecklist,
  sources: {
    rehearsal: rehearsalPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (goLive !== 'ready-for-major-release-go-live') {
  console.error('One Point Zero major release go-live failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release go-live written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
