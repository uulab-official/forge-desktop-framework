#!/bin/bash
set -euo pipefail

COVENANT_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$COVENANT_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-compact.sh <one-point-zero-major-release-covenant.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$COVENANT_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-compact.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-compact.json"

node - "$COVENANT_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [covenantPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const covenant = JSON.parse(fs.readFileSync(covenantPath, 'utf8'));
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
const officialPresets = Array.isArray(covenant.officialPresets) ? covenant.officialPresets : [];
const activationOwners = Array.isArray(covenant.activationOwners) ? covenant.activationOwners : [];
const executionOwners = Array.isArray(covenant.executionOwners) ? covenant.executionOwners : [];
const attestationOwners = Array.isArray(covenant.attestationOwners) ? covenant.attestationOwners : [];
const sealOwners = Array.isArray(covenant.sealOwners) ? covenant.sealOwners : [];
const charterOwners = Array.isArray(covenant.charterOwners) ? covenant.charterOwners : [];
const canonOwners = Array.isArray(covenant.canonOwners) ? covenant.canonOwners : [];
const constitutionOwners = Array.isArray(covenant.constitutionOwners) ? covenant.constitutionOwners : [];
const covenantOwners = Array.isArray(covenant.covenantOwners) ? covenant.covenantOwners : [];

const gateChecks = [
  {
    name: 'major release covenant remains ready for final compact',
    passed: covenant.covenant === 'ready-for-major-release-covenant',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && covenant.nextVersion === '1.0.0',
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
    name: 'covenant still includes execution, attestation, seal, charter, canon, constitution, and covenant validation',
    passed:
      Array.isArray(covenant.validationCommands) &&
      covenant.validationCommands.includes('pnpm release:major:execution:test') &&
      covenant.validationCommands.includes('pnpm release:major:attestation:test') &&
      covenant.validationCommands.includes('pnpm release:major:seal:test') &&
      covenant.validationCommands.includes('pnpm release:major:charter:test') &&
      covenant.validationCommands.includes('pnpm release:major:canon:test') &&
      covenant.validationCommands.includes('pnpm release:major:constitution:test') &&
      covenant.validationCommands.includes('pnpm release:major:covenant:test'),
  },
  {
    name: 'covenant still includes explicit major ship command',
    passed: Array.isArray(covenant.shipCommands) && covenant.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'covenant owners remain attached to the compact surface',
    passed: covenantOwners.length > 0,
  },
  {
    name: 'constitution owners remain attached to the compact surface',
    passed: constitutionOwners.length > 0,
  },
  {
    name: 'canon owners remain attached to the compact surface',
    passed: canonOwners.length > 0,
  },
  {
    name: 'charter owners remain attached to the compact surface',
    passed: charterOwners.length > 0,
  },
  {
    name: 'seal owners remain attached to the compact surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the compact surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the compact surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the compact surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const compact = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-compact' : 'hold';
const validationCommands = Array.isArray(covenant.validationCommands)
  ? [...covenant.validationCommands, 'pnpm release:major:compact:test']
  : ['pnpm release:major:compact:test'];
const shipCommands = Array.isArray(covenant.shipCommands) ? covenant.shipCommands : [];
const compactOwners = [
  { role: 'major-release-compact-custodian', status: 'pending' },
  { role: 'major-release-compact-observer', status: 'pending' },
];
const compactChecklist = [
  'Confirm the prepared v1.0.0 checklist, covenant artifact, and compact artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, canon, constitution, covenant, and compact validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the compact custodian and compact observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Compact',
  '',
  `- Compact: \`${compact}\``,
  `- Current Version: \`${covenant.currentVersion}\``,
  `- Current Tag: \`${covenant.currentTag}\``,
  `- Next Version: \`${covenant.nextVersion}\``,
  `- Covenant Artifact: \`${path.basename(covenantPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Compact Gates',
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
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Compact Checklist',
  '',
  ...compactChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(compact === 'ready-for-major-release-compact'
    ? [
        '1. Treat this compact artifact as the final immutable compact before the first `pnpm release:ship major` run.',
        '2. Record the compact custodian and compact observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, covenant gate, or major ship command changes, regenerate the covenant and compact artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed compact gates are corrected.',
        '2. Regenerate the covenant and compact artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  compact,
  currentVersion: covenant.currentVersion,
  currentTag: covenant.currentTag,
  nextVersion: covenant.nextVersion,
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
  gateChecks,
  validationCommands,
  shipCommands,
  compactChecklist,
  sources: {
    covenant: covenantPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (compact !== 'ready-for-major-release-compact') {
  console.error('One Point Zero major release compact failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release compact written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
