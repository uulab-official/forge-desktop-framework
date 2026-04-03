#!/bin/bash
set -euo pipefail

COMPACT_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$COMPACT_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-capsule.sh <one-point-zero-major-release-compact.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$COMPACT_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-capsule.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-capsule.json"

node - "$COMPACT_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [compactPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const compact = JSON.parse(fs.readFileSync(compactPath, 'utf8'));
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
const officialPresets = Array.isArray(compact.officialPresets) ? compact.officialPresets : [];
const activationOwners = Array.isArray(compact.activationOwners) ? compact.activationOwners : [];
const executionOwners = Array.isArray(compact.executionOwners) ? compact.executionOwners : [];
const attestationOwners = Array.isArray(compact.attestationOwners) ? compact.attestationOwners : [];
const sealOwners = Array.isArray(compact.sealOwners) ? compact.sealOwners : [];
const charterOwners = Array.isArray(compact.charterOwners) ? compact.charterOwners : [];
const canonOwners = Array.isArray(compact.canonOwners) ? compact.canonOwners : [];
const constitutionOwners = Array.isArray(compact.constitutionOwners) ? compact.constitutionOwners : [];
const covenantOwners = Array.isArray(compact.covenantOwners) ? compact.covenantOwners : [];
const compactOwners = Array.isArray(compact.compactOwners) ? compact.compactOwners : [];

const gateChecks = [
  {
    name: 'major release compact remains ready for final capsule',
    passed: compact.compact === 'ready-for-major-release-compact',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && compact.nextVersion === '1.0.0',
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
    name: 'compact still includes execution, attestation, seal, charter, canon, constitution, covenant, and compact validation',
    passed:
      Array.isArray(compact.validationCommands) &&
      compact.validationCommands.includes('pnpm release:major:execution:test') &&
      compact.validationCommands.includes('pnpm release:major:attestation:test') &&
      compact.validationCommands.includes('pnpm release:major:seal:test') &&
      compact.validationCommands.includes('pnpm release:major:charter:test') &&
      compact.validationCommands.includes('pnpm release:major:canon:test') &&
      compact.validationCommands.includes('pnpm release:major:constitution:test') &&
      compact.validationCommands.includes('pnpm release:major:covenant:test') &&
      compact.validationCommands.includes('pnpm release:major:compact:test'),
  },
  {
    name: 'compact still includes explicit major ship command',
    passed: Array.isArray(compact.shipCommands) && compact.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'compact owners remain attached to the capsule surface',
    passed: compactOwners.length > 0,
  },
  {
    name: 'covenant owners remain attached to the capsule surface',
    passed: covenantOwners.length > 0,
  },
  {
    name: 'constitution owners remain attached to the capsule surface',
    passed: constitutionOwners.length > 0,
  },
  {
    name: 'canon owners remain attached to the capsule surface',
    passed: canonOwners.length > 0,
  },
  {
    name: 'charter owners remain attached to the capsule surface',
    passed: charterOwners.length > 0,
  },
  {
    name: 'seal owners remain attached to the capsule surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the capsule surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the capsule surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the capsule surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const capsule = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-capsule' : 'hold';
const validationCommands = Array.isArray(compact.validationCommands)
  ? [...compact.validationCommands, 'pnpm release:major:capsule:test']
  : ['pnpm release:major:capsule:test'];
const shipCommands = Array.isArray(compact.shipCommands) ? compact.shipCommands : [];
const capsuleOwners = [
  { role: 'major-release-capsule-custodian', status: 'pending' },
  { role: 'major-release-capsule-observer', status: 'pending' },
];
const capsuleChecklist = [
  'Confirm the prepared v1.0.0 checklist, compact artifact, and capsule artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, canon, constitution, covenant, compact, and capsule validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the capsule custodian and capsule observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Capsule',
  '',
  `- Capsule: \`${capsule}\``,
  `- Current Version: \`${compact.currentVersion}\``,
  `- Current Tag: \`${compact.currentTag}\``,
  `- Next Version: \`${compact.nextVersion}\``,
  `- Compact Artifact: \`${path.basename(compactPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Capsule Gates',
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
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Capsule Checklist',
  '',
  ...capsuleChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(capsule === 'ready-for-major-release-capsule'
    ? [
        '1. Treat this capsule artifact as the final immutable capsule before the first `pnpm release:ship major` run.',
        '2. Record the capsule custodian and capsule observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, compact gate, or major ship command changes, regenerate the compact and capsule artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed capsule gates are corrected.',
        '2. Regenerate the compact and capsule artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  capsule,
  currentVersion: compact.currentVersion,
  currentTag: compact.currentTag,
  nextVersion: compact.nextVersion,
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
  gateChecks,
  validationCommands,
  shipCommands,
  capsuleChecklist,
  sources: {
    compact: compactPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (capsule !== 'ready-for-major-release-capsule') {
  console.error('One Point Zero major release capsule failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release capsule written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
