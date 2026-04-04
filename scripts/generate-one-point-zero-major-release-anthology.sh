#!/bin/bash
set -euo pipefail

COMPENDIUM_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$COMPENDIUM_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-anthology.sh <one-point-zero-major-release-compendium.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$COMPENDIUM_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-anthology.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-anthology.json"

node - "$COMPENDIUM_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [compendiumPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const compendium = JSON.parse(fs.readFileSync(compendiumPath, 'utf8'));
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
const officialPresets = Array.isArray(compendium.officialPresets) ? compendium.officialPresets : [];

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
  'folioOwners',
  'portfolioOwners',
  'compendiumOwners',
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(compendium[key]) ? compendium[key] : []]),
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
  'pnpm release:major:folio:test',
  'pnpm release:major:portfolio:test',
  'pnpm release:major:compendium:test',
];

const gateChecks = [
  { name: 'major release compendium remains ready for final anthology', passed: compendium.compendium === 'ready-for-major-release-compendium' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && compendium.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'compendium still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(compendium.validationCommands) &&
      requiredValidation.every((command) => compendium.validationCommands.includes(command)) &&
      compendium.validationCommands.includes('pnpm release:major:compendium:test') &&
      Array.isArray(compendium.shipCommands) &&
      compendium.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the anthology surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const anthology = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-anthology' : 'hold';
const validationCommands = Array.isArray(compendium.validationCommands)
  ? [...compendium.validationCommands, 'pnpm release:major:anthology:test']
  : ['pnpm release:major:anthology:test'];
const shipCommands = Array.isArray(compendium.shipCommands) ? compendium.shipCommands : [];
const anthologyOwners = [
  { role: 'major-release-anthology-curator', status: 'pending' },
  { role: 'major-release-anthology-auditor', status: 'pending' },
];
const anthologyChecklist = [
  'Confirm the prepared v1.0.0 checklist, compendium artifact, and anthology artifact still describe the same first-major-release scope.',
  'Run the full execution-through-compendium validation stack plus the anthology validation before attempting the first pnpm release:ship major invocation.',
  'Record the anthology curator and anthology auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Anthology',
  '',
  `- Anthology: \`${anthology}\``,
  `- Current Version: \`${compendium.currentVersion}\``,
  `- Current Tag: \`${compendium.currentTag}\``,
  `- Next Version: \`${compendium.nextVersion}\``,
  `- Compendium Artifact: \`${path.basename(compendiumPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Anthology Gates',
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
  ...ownerSection('Anthology Owners', anthologyOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Anthology Checklist',
  '',
  ...anthologyChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(anthology === 'ready-for-major-release-anthology'
    ? [
        '1. Treat this anthology artifact as the final immutable anthology before the first `pnpm release:ship major` run.',
        '2. Record the anthology curator and anthology auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, compendium gate, or major ship command changes, regenerate the compendium and anthology artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed anthology gates are corrected.',
        '2. Regenerate the compendium and anthology artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  anthology,
  currentVersion: compendium.currentVersion,
  currentTag: compendium.currentTag,
  nextVersion: compendium.nextVersion,
  officialPresets,
  ...ownerCollections,
  anthologyOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  anthologyChecklist,
  sources: {
    compendium: compendiumPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (anthology !== 'ready-for-major-release-anthology') {
  console.error('One Point Zero major release anthology is not ready.');
  process.exit(1);
}
NODE

echo "One Point Zero major release anthology written to $OUTPUT_MD and $OUTPUT_JSON"
