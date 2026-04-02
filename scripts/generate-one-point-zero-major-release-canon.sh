#!/bin/bash
set -euo pipefail

CHARTER_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$CHARTER_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-canon.sh <one-point-zero-major-release-charter.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$CHARTER_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-canon.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-canon.json"

node - "$CHARTER_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [charterPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const charter = JSON.parse(fs.readFileSync(charterPath, 'utf8'));
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
const officialPresets = Array.isArray(charter.officialPresets) ? charter.officialPresets : [];
const activationOwners = Array.isArray(charter.activationOwners) ? charter.activationOwners : [];
const executionOwners = Array.isArray(charter.executionOwners) ? charter.executionOwners : [];
const attestationOwners = Array.isArray(charter.attestationOwners) ? charter.attestationOwners : [];
const sealOwners = Array.isArray(charter.sealOwners) ? charter.sealOwners : [];
const charterOwners = Array.isArray(charter.charterOwners) ? charter.charterOwners : [];

const gateChecks = [
  {
    name: 'major release charter remains ready for final canon',
    passed: charter.charter === 'ready-for-major-release-charter',
  },
  {
    name: 'prepared checklist remains targeted at 1.0.0',
    passed: checklistVersion === '1.0.0' && charter.nextVersion === '1.0.0',
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
    name: 'charter still includes execution, attestation, seal, and charter validation',
    passed:
      Array.isArray(charter.validationCommands) &&
      charter.validationCommands.includes('pnpm release:major:execution:test') &&
      charter.validationCommands.includes('pnpm release:major:attestation:test') &&
      charter.validationCommands.includes('pnpm release:major:seal:test') &&
      charter.validationCommands.includes('pnpm release:major:charter:test'),
  },
  {
    name: 'charter still includes explicit major ship command',
    passed: Array.isArray(charter.shipCommands) && charter.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'charter owners remain attached to the canon surface',
    passed: charterOwners.length > 0,
  },
  {
    name: 'seal owners remain attached to the canon surface',
    passed: sealOwners.length > 0,
  },
  {
    name: 'attestation owners remain attached to the canon surface',
    passed: attestationOwners.length > 0,
  },
  {
    name: 'execution owners remain attached to the canon surface',
    passed: executionOwners.length > 0,
  },
  {
    name: 'activation owners remain attached to the canon surface',
    passed: activationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const canon = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-canon' : 'hold';
const validationCommands = Array.isArray(charter.validationCommands)
  ? [...charter.validationCommands, 'pnpm release:major:canon:test']
  : ['pnpm release:major:canon:test'];
const shipCommands = Array.isArray(charter.shipCommands) ? charter.shipCommands : [];
const canonOwners = [
  { role: 'major-release-canon-keeper', status: 'pending' },
  { role: 'major-release-canon-observer', status: 'pending' },
];
const canonChecklist = [
  'Confirm the prepared v1.0.0 checklist, charter artifact, and canon artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, and canon validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the canon keeper and canon observer statuses before executing the first major ship command.',
];

const markdown = [
  '# One Point Zero Major Release Canon',
  '',
  `- Canon: \`${canon}\``,
  `- Current Version: \`${charter.currentVersion}\``,
  `- Current Tag: \`${charter.currentTag}\``,
  `- Next Version: \`${charter.nextVersion}\``,
  `- Charter Artifact: \`${path.basename(charterPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Canon Gates',
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
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Canon Checklist',
  '',
  ...canonChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(canon === 'ready-for-major-release-canon'
    ? [
        '1. Treat this canon artifact as the final immutable canon before the first `pnpm release:ship major` run.',
        '2. Record the canon keeper and canon observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, charter gate, or major ship command changes, regenerate the charter and canon artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed canon gates are corrected.',
        '2. Regenerate the charter and canon artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  canon,
  currentVersion: charter.currentVersion,
  currentTag: charter.currentTag,
  nextVersion: charter.nextVersion,
  officialPresets,
  activationOwners,
  executionOwners,
  attestationOwners,
  sealOwners,
  charterOwners,
  canonOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  canonChecklist,
  sources: {
    charter: charterPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (canon !== 'ready-for-major-release-canon') {
  console.error('One Point Zero major release canon failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release canon written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
