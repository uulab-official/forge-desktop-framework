#!/bin/bash
set -euo pipefail

LEDGER_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$LEDGER_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-archive.sh <one-point-zero-major-release-ledger.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$LEDGER_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-archive.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-archive.json"

node - "$LEDGER_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [ledgerPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
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
const officialPresets = Array.isArray(ledger.officialPresets) ? ledger.officialPresets : [];
const activationOwners = Array.isArray(ledger.activationOwners) ? ledger.activationOwners : [];
const executionOwners = Array.isArray(ledger.executionOwners) ? ledger.executionOwners : [];
const attestationOwners = Array.isArray(ledger.attestationOwners) ? ledger.attestationOwners : [];
const sealOwners = Array.isArray(ledger.sealOwners) ? ledger.sealOwners : [];
const charterOwners = Array.isArray(ledger.charterOwners) ? ledger.charterOwners : [];
const canonOwners = Array.isArray(ledger.canonOwners) ? ledger.canonOwners : [];
const constitutionOwners = Array.isArray(ledger.constitutionOwners) ? ledger.constitutionOwners : [];
const covenantOwners = Array.isArray(ledger.covenantOwners) ? ledger.covenantOwners : [];
const compactOwners = Array.isArray(ledger.compactOwners) ? ledger.compactOwners : [];
const capsuleOwners = Array.isArray(ledger.capsuleOwners) ? ledger.capsuleOwners : [];
const ledgerOwners = Array.isArray(ledger.ledgerOwners) ? ledger.ledgerOwners : [];

const gateChecks = [
  {
    name: 'major release ledger remains ready for final archive',
    passed: ledger.ledger === 'ready-for-major-release-ledger',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && ledger.nextVersion === '1.0.0',
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
    name: 'ledger still includes execution, attestation, seal, charter, canon, constitution, covenant, compact, capsule, and ledger validation',
    passed:
      Array.isArray(ledger.validationCommands) &&
      ledger.validationCommands.includes('pnpm release:major:execution:test') &&
      ledger.validationCommands.includes('pnpm release:major:attestation:test') &&
      ledger.validationCommands.includes('pnpm release:major:seal:test') &&
      ledger.validationCommands.includes('pnpm release:major:charter:test') &&
      ledger.validationCommands.includes('pnpm release:major:canon:test') &&
      ledger.validationCommands.includes('pnpm release:major:constitution:test') &&
      ledger.validationCommands.includes('pnpm release:major:covenant:test') &&
      ledger.validationCommands.includes('pnpm release:major:compact:test') &&
      ledger.validationCommands.includes('pnpm release:major:capsule:test') &&
      ledger.validationCommands.includes('pnpm release:major:ledger:test'),
  },
  {
    name: 'ledger still includes explicit major ship command',
    passed: Array.isArray(ledger.shipCommands) && ledger.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'ledger owners remain attached to the archive surface',
    passed: ledgerOwners.length > 0,
  },
  {
    name: 'capsule owners remain attached to the archive surface',
    passed: capsuleOwners.length > 0,
  },
  {
    name: 'compact owners remain attached to the archive surface',
    passed: compactOwners.length > 0,
  },
  {
    name: 'covenant owners remain attached to the archive surface',
    passed: covenantOwners.length > 0,
  },
  {
    name: 'constitution owners remain attached to the archive surface',
    passed: constitutionOwners.length > 0,
  },
  {
    name: 'canon owners remain attached to the archive surface',
    passed: canonOwners.length > 0,
  },
  {
    name: 'charter owners remain attached to the archive surface',
    passed: charterOwners.length > 0,
  },
  {
    name: 'seal owners remain attached to the archive surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the archive surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the archive surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the archive surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const archive = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-archive' : 'hold';
const validationCommands = Array.isArray(ledger.validationCommands)
  ? [...ledger.validationCommands, 'pnpm release:major:archive:test']
  : ['pnpm release:major:archive:test'];
const shipCommands = Array.isArray(ledger.shipCommands) ? ledger.shipCommands : [];
const archiveOwners = [
  { role: 'major-release-archive-custodian', status: 'pending' },
  { role: 'major-release-archive-observer', status: 'pending' },
];
const archiveChecklist = [
  'Confirm the prepared v1.0.0 checklist, ledger artifact, and archive artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, canon, constitution, covenant, compact, capsule, ledger, and archive validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the archive custodian and archive observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Archive',
  '',
  `- Archive: \`${archive}\``,
  `- Current Version: \`${ledger.currentVersion}\``,
  `- Current Tag: \`${ledger.currentTag}\``,
  `- Next Version: \`${ledger.nextVersion}\``,
  `- Ledger Artifact: \`${path.basename(ledgerPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Archive Gates',
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
  '## Archive Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...archiveOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Archive Checklist',
  '',
  ...archiveChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(archive === 'ready-for-major-release-archive'
    ? [
        '1. Treat this archive artifact as the final immutable archive before the first `pnpm release:ship major` run.',
        '2. Record the archive custodian and archive observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, ledger gate, or major ship command changes, regenerate the ledger and archive artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed archive gates are corrected.',
        '2. Regenerate the ledger and archive artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  archive,
  currentVersion: ledger.currentVersion,
  currentTag: ledger.currentTag,
  nextVersion: ledger.nextVersion,
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
  archiveOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  archiveChecklist,
  sources: {
    ledger: ledgerPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (archive !== 'ready-for-major-release-archive') {
  console.error('One Point Zero major release archive failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release archive written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
