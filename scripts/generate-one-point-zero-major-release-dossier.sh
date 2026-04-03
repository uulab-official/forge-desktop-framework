#!/bin/bash
set -euo pipefail

MANIFEST_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$MANIFEST_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-dossier.sh <one-point-zero-major-release-manifest.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$MANIFEST_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-dossier.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-dossier.json"

node - "$MANIFEST_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [manifestPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
const officialPresets = Array.isArray(manifest.officialPresets) ? manifest.officialPresets : [];

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
  'manifestOwners',
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(manifest[key]) ? manifest[key] : []]),
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
  'pnpm release:major:manifest:test',
];

const gateChecks = [
  { name: 'major release manifest remains ready for final dossier', passed: manifest.manifest === 'ready-for-major-release-manifest' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && manifest.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'manifest still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(manifest.validationCommands) &&
      requiredValidation.every((command) => manifest.validationCommands.includes(command)) &&
      manifest.validationCommands.includes('pnpm release:major:manifest:test') &&
      Array.isArray(manifest.shipCommands) &&
      manifest.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the dossier surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const dossier = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-dossier' : 'hold';
const validationCommands = Array.isArray(manifest.validationCommands)
  ? [...manifest.validationCommands, 'pnpm release:major:dossier:test']
  : ['pnpm release:major:dossier:test'];
const shipCommands = Array.isArray(manifest.shipCommands) ? manifest.shipCommands : [];
const dossierOwners = [
  { role: 'major-release-dossier-curator', status: 'pending' },
  { role: 'major-release-dossier-auditor', status: 'pending' },
];
const dossierChecklist = [
  'Confirm the prepared v1.0.0 checklist, manifest artifact, and dossier artifact still describe the same first-major-release scope.',
  'Run the full execution-through-manifest validation stack plus the dossier validation before attempting the first pnpm release:ship major invocation.',
  'Record the dossier curator and dossier auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Dossier',
  '',
  `- Dossier: \`${dossier}\``,
  `- Current Version: \`${manifest.currentVersion}\``,
  `- Current Tag: \`${manifest.currentTag}\``,
  `- Next Version: \`${manifest.nextVersion}\``,
  `- Manifest Artifact: \`${path.basename(manifestPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Dossier Gates',
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
  ...ownerKeys.flatMap((key) =>
    ownerSection(
      key.replace(/Owners$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()) + ' Owners',
      ownerCollections[key],
    ),
  ),
  ...ownerSection('Dossier Owners', dossierOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Dossier Checklist',
  '',
  ...dossierChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(dossier === 'ready-for-major-release-dossier'
    ? [
        '1. Treat this dossier artifact as the final immutable dossier before the first `pnpm release:ship major` run.',
        '2. Record the dossier curator and dossier auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, manifest gate, or major ship command changes, regenerate the manifest and dossier artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed dossier gates are corrected.',
        '2. Regenerate the manifest and dossier artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  dossier,
  currentVersion: manifest.currentVersion,
  currentTag: manifest.currentTag,
  nextVersion: manifest.nextVersion,
  officialPresets,
  ...ownerCollections,
  dossierOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  dossierChecklist,
  sources: {
    manifest: manifestPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (dossier !== 'ready-for-major-release-dossier') {
  process.exit(1);
}
NODE

echo "One Point Zero major release dossier written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
