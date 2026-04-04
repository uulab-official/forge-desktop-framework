#!/bin/bash
set -euo pipefail

OMNIBUS_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$OMNIBUS_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-digest.sh <one-point-zero-major-release-omnibus.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$OMNIBUS_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-digest.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-digest.json"

node - "$OMNIBUS_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [omnibusPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const omnibus = JSON.parse(fs.readFileSync(omnibusPath, 'utf8'));
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
const officialPresets = Array.isArray(omnibus.officialPresets) ? omnibus.officialPresets : [];

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
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(omnibus[key]) ? omnibus[key] : []]),
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
];

const gateChecks = [
  { name: 'major release omnibus remains ready for final digest', passed: omnibus.omnibus === 'ready-for-major-release-omnibus' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && omnibus.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'omnibus still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(omnibus.validationCommands) &&
      requiredValidation.every((command) => omnibus.validationCommands.includes(command)) &&
      omnibus.validationCommands.includes('pnpm release:major:omnibus:test') &&
      Array.isArray(omnibus.shipCommands) &&
      omnibus.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the digest surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const digest = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-digest' : 'hold';
const validationCommands = Array.isArray(omnibus.validationCommands)
  ? [...omnibus.validationCommands, 'pnpm release:major:digest:test']
  : ['pnpm release:major:digest:test'];
const shipCommands = Array.isArray(omnibus.shipCommands) ? omnibus.shipCommands : [];
const digestOwners = [
  { role: 'major-release-digest-curator', status: 'pending' },
  { role: 'major-release-digest-auditor', status: 'pending' },
];
const digestChecklist = [
  'Confirm the prepared v1.0.0 checklist, omnibus artifact, and digest artifact still describe the same first-major-release scope.',
  'Run the full execution-through-omnibus validation stack plus the digest validation before attempting the first pnpm release:ship major invocation.',
  'Record the digest curator and digest auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Digest',
  '',
  `- Digest: \`${digest}\``,
  `- Current Version: \`${omnibus.currentVersion}\``,
  `- Current Tag: \`${omnibus.currentTag}\``,
  `- Next Version: \`${omnibus.nextVersion}\``,
  `- Omnibus Artifact: \`${path.basename(omnibusPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Digest Gates',
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
  ...ownerSection('Digest Owners', digestOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Digest Checklist',
  '',
  ...digestChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(digest === 'ready-for-major-release-digest'
    ? [
        '1. Treat this digest artifact as the final immutable digest before the first `pnpm release:ship major` run.',
        '2. Record the digest curator and digest auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, omnibus gate, or major ship command changes, regenerate the omnibus and digest artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed digest gates are corrected.',
        '2. Regenerate the omnibus and digest artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  digest,
  currentVersion: omnibus.currentVersion,
  currentTag: omnibus.currentTag,
  nextVersion: omnibus.nextVersion,
  officialPresets,
  ...ownerCollections,
  digestOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  digestChecklist,
  sources: {
    omnibus: omnibusPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (digest !== 'ready-for-major-release-digest') {
  console.error('One Point Zero major release digest is not ready.');
  process.exit(1);
}
NODE

echo "One Point Zero major release digest written to $OUTPUT_MD and $OUTPUT_JSON"
