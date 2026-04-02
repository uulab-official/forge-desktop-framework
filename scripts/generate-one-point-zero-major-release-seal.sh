#!/bin/bash
set -euo pipefail

ATTESTATION_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$ATTESTATION_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-seal.sh <one-point-zero-major-release-attestation.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$ATTESTATION_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-seal.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-seal.json"

node - "$ATTESTATION_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [attestationPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const attestation = JSON.parse(fs.readFileSync(attestationPath, 'utf8'));
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
const officialPresets = Array.isArray(attestation.officialPresets) ? attestation.officialPresets : [];
const attestationOwners = Array.isArray(attestation.attestationOwners) ? attestation.attestationOwners : [];
const executionOwners = Array.isArray(attestation.executionOwners) ? attestation.executionOwners : [];
const activationOwners = Array.isArray(attestation.activationOwners) ? attestation.activationOwners : [];

const gateChecks = [
  {
    name: 'major release attestation remains ready for final seal',
    passed: attestation.attestation === 'ready-for-major-release-attestation',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && attestation.nextVersion === '1.0.0',
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
    name: 'attestation still includes execution and attestation validation',
    passed:
      Array.isArray(attestation.validationCommands) &&
      attestation.validationCommands.includes('pnpm release:major:execution:test') &&
      attestation.validationCommands.includes('pnpm release:major:attestation:test'),
  },
  {
    name: 'attestation still includes explicit major ship command',
    passed: Array.isArray(attestation.shipCommands) && attestation.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'attestation owners remain attached to the seal surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the seal surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the seal surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const seal = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-seal' : 'hold';
const validationCommands = Array.isArray(attestation.validationCommands)
  ? [...attestation.validationCommands, 'pnpm release:major:seal:test']
  : ['pnpm release:major:seal:test'];
const shipCommands = Array.isArray(attestation.shipCommands) ? attestation.shipCommands : [];
const sealOwners = [
  { role: 'major-release-sealer', status: 'pending' },
  { role: 'major-release-seal-observer', status: 'pending' },
];
const sealChecklist = [
  'Confirm the prepared v1.0.0 checklist still matches the first major ship scope and remains ready.',
  'Run the execution, attestation, and seal validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the sealer and seal observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Seal',
  '',
  `- Seal: \`${seal}\``,
  `- Current Version: \`${attestation.currentVersion}\``,
  `- Current Tag: \`${attestation.currentTag}\``,
  `- Next Version: \`${attestation.nextVersion}\``,
  `- Attestation Artifact: \`${path.basename(attestationPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Seal Gates',
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
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Seal Checklist',
  '',
  ...sealChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(seal === 'ready-for-major-release-seal'
    ? [
        '1. Treat this seal artifact as the final immutable seal before the first `pnpm release:ship major` run.',
        '2. Record the sealer and seal observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, attestation gate, or major ship command changes, regenerate the attestation and seal artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed seal gates are corrected.',
        '2. Regenerate the attestation and seal artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  seal,
  currentVersion: attestation.currentVersion,
  currentTag: attestation.currentTag,
  nextVersion: attestation.nextVersion,
  officialPresets,
  activationOwners,
  executionOwners,
  attestationOwners,
  sealOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  sealChecklist,
  sources: {
    attestation: attestationPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (seal !== 'ready-for-major-release-seal') {
  console.error('One Point Zero major release seal failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release seal written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
