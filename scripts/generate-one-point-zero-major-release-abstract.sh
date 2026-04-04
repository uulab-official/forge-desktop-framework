#!/bin/bash
set -euo pipefail

BRIEF_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$BRIEF_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-abstract.sh <one-point-zero-major-release-brief.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$BRIEF_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-abstract.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-abstract.json"

node - "$BRIEF_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [briefPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
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
const officialPresets = Array.isArray(brief.officialPresets) ? brief.officialPresets : [];

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
  'omnibusOwners',
  'digestOwners',
  'synopsisOwners',
  'briefOwners',
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(brief[key]) ? brief[key] : []]),
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
  'pnpm release:major:omnibus:test',
  'pnpm release:major:digest:test',
  'pnpm release:major:synopsis:test',
  'pnpm release:major:brief:test',
];

const gateChecks = [
  { name: 'major release brief remains ready for final abstract', passed: brief.brief === 'ready-for-major-release-brief' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && brief.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'brief still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(brief.validationCommands) &&
      requiredValidation.every((command) => brief.validationCommands.includes(command)) &&
      brief.validationCommands.includes('pnpm release:major:brief:test') &&
      Array.isArray(brief.shipCommands) &&
      brief.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the abstract surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const abstract = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-abstract' : 'hold';
const validationCommands = Array.isArray(brief.validationCommands)
  ? [...brief.validationCommands, 'pnpm release:major:abstract:test']
  : ['pnpm release:major:abstract:test'];
const shipCommands = Array.isArray(brief.shipCommands) ? brief.shipCommands : [];
const abstractOwners = [
  { role: 'major-release-abstract-curator', status: 'pending' },
  { role: 'major-release-abstract-auditor', status: 'pending' },
];
const abstractChecklist = [
  'Confirm the prepared v1.0.0 checklist, brief artifact, and abstract artifact still describe the same first-major-release scope.',
  'Run the full execution-through-brief validation stack plus the abstract validation before attempting the first pnpm release:ship major invocation.',
  'Record the abstract curator and abstract auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Abstract',
  '',
  `- Abstract: \`${abstract}\``,
  `- Current Version: \`${brief.currentVersion}\``,
  `- Current Tag: \`${brief.currentTag}\``,
  `- Next Version: \`${brief.nextVersion}\``,
  `- Brief Artifact: \`${path.basename(briefPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Abstract Gates',
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
  ...ownerSection('Abstract Owners', abstractOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Abstract Checklist',
  '',
  ...abstractChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(abstract === 'ready-for-major-release-abstract'
    ? [
        '1. Treat this abstract artifact as the final immutable abstract before the first `pnpm release:ship major` run.',
        '2. Record the abstract curator and abstract auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, brief gate, or major ship command changes, regenerate the brief and abstract artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed abstract gates are corrected.',
        '2. Regenerate the brief and abstract artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  abstract,
  currentVersion: brief.currentVersion,
  currentTag: brief.currentTag,
  nextVersion: brief.nextVersion,
  officialPresets,
  ...ownerCollections,
  abstractOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  abstractChecklist,
  sources: {
    brief: briefPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (abstract !== 'ready-for-major-release-abstract') {
  console.error('One Point Zero major release abstract is not ready.');
  process.exit(1);
}
NODE

echo "One Point Zero major release abstract written to $OUTPUT_MD and $OUTPUT_JSON"
