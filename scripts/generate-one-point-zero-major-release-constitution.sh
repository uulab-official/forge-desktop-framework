#!/bin/bash
set -euo pipefail

CANON_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$CANON_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-constitution.sh <one-point-zero-major-release-canon.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$CANON_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-constitution.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-constitution.json"

node - "$CANON_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [canonPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const canon = JSON.parse(fs.readFileSync(canonPath, 'utf8'));
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
const officialPresets = Array.isArray(canon.officialPresets) ? canon.officialPresets : [];
const activationOwners = Array.isArray(canon.activationOwners) ? canon.activationOwners : [];
const executionOwners = Array.isArray(canon.executionOwners) ? canon.executionOwners : [];
const attestationOwners = Array.isArray(canon.attestationOwners) ? canon.attestationOwners : [];
const sealOwners = Array.isArray(canon.sealOwners) ? canon.sealOwners : [];
const charterOwners = Array.isArray(canon.charterOwners) ? canon.charterOwners : [];
const canonOwners = Array.isArray(canon.canonOwners) ? canon.canonOwners : [];

const gateChecks = [
  {
    name: 'major release canon remains ready for final constitution',
    passed: canon.canon === 'ready-for-major-release-canon',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && canon.nextVersion === '1.0.0',
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
    name: 'canon still includes execution, attestation, seal, charter, and canon validation',
    passed:
      Array.isArray(canon.validationCommands) &&
      canon.validationCommands.includes('pnpm release:major:execution:test') &&
      canon.validationCommands.includes('pnpm release:major:attestation:test') &&
      canon.validationCommands.includes('pnpm release:major:seal:test') &&
      canon.validationCommands.includes('pnpm release:major:charter:test') &&
      canon.validationCommands.includes('pnpm release:major:canon:test'),
  },
  {
    name: 'canon still includes explicit major ship command',
    passed: Array.isArray(canon.shipCommands) && canon.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'canon owners remain attached to the constitution surface',
    passed: canonOwners.length > 0,
  },
  {
    name: 'charter owners remain attached to the constitution surface',
    passed: charterOwners.length > 0,
  },
  {
    name: 'seal owners remain attached to the constitution surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the constitution surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the constitution surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the constitution surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const constitution = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-constitution' : 'hold';
const validationCommands = Array.isArray(canon.validationCommands)
  ? [...canon.validationCommands, 'pnpm release:major:constitution:test']
  : ['pnpm release:major:constitution:test'];
const shipCommands = Array.isArray(canon.shipCommands) ? canon.shipCommands : [];
const constitutionOwners = [
  { role: 'major-release-constitution-custodian', status: 'pending' },
  { role: 'major-release-constitution-observer', status: 'pending' },
];
const constitutionChecklist = [
  'Confirm the prepared v1.0.0 checklist, canon artifact, and constitution artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, canon, and constitution validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the constitution custodian and constitution observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Constitution',
  '',
  `- Constitution: \`${constitution}\``,
  `- Current Version: \`${canon.currentVersion}\``,
  `- Current Tag: \`${canon.currentTag}\``,
  `- Next Version: \`${canon.nextVersion}\``,
  `- Canon Artifact: \`${path.basename(canonPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Constitution Gates',
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
  '## Canon Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...canonOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Constitution Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...constitutionOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Constitution Checklist',
  '',
  ...constitutionChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(constitution === 'ready-for-major-release-constitution'
    ? [
        '1. Treat this constitution artifact as the final immutable constitution before the first `pnpm release:ship major` run.',
        '2. Record the constitution custodian and constitution observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, canon gate, or major ship command changes, regenerate the canon and constitution artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed constitution gates are corrected.',
        '2. Regenerate the canon and constitution artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  constitution,
  currentVersion: canon.currentVersion,
  currentTag: canon.currentTag,
  nextVersion: canon.nextVersion,
  officialPresets,
  activationOwners,
  executionOwners,
  attestationOwners,
  sealOwners,
  charterOwners,
  canonOwners,
  constitutionOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  constitutionChecklist,
  sources: {
    canon: canonPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (constitution !== 'ready-for-major-release-constitution') {
  console.error('One Point Zero major release constitution failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release constitution written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
