#!/bin/bash
set -euo pipefail

DIGEST_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$DIGEST_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-synopsis.sh <one-point-zero-major-release-digest.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$DIGEST_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-synopsis.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-synopsis.json"

node - "$DIGEST_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [digestPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const digest = JSON.parse(fs.readFileSync(digestPath, 'utf8'));
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
const officialPresets = Array.isArray(digest.officialPresets) ? digest.officialPresets : [];

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
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(digest[key]) ? digest[key] : []]),
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
];

const gateChecks = [
  { name: 'major release digest remains ready for final synopsis', passed: digest.digest === 'ready-for-major-release-digest' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && digest.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'digest still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(digest.validationCommands) &&
      requiredValidation.every((command) => digest.validationCommands.includes(command)) &&
      digest.validationCommands.includes('pnpm release:major:digest:test') &&
      Array.isArray(digest.shipCommands) &&
      digest.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the synopsis surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const synopsis = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-synopsis' : 'hold';
const validationCommands = Array.isArray(digest.validationCommands)
  ? [...digest.validationCommands, 'pnpm release:major:synopsis:test']
  : ['pnpm release:major:synopsis:test'];
const shipCommands = Array.isArray(digest.shipCommands) ? digest.shipCommands : [];
const synopsisOwners = [
  { role: 'major-release-synopsis-curator', status: 'pending' },
  { role: 'major-release-synopsis-auditor', status: 'pending' },
];
const synopsisChecklist = [
  'Confirm the prepared v1.0.0 checklist, digest artifact, and synopsis artifact still describe the same first-major-release scope.',
  'Run the full execution-through-digest validation stack plus the synopsis validation before attempting the first pnpm release:ship major invocation.',
  'Record the synopsis curator and synopsis auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Synopsis',
  '',
  `- Synopsis: \`${synopsis}\``,
  `- Current Version: \`${digest.currentVersion}\``,
  `- Current Tag: \`${digest.currentTag}\``,
  `- Next Version: \`${digest.nextVersion}\``,
  `- Digest Artifact: \`${path.basename(digestPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Synopsis Gates',
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
  ...ownerSection('Synopsis Owners', synopsisOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Synopsis Checklist',
  '',
  ...synopsisChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(synopsis === 'ready-for-major-release-synopsis'
    ? [
        '1. Treat this synopsis artifact as the final immutable synopsis before the first `pnpm release:ship major` run.',
        '2. Record the synopsis curator and synopsis auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, digest gate, or major ship command changes, regenerate the digest and synopsis artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed synopsis gates are corrected.',
        '2. Regenerate the digest and synopsis artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  synopsis,
  currentVersion: digest.currentVersion,
  currentTag: digest.currentTag,
  nextVersion: digest.nextVersion,
  officialPresets,
  ...ownerCollections,
  synopsisOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  synopsisChecklist,
  sources: {
    digest: digestPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (synopsis !== 'ready-for-major-release-synopsis') {
  console.error('One Point Zero major release synopsis is not ready.');
  process.exit(1);
}
NODE

echo "One Point Zero major release synopsis written to $OUTPUT_MD and $OUTPUT_JSON"
