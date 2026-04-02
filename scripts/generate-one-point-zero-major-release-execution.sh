#!/bin/bash
set -euo pipefail

ACTIVATION_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$ACTIVATION_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-execution.sh <one-point-zero-major-release-activation.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$ACTIVATION_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-execution.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-execution.json"

node - "$ACTIVATION_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [activationPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
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
const officialPresets = Array.isArray(activation.officialPresets) ? activation.officialPresets : [];
const launchOperators = Array.isArray(activation.launchOperators) ? activation.launchOperators : [];
const activationOwners = Array.isArray(activation.activationOwners) ? activation.activationOwners : [];
const goLiveOwners = Array.isArray(activation.goLiveOwners) ? activation.goLiveOwners : [];

const gateChecks = [
  {
    name: 'major release activation remains ready for final execution confirmation',
    passed: activation.activation === 'ready-for-major-release-activation',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && activation.nextVersion === '1.0.0',
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
    name: 'activation still includes go-live and activation validation',
    passed:
      Array.isArray(activation.validationCommands) &&
      activation.validationCommands.includes('pnpm release:major:go-live:test') &&
      activation.validationCommands.includes('pnpm release:major:activation:test'),
  },
  {
    name: 'activation still includes explicit major ship command',
    passed: Array.isArray(activation.shipCommands) && activation.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'launch operators remain attached to the execution surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'activation owners remain attached to the execution surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'go-live owners remain attached to the execution surface',
    passed: goLiveOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const execution = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-execution' : 'hold';
const validationCommands = Array.isArray(activation.validationCommands)
  ? [...activation.validationCommands, 'pnpm release:major:execution:test']
  : ['pnpm release:major:execution:test'];
const shipCommands = Array.isArray(activation.shipCommands) ? activation.shipCommands : [];
const executionOwners = [
  { role: 'major-release-executor', status: 'pending' },
  { role: 'major-release-execution-observer', status: 'pending' },
];
const executionChecklist = [
  'Confirm the prepared v1.0.0 checklist still matches the first major ship scope and remains ready.',
  'Run the explicit activation and execution validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the executor and execution observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Execution',
  '',
  `- Execution: \`${execution}\``,
  `- Current Version: \`${activation.currentVersion}\``,
  `- Current Tag: \`${activation.currentTag}\``,
  `- Next Version: \`${activation.nextVersion}\``,
  `- Activation Artifact: \`${path.basename(activationPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Execution Gates',
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
  '## Execution Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...executionOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Execution Checklist',
  '',
  ...executionChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(execution === 'ready-for-major-release-execution'
    ? [
        '1. Treat this execution artifact as the last explicit execution confirmation surface before the first `pnpm release:ship major` run.',
        '2. Record the executor and execution observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, activation gate, or major ship command changes, regenerate the activation and execution artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed execution gates are corrected.',
        '2. Regenerate the activation and execution artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  execution,
  currentVersion: activation.currentVersion,
  currentTag: activation.currentTag,
  nextVersion: activation.nextVersion,
  officialPresets,
  launchOperators,
  goLiveOwners,
  activationOwners,
  executionOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  executionChecklist,
  sources: {
    activation: activationPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (execution !== 'ready-for-major-release-execution') {
  console.error('One Point Zero major release execution failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release execution written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
