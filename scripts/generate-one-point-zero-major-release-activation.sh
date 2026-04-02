#!/bin/bash
set -euo pipefail

GO_LIVE_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$GO_LIVE_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-activation.sh <one-point-zero-major-release-go-live.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$GO_LIVE_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-activation.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-activation.json"

node - "$GO_LIVE_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [goLivePath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const goLive = JSON.parse(fs.readFileSync(goLivePath, 'utf8'));
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
const officialPresets = Array.isArray(goLive.officialPresets) ? goLive.officialPresets : [];
const launchOperators = Array.isArray(goLive.launchOperators) ? goLive.launchOperators : [];
const goLiveOwners = Array.isArray(goLive.goLiveOwners) ? goLive.goLiveOwners : [];
const triggerOwners = Array.isArray(goLive.triggerOwners) ? goLive.triggerOwners : [];

const gateChecks = [
  {
    name: 'major release go-live remains ready for final execution',
    passed: goLive.goLive === 'ready-for-major-release-go-live',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && goLive.nextVersion === '1.0.0',
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
    name: 'go-live still includes rehearsal and go-live validation',
    passed:
      Array.isArray(goLive.validationCommands) &&
      goLive.validationCommands.includes('pnpm release:major:rehearsal:test') &&
      goLive.validationCommands.includes('pnpm release:major:go-live:test'),
  },
  {
    name: 'go-live still includes explicit major ship command',
    passed: Array.isArray(goLive.shipCommands) && goLive.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'launch operators remain attached to the activation surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'go-live owners remain attached to the activation surface',
    passed: goLiveOwners.length > 0,
  },
  {
    name: 'trigger owners remain attached to the activation surface',
    passed: triggerOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const activation = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-activation' : 'hold';
const validationCommands = Array.isArray(goLive.validationCommands)
  ? [...goLive.validationCommands, 'pnpm release:major:activation:test']
  : ['pnpm release:major:activation:test'];
const shipCommands = Array.isArray(goLive.shipCommands) ? goLive.shipCommands : [];
const activationOwners = [
  { role: 'major-release-activator', status: 'pending' },
  { role: 'major-release-activation-observer', status: 'pending' },
];
const activationChecklist = [
  'Confirm the prepared v1.0.0 checklist still matches the first major ship scope and remains ready.',
  'Run the explicit go-live and activation validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the activator and activation observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Activation',
  '',
  `- Activation: \`${activation}\``,
  `- Current Version: \`${goLive.currentVersion}\``,
  `- Current Tag: \`${goLive.currentTag}\``,
  `- Next Version: \`${goLive.nextVersion}\``,
  `- Go-Live Artifact: \`${path.basename(goLivePath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Activation Gates',
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
  '## Go-Live Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...goLiveOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Activation Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...activationOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Activation Checklist',
  '',
  ...activationChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(activation === 'ready-for-major-release-activation'
    ? [
        '1. Treat this activation artifact as the final execution confirmation surface before the first `pnpm release:ship major` run.',
        '2. Record the activator and activation observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, go-live gate, or major ship command changes, regenerate the go-live and activation artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed activation gates are corrected.',
        '2. Regenerate the go-live and activation artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  activation,
  currentVersion: goLive.currentVersion,
  currentTag: goLive.currentTag,
  nextVersion: goLive.nextVersion,
  officialPresets,
  launchOperators,
  triggerOwners,
  goLiveOwners,
  activationOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  activationChecklist,
  sources: {
    goLive: goLivePath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (activation !== 'ready-for-major-release-activation') {
  console.error('One Point Zero major release activation failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release activation written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
