#!/bin/bash
set -euo pipefail

EXECUTION_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$EXECUTION_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-attestation.sh <one-point-zero-major-release-execution.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$EXECUTION_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-attestation.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-attestation.json"

node - "$EXECUTION_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [executionPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
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
const officialPresets = Array.isArray(execution.officialPresets) ? execution.officialPresets : [];
const executionOwners = Array.isArray(execution.executionOwners) ? execution.executionOwners : [];
const activationOwners = Array.isArray(execution.activationOwners) ? execution.activationOwners : [];
const launchOperators = Array.isArray(execution.launchOperators) ? execution.launchOperators : [];

const gateChecks = [
  {
    name: 'major release execution remains ready for attestation',
    passed: execution.execution === 'ready-for-major-release-execution',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && execution.nextVersion === '1.0.0',
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
    name: 'execution still includes activation and execution validation',
    passed:
      Array.isArray(execution.validationCommands) &&
      execution.validationCommands.includes('pnpm release:major:activation:test') &&
      execution.validationCommands.includes('pnpm release:major:execution:test'),
  },
  {
    name: 'execution still includes explicit major ship command',
    passed: Array.isArray(execution.shipCommands) && execution.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'execution owners remain attached to the attestation surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the attestation surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'launch operators remain attached to the attestation surface',
    passed: launchOperators.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const attestation = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-attestation' : 'hold';
const validationCommands = Array.isArray(execution.validationCommands)
  ? [...execution.validationCommands, 'pnpm release:major:attestation:test']
  : ['pnpm release:major:attestation:test'];
const shipCommands = Array.isArray(execution.shipCommands) ? execution.shipCommands : [];
const attestationOwners = [
  { role: 'major-release-attestor', status: 'pending' },
  { role: 'major-release-attestation-observer', status: 'pending' },
];
const attestationChecklist = [
  'Confirm the prepared v1.0.0 checklist still matches the first major ship scope and remains ready.',
  'Run the activation, execution, and attestation validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the attestor and attestation observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Attestation',
  '',
  `- Attestation: \`${attestation}\``,
  `- Current Version: \`${execution.currentVersion}\``,
  `- Current Tag: \`${execution.currentTag}\``,
  `- Next Version: \`${execution.nextVersion}\``,
  `- Execution Artifact: \`${path.basename(executionPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Attestation Gates',
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
  '## Attestation Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...attestationOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Attestation Checklist',
  '',
  ...attestationChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(attestation === 'ready-for-major-release-attestation'
    ? [
        '1. Treat this attestation artifact as the final immutable major-release record before the first `pnpm release:ship major` run.',
        '2. Record the attestor and attestation observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, execution gate, or major ship command changes, regenerate the execution and attestation artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed attestation gates are corrected.',
        '2. Regenerate the execution and attestation artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  attestation,
  currentVersion: execution.currentVersion,
  currentTag: execution.currentTag,
  nextVersion: execution.nextVersion,
  officialPresets,
  launchOperators,
  activationOwners,
  executionOwners,
  attestationOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  attestationChecklist,
  sources: {
    execution: executionPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (attestation !== 'ready-for-major-release-attestation') {
  console.error('One Point Zero major release attestation failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release attestation written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
