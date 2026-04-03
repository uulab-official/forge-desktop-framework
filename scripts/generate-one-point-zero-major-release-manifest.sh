#!/bin/bash
set -euo pipefail

DIRECTORY_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$DIRECTORY_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-manifest.sh <one-point-zero-major-release-directory.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$DIRECTORY_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-manifest.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-manifest.json"

node - "$DIRECTORY_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [directoryPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const directory = JSON.parse(fs.readFileSync(directoryPath, 'utf8'));
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
const officialPresets = Array.isArray(directory.officialPresets) ? directory.officialPresets : [];

const ownerKeys = [
  'activationOwners',
  'executionOwners',
  'attestationOwners',
  'sealOwners',
  'charterOwners',
  'canonOwners',
  'constitutionOwners',
  'covenantOwners',
  'compactOwners',
  'capsuleOwners',
  'ledgerOwners',
  'archiveOwners',
  'vaultOwners',
  'registryOwners',
  'directoryOwners',
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(directory[key]) ? directory[key] : []]),
);

const requiredValidation = [
  'pnpm release:major:execution:test',
  'pnpm release:major:attestation:test',
  'pnpm release:major:seal:test',
  'pnpm release:major:charter:test',
  'pnpm release:major:canon:test',
  'pnpm release:major:constitution:test',
  'pnpm release:major:covenant:test',
  'pnpm release:major:compact:test',
  'pnpm release:major:capsule:test',
  'pnpm release:major:ledger:test',
  'pnpm release:major:archive:test',
  'pnpm release:major:vault:test',
  'pnpm release:major:registry:test',
  'pnpm release:major:directory:test',
];

const gateChecks = [
  { name: 'major release directory remains ready for final manifest', passed: directory.directory === 'ready-for-major-release-directory' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && directory.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'directory still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(directory.validationCommands) &&
      requiredValidation.every((command) => directory.validationCommands.includes(command)) &&
      directory.validationCommands.includes('pnpm release:major:directory:test') &&
      Array.isArray(directory.shipCommands) &&
      directory.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the manifest surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const manifest = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-manifest' : 'hold';
const validationCommands = Array.isArray(directory.validationCommands)
  ? [...directory.validationCommands, 'pnpm release:major:manifest:test']
  : ['pnpm release:major:manifest:test'];
const shipCommands = Array.isArray(directory.shipCommands) ? directory.shipCommands : [];
const manifestOwners = [
  { role: 'major-release-manifest-curator', status: 'pending' },
  { role: 'major-release-manifest-auditor', status: 'pending' },
];
const manifestChecklist = [
  'Confirm the prepared v1.0.0 checklist, directory artifact, and manifest artifact still describe the same first-major-release scope.',
  'Run the full execution-through-directory validation stack plus the manifest validation before attempting the first pnpm release:ship major invocation.',
  'Record the manifest curator and manifest auditor statuses before executing the first major ship command.',
];

const ownerSection = (title, owners) => [
  `## ${title}`,
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...owners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
];

const markdown = [
  '# One Point Zero Major Release Manifest',
  '',
  `- Manifest: \`${manifest}\``,
  `- Current Version: \`${directory.currentVersion}\``,
  `- Current Tag: \`${directory.currentTag}\``,
  `- Next Version: \`${directory.nextVersion}\``,
  `- Directory Artifact: \`${path.basename(directoryPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Manifest Gates',
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
  ...ownerKeys.flatMap((key) => ownerSection(
    key.replace(/Owners$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()) + ' Owners',
    ownerCollections[key],
  )),
  ...ownerSection('Manifest Owners', manifestOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Manifest Checklist',
  '',
  ...manifestChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(manifest === 'ready-for-major-release-manifest'
    ? [
        '1. Treat this manifest artifact as the final immutable manifest before the first `pnpm release:ship major` run.',
        '2. Record the manifest curator and manifest auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, directory gate, or major ship command changes, regenerate the directory and manifest artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed manifest gates are corrected.',
        '2. Regenerate the directory and manifest artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  manifest,
  currentVersion: directory.currentVersion,
  currentTag: directory.currentTag,
  nextVersion: directory.nextVersion,
  officialPresets,
  ...ownerCollections,
  manifestOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  manifestChecklist,
  sources: {
    directory: directoryPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (manifest !== 'ready-for-major-release-manifest') {
  process.exit(1);
}
NODE

echo "One Point Zero major release manifest written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
