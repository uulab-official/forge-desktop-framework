#!/bin/bash
set -euo pipefail

DOSSIER_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$DOSSIER_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-folio.sh <one-point-zero-major-release-dossier.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$DOSSIER_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-folio.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-folio.json"

node - "$DOSSIER_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [dossierPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const dossier = JSON.parse(fs.readFileSync(dossierPath, 'utf8'));
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
const officialPresets = Array.isArray(dossier.officialPresets) ? dossier.officialPresets : [];

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
  'dossierOwners',
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(dossier[key]) ? dossier[key] : []]),
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
  'pnpm release:major:dossier:test',
];

const gateChecks = [
  { name: 'major release dossier remains ready for final folio', passed: dossier.dossier === 'ready-for-major-release-dossier' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && dossier.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'dossier still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(dossier.validationCommands) &&
      requiredValidation.every((command) => dossier.validationCommands.includes(command)) &&
      dossier.validationCommands.includes('pnpm release:major:dossier:test') &&
      Array.isArray(dossier.shipCommands) &&
      dossier.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the folio surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const folio = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-folio' : 'hold';
const validationCommands = Array.isArray(dossier.validationCommands)
  ? [...dossier.validationCommands, 'pnpm release:major:folio:test']
  : ['pnpm release:major:folio:test'];
const shipCommands = Array.isArray(dossier.shipCommands) ? dossier.shipCommands : [];
const folioOwners = [
  { role: 'major-release-folio-curator', status: 'pending' },
  { role: 'major-release-folio-auditor', status: 'pending' },
];
const folioChecklist = [
  'Confirm the prepared v1.0.0 checklist, dossier artifact, and folio artifact still describe the same first-major-release scope.',
  'Run the full execution-through-dossier validation stack plus the folio validation before attempting the first pnpm release:ship major invocation.',
  'Record the folio curator and folio auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Folio',
  '',
  `- Folio: \`${folio}\``,
  `- Current Version: \`${dossier.currentVersion}\``,
  `- Current Tag: \`${dossier.currentTag}\``,
  `- Next Version: \`${dossier.nextVersion}\``,
  `- Dossier Artifact: \`${path.basename(dossierPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Folio Gates',
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
  ...ownerSection('Folio Owners', folioOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Folio Checklist',
  '',
  ...folioChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(folio === 'ready-for-major-release-folio'
    ? [
        '1. Treat this folio artifact as the final immutable folio before the first `pnpm release:ship major` run.',
        '2. Record the folio curator and folio auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, dossier gate, or major ship command changes, regenerate the dossier and folio artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed folio gates are corrected.',
        '2. Regenerate the dossier and folio artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  folio,
  currentVersion: dossier.currentVersion,
  currentTag: dossier.currentTag,
  nextVersion: dossier.nextVersion,
  officialPresets,
  ...ownerCollections,
  folioOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  folioChecklist,
  sources: {
    dossier: dossierPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (folio !== 'ready-for-major-release-folio') {
  process.exit(1);
}
NODE

echo "One Point Zero major release folio written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
