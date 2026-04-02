#!/bin/bash
set -euo pipefail

SEAL_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$SEAL_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-charter.sh <one-point-zero-major-release-seal.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$SEAL_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-charter.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-charter.json"

node - "$SEAL_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [sealPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
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
const officialPresets = Array.isArray(seal.officialPresets) ? seal.officialPresets : [];
const activationOwners = Array.isArray(seal.activationOwners) ? seal.activationOwners : [];
const executionOwners = Array.isArray(seal.executionOwners) ? seal.executionOwners : [];
const attestationOwners = Array.isArray(seal.attestationOwners) ? seal.attestationOwners : [];
const sealOwners = Array.isArray(seal.sealOwners) ? seal.sealOwners : [];

const gateChecks = [
  {
    name: 'major release seal remains ready for final charter',
    passed: seal.seal === 'ready-for-major-release-seal',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && seal.nextVersion === '1.0.0',
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
    name: 'seal still includes execution, attestation, and seal validation',
    passed:
      Array.isArray(seal.validationCommands) &&
      seal.validationCommands.includes('pnpm release:major:execution:test') &&
      seal.validationCommands.includes('pnpm release:major:attestation:test') &&
      seal.validationCommands.includes('pnpm release:major:seal:test'),
  },
  {
    name: 'seal still includes explicit major ship command',
    passed: Array.isArray(seal.shipCommands) && seal.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'seal owners remain attached to the charter surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the charter surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the charter surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the charter surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const charter = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-charter' : 'hold';
const validationCommands = Array.isArray(seal.validationCommands)
  ? [...seal.validationCommands, 'pnpm release:major:charter:test']
  : ['pnpm release:major:charter:test'];
const shipCommands = Array.isArray(seal.shipCommands) ? seal.shipCommands : [];
const charterOwners = [
  { role: 'major-release-charter-custodian', status: 'pending' },
  { role: 'major-release-charter-observer', status: 'pending' },
];
const charterChecklist = [
  'Confirm the prepared v1.0.0 checklist, seal artifact, and charter artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, and charter validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the charter custodian and charter observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Charter',
  '',
  `- Charter: \`${charter}\``,
  `- Current Version: \`${seal.currentVersion}\``,
  `- Current Tag: \`${seal.currentTag}\``,
  `- Next Version: \`${seal.nextVersion}\``,
  `- Seal Artifact: \`${path.basename(sealPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Charter Gates',
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
  '## Seal Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...sealOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Charter Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...charterOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Charter Checklist',
  '',
  ...charterChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(charter === 'ready-for-major-release-charter'
    ? [
        '1. Treat this charter artifact as the final immutable charter before the first `pnpm release:ship major` run.',
        '2. Record the charter custodian and charter observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, seal gate, or major ship command changes, regenerate the seal and charter artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed charter gates are corrected.',
        '2. Regenerate the seal and charter artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  charter,
  currentVersion: seal.currentVersion,
  currentTag: seal.currentTag,
  nextVersion: seal.nextVersion,
  officialPresets,
  activationOwners,
  executionOwners,
  attestationOwners,
  sealOwners,
  charterOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  charterChecklist,
  sources: {
    seal: sealPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (charter !== 'ready-for-major-release-charter') {
  console.error('One Point Zero major release charter failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release charter written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
