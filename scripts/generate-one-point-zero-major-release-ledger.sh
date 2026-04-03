#!/bin/bash
set -euo pipefail

CAPSULE_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$CAPSULE_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-ledger.sh <one-point-zero-major-release-capsule.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$CAPSULE_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-ledger.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-ledger.json"

node - "$CAPSULE_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [capsulePath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const capsule = JSON.parse(fs.readFileSync(capsulePath, 'utf8'));
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
const officialPresets = Array.isArray(capsule.officialPresets) ? capsule.officialPresets : [];
const activationOwners = Array.isArray(capsule.activationOwners) ? capsule.activationOwners : [];
const executionOwners = Array.isArray(capsule.executionOwners) ? capsule.executionOwners : [];
const attestationOwners = Array.isArray(capsule.attestationOwners) ? capsule.attestationOwners : [];
const sealOwners = Array.isArray(capsule.sealOwners) ? capsule.sealOwners : [];
const charterOwners = Array.isArray(capsule.charterOwners) ? capsule.charterOwners : [];
const canonOwners = Array.isArray(capsule.canonOwners) ? capsule.canonOwners : [];
const constitutionOwners = Array.isArray(capsule.constitutionOwners) ? capsule.constitutionOwners : [];
const covenantOwners = Array.isArray(capsule.covenantOwners) ? capsule.covenantOwners : [];
const compactOwners = Array.isArray(capsule.compactOwners) ? capsule.compactOwners : [];
const capsuleOwners = Array.isArray(capsule.capsuleOwners) ? capsule.capsuleOwners : [];

const gateChecks = [
  {
    name: 'major release capsule remains ready for final ledger',
    passed: capsule.capsule === 'ready-for-major-release-capsule',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && capsule.nextVersion === '1.0.0',
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
    name: 'capsule still includes execution, attestation, seal, charter, canon, constitution, covenant, compact, and capsule validation',
    passed:
      Array.isArray(capsule.validationCommands) &&
      capsule.validationCommands.includes('pnpm release:major:execution:test') &&
      capsule.validationCommands.includes('pnpm release:major:attestation:test') &&
      capsule.validationCommands.includes('pnpm release:major:seal:test') &&
      capsule.validationCommands.includes('pnpm release:major:charter:test') &&
      capsule.validationCommands.includes('pnpm release:major:canon:test') &&
      capsule.validationCommands.includes('pnpm release:major:constitution:test') &&
      capsule.validationCommands.includes('pnpm release:major:covenant:test') &&
      capsule.validationCommands.includes('pnpm release:major:compact:test') &&
      capsule.validationCommands.includes('pnpm release:major:capsule:test'),
  },
  {
    name: 'capsule still includes explicit major ship command',
    passed: Array.isArray(capsule.shipCommands) && capsule.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'capsule owners remain attached to the ledger surface',
    passed: capsuleOwners.length > 0,
  },
  {
    name: 'compact owners remain attached to the ledger surface',
    passed: compactOwners.length > 0,
  },
  {
    name: 'covenant owners remain attached to the ledger surface',
    passed: covenantOwners.length > 0,
  },
  {
    name: 'constitution owners remain attached to the ledger surface',
    passed: constitutionOwners.length > 0,
  },
  {
    name: 'canon owners remain attached to the ledger surface',
    passed: canonOwners.length > 0,
  },
  {
    name: 'charter owners remain attached to the ledger surface',
    passed: charterOwners.length > 0,
  },
  {
    name: 'seal owners remain attached to the ledger surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the ledger surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the ledger surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the ledger surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const ledger = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-ledger' : 'hold';
const validationCommands = Array.isArray(capsule.validationCommands)
  ? [...capsule.validationCommands, 'pnpm release:major:ledger:test']
  : ['pnpm release:major:ledger:test'];
const shipCommands = Array.isArray(capsule.shipCommands) ? capsule.shipCommands : [];
const ledgerOwners = [
  { role: 'major-release-ledger-custodian', status: 'pending' },
  { role: 'major-release-ledger-observer', status: 'pending' },
];
const ledgerChecklist = [
  'Confirm the prepared v1.0.0 checklist, capsule artifact, and ledger artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, canon, constitution, covenant, compact, capsule, and ledger validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the ledger custodian and ledger observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Ledger',
  '',
  `- Ledger: \`${ledger}\``,
  `- Current Version: \`${capsule.currentVersion}\``,
  `- Current Tag: \`${capsule.currentTag}\``,
  `- Next Version: \`${capsule.nextVersion}\``,
  `- Capsule Artifact: \`${path.basename(capsulePath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Ledger Gates',
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
  '## Covenant Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...covenantOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Compact Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...compactOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Capsule Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...capsuleOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Ledger Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...ledgerOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ledger Checklist',
  '',
  ...ledgerChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(ledger === 'ready-for-major-release-ledger'
    ? [
        '1. Treat this ledger artifact as the final immutable ledger before the first `pnpm release:ship major` run.',
        '2. Record the ledger custodian and ledger observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, capsule gate, or major ship command changes, regenerate the capsule and ledger artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed ledger gates are corrected.',
        '2. Regenerate the capsule and ledger artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  ledger,
  currentVersion: capsule.currentVersion,
  currentTag: capsule.currentTag,
  nextVersion: capsule.nextVersion,
  officialPresets,
  activationOwners,
  executionOwners,
  attestationOwners,
  sealOwners,
  charterOwners,
  canonOwners,
  constitutionOwners,
  covenantOwners,
  compactOwners,
  capsuleOwners,
  ledgerOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  ledgerChecklist,
  sources: {
    capsule: capsulePath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (ledger !== 'ready-for-major-release-ledger') {
  console.error('One Point Zero major release ledger failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release ledger written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
