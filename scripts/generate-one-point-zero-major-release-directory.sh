#!/bin/bash
set -euo pipefail

REGISTRY_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$REGISTRY_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-directory.sh <one-point-zero-major-release-registry.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$REGISTRY_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-directory.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-directory.json"

node - "$REGISTRY_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [registryPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
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
const officialPresets = Array.isArray(registry.officialPresets) ? registry.officialPresets : [];

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
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(registry[key]) ? registry[key] : []]),
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
];

const gateChecks = [
  { name: 'major release registry remains ready for final directory', passed: registry.registry === 'ready-for-major-release-registry' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && registry.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'registry still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(registry.validationCommands) &&
      requiredValidation.every((command) => registry.validationCommands.includes(command)) &&
      registry.validationCommands.includes('pnpm release:major:registry:test') &&
      Array.isArray(registry.shipCommands) &&
      registry.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the directory surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const directory = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-directory' : 'hold';
const validationCommands = Array.isArray(registry.validationCommands)
  ? [...registry.validationCommands, 'pnpm release:major:directory:test']
  : ['pnpm release:major:directory:test'];
const shipCommands = Array.isArray(registry.shipCommands) ? registry.shipCommands : [];
const directoryOwners = [
  { role: 'major-release-directory-custodian', status: 'pending' },
  { role: 'major-release-directory-auditor', status: 'pending' },
];
const directoryChecklist = [
  'Confirm the prepared v1.0.0 checklist, registry artifact, and directory artifact still describe the same first-major-release scope.',
  'Run the full execution-through-registry validation stack plus the directory validation before attempting the first pnpm release:ship major invocation.',
  'Record the directory custodian and directory auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Directory',
  '',
  `- Directory: \`${directory}\``,
  `- Current Version: \`${registry.currentVersion}\``,
  `- Current Tag: \`${registry.currentTag}\``,
  `- Next Version: \`${registry.nextVersion}\``,
  `- Registry Artifact: \`${path.basename(registryPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Directory Gates',
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
  ...ownerSection('Directory Owners', directoryOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Directory Checklist',
  '',
  ...directoryChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(directory === 'ready-for-major-release-directory'
    ? [
        '1. Treat this directory artifact as the final immutable directory before the first `pnpm release:ship major` run.',
        '2. Record the directory custodian and directory auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, registry gate, or major ship command changes, regenerate the registry and directory artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed directory gates are corrected.',
        '2. Regenerate the registry and directory artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  directory,
  currentVersion: registry.currentVersion,
  currentTag: registry.currentTag,
  nextVersion: registry.nextVersion,
  officialPresets,
  ...ownerCollections,
  directoryOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  directoryChecklist,
  sources: {
    registry: registryPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (directory !== 'ready-for-major-release-directory') {
  process.exit(1);
}
NODE

echo "One Point Zero major release directory written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
