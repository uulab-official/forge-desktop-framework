#!/bin/bash
set -euo pipefail

ANTHOLOGY_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$ANTHOLOGY_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-omnibus.sh <one-point-zero-major-release-anthology.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$ANTHOLOGY_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-omnibus.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-omnibus.json"

node - "$ANTHOLOGY_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [anthologyPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const anthology = JSON.parse(fs.readFileSync(anthologyPath, 'utf8'));
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
const officialPresets = Array.isArray(anthology.officialPresets) ? anthology.officialPresets : [];

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
  'anthologyOwners',
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(anthology[key]) ? anthology[key] : []]),
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
  'pnpm release:major:anthology:test',
];

const gateChecks = [
  { name: 'major release anthology remains ready for final omnibus', passed: anthology.anthology === 'ready-for-major-release-anthology' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && anthology.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'anthology still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(anthology.validationCommands) &&
      requiredValidation.every((command) => anthology.validationCommands.includes(command)) &&
      anthology.validationCommands.includes('pnpm release:major:anthology:test') &&
      Array.isArray(anthology.shipCommands) &&
      anthology.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the omnibus surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const omnibus = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-omnibus' : 'hold';
const validationCommands = Array.isArray(anthology.validationCommands)
  ? [...anthology.validationCommands, 'pnpm release:major:omnibus:test']
  : ['pnpm release:major:omnibus:test'];
const shipCommands = Array.isArray(anthology.shipCommands) ? anthology.shipCommands : [];
const omnibusOwners = [
  { role: 'major-release-omnibus-curator', status: 'pending' },
  { role: 'major-release-omnibus-auditor', status: 'pending' },
];
const omnibusChecklist = [
  'Confirm the prepared v1.0.0 checklist, anthology artifact, and omnibus artifact still describe the same first-major-release scope.',
  'Run the full execution-through-anthology validation stack plus the omnibus validation before attempting the first pnpm release:ship major invocation.',
  'Record the omnibus curator and omnibus auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Omnibus',
  '',
  `- Omnibus: \`${omnibus}\``,
  `- Current Version: \`${anthology.currentVersion}\``,
  `- Current Tag: \`${anthology.currentTag}\``,
  `- Next Version: \`${anthology.nextVersion}\``,
  `- Anthology Artifact: \`${path.basename(anthologyPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Omnibus Gates',
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
  ...ownerSection('Omnibus Owners', omnibusOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Omnibus Checklist',
  '',
  ...omnibusChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(omnibus === 'ready-for-major-release-omnibus'
    ? [
        '1. Treat this omnibus artifact as the final immutable omnibus before the first `pnpm release:ship major` run.',
        '2. Record the omnibus curator and omnibus auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, anthology gate, or major ship command changes, regenerate the anthology and omnibus artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed omnibus gates are corrected.',
        '2. Regenerate the anthology and omnibus artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  omnibus,
  currentVersion: anthology.currentVersion,
  currentTag: anthology.currentTag,
  nextVersion: anthology.nextVersion,
  officialPresets,
  ...ownerCollections,
  omnibusOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  omnibusChecklist,
  sources: {
    anthology: anthologyPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (omnibus !== 'ready-for-major-release-omnibus') {
  console.error('One Point Zero major release omnibus is not ready.');
  process.exit(1);
}
NODE

echo "One Point Zero major release omnibus written to $OUTPUT_MD and $OUTPUT_JSON"
