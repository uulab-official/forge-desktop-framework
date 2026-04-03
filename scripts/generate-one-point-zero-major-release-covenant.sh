#!/bin/bash
set -euo pipefail

CONSTITUTION_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$CONSTITUTION_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-covenant.sh <one-point-zero-major-release-constitution.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$CONSTITUTION_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-covenant.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-covenant.json"

node - "$CONSTITUTION_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [constitutionPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const constitution = JSON.parse(fs.readFileSync(constitutionPath, 'utf8'));
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
const officialPresets = Array.isArray(constitution.officialPresets) ? constitution.officialPresets : [];
const activationOwners = Array.isArray(constitution.activationOwners) ? constitution.activationOwners : [];
const executionOwners = Array.isArray(constitution.executionOwners) ? constitution.executionOwners : [];
const attestationOwners = Array.isArray(constitution.attestationOwners) ? constitution.attestationOwners : [];
const sealOwners = Array.isArray(constitution.sealOwners) ? constitution.sealOwners : [];
const charterOwners = Array.isArray(constitution.charterOwners) ? constitution.charterOwners : [];
const canonOwners = Array.isArray(constitution.canonOwners) ? constitution.canonOwners : [];
const constitutionOwners = Array.isArray(constitution.constitutionOwners) ? constitution.constitutionOwners : [];

const gateChecks = [
  {
    name: 'major release constitution remains ready for final covenant',
    passed: constitution.constitution === 'ready-for-major-release-constitution',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && constitution.nextVersion === '1.0.0',
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
    name: 'constitution still includes execution, attestation, seal, charter, canon, and constitution validation',
    passed:
      Array.isArray(constitution.validationCommands) &&
      constitution.validationCommands.includes('pnpm release:major:execution:test') &&
      constitution.validationCommands.includes('pnpm release:major:attestation:test') &&
      constitution.validationCommands.includes('pnpm release:major:seal:test') &&
      constitution.validationCommands.includes('pnpm release:major:charter:test') &&
      constitution.validationCommands.includes('pnpm release:major:canon:test') &&
      constitution.validationCommands.includes('pnpm release:major:constitution:test'),
  },
  {
    name: 'constitution still includes explicit major ship command',
    passed: Array.isArray(constitution.shipCommands) && constitution.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'constitution owners remain attached to the covenant surface',
    passed: constitutionOwners.length > 0,
  },
  {
    name: 'canon owners remain attached to the covenant surface',
    passed: canonOwners.length > 0,
  },
  {
    name: 'charter owners remain attached to the covenant surface',
    passed: charterOwners.length > 0,
  },
  {
    name: 'seal owners remain attached to the covenant surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the covenant surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the covenant surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the covenant surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const covenant = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-covenant' : 'hold';
const validationCommands = Array.isArray(constitution.validationCommands)
  ? [...constitution.validationCommands, 'pnpm release:major:covenant:test']
  : ['pnpm release:major:covenant:test'];
const shipCommands = Array.isArray(constitution.shipCommands) ? constitution.shipCommands : [];
const covenantOwners = [
  { role: 'major-release-covenant-custodian', status: 'pending' },
  { role: 'major-release-covenant-observer', status: 'pending' },
];
const covenantChecklist = [
  'Confirm the prepared v1.0.0 checklist, constitution artifact, and covenant artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, canon, constitution, and covenant validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the covenant custodian and covenant observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Covenant',
  '',
  `- Covenant: \`${covenant}\``,
  `- Current Version: \`${constitution.currentVersion}\``,
  `- Current Tag: \`${constitution.currentTag}\``,
  `- Next Version: \`${constitution.nextVersion}\``,
  `- Constitution Artifact: \`${path.basename(constitutionPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Covenant Gates',
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
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Covenant Checklist',
  '',
  ...covenantChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(covenant === 'ready-for-major-release-covenant'
    ? [
        '1. Treat this covenant artifact as the final immutable covenant before the first `pnpm release:ship major` run.',
        '2. Record the covenant custodian and covenant observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, constitution gate, or major ship command changes, regenerate the constitution and covenant artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed covenant gates are corrected.',
        '2. Regenerate the constitution and covenant artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  covenant,
  currentVersion: constitution.currentVersion,
  currentTag: constitution.currentTag,
  nextVersion: constitution.nextVersion,
  officialPresets,
  activationOwners,
  executionOwners,
  attestationOwners,
  sealOwners,
  charterOwners,
  canonOwners,
  constitutionOwners,
  covenantOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  covenantChecklist,
  sources: {
    constitution: constitutionPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (covenant !== 'ready-for-major-release-covenant') {
  console.error('One Point Zero major release covenant failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release covenant written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
