#!/bin/bash
set -euo pipefail

SYNOPSIS_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$SYNOPSIS_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-brief.sh <one-point-zero-major-release-synopsis.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$SYNOPSIS_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-brief.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-brief.json"

node - "$SYNOPSIS_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [synopsisPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const synopsis = JSON.parse(fs.readFileSync(synopsisPath, 'utf8'));
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
const officialPresets = Array.isArray(synopsis.officialPresets) ? synopsis.officialPresets : [];

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
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(synopsis[key]) ? synopsis[key] : []]),
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
];

const gateChecks = [
  { name: 'major release synopsis remains ready for final brief', passed: synopsis.synopsis === 'ready-for-major-release-synopsis' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && synopsis.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'synopsis still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(synopsis.validationCommands) &&
      requiredValidation.every((command) => synopsis.validationCommands.includes(command)) &&
      synopsis.validationCommands.includes('pnpm release:major:synopsis:test') &&
      Array.isArray(synopsis.shipCommands) &&
      synopsis.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the brief surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const brief = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-brief' : 'hold';
const validationCommands = Array.isArray(synopsis.validationCommands)
  ? [...synopsis.validationCommands, 'pnpm release:major:brief:test']
  : ['pnpm release:major:brief:test'];
const shipCommands = Array.isArray(synopsis.shipCommands) ? synopsis.shipCommands : [];
const briefOwners = [
  { role: 'major-release-brief-curator', status: 'pending' },
  { role: 'major-release-brief-auditor', status: 'pending' },
];
const briefChecklist = [
  'Confirm the prepared v1.0.0 checklist, synopsis artifact, and brief artifact still describe the same first-major-release scope.',
  'Run the full execution-through-synopsis validation stack plus the brief validation before attempting the first pnpm release:ship major invocation.',
  'Record the brief curator and brief auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Brief',
  '',
  `- Brief: \`${brief}\``,
  `- Current Version: \`${synopsis.currentVersion}\``,
  `- Current Tag: \`${synopsis.currentTag}\``,
  `- Next Version: \`${synopsis.nextVersion}\``,
  `- Synopsis Artifact: \`${path.basename(synopsisPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Brief Gates',
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
  ...ownerSection('Brief Owners', briefOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Brief Checklist',
  '',
  ...briefChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(brief === 'ready-for-major-release-brief'
    ? [
        '1. Treat this brief artifact as the final immutable brief before the first `pnpm release:ship major` run.',
        '2. Record the brief curator and brief auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, synopsis gate, or major ship command changes, regenerate the synopsis and brief artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed brief gates are corrected.',
        '2. Regenerate the synopsis and brief artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  brief,
  currentVersion: synopsis.currentVersion,
  currentTag: synopsis.currentTag,
  nextVersion: synopsis.nextVersion,
  officialPresets,
  ...ownerCollections,
  briefOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  briefChecklist,
  sources: {
    synopsis: synopsisPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (brief !== 'ready-for-major-release-brief') {
  console.error('One Point Zero major release brief is not ready.');
  process.exit(1);
}
NODE

echo "One Point Zero major release brief written to $OUTPUT_MD and $OUTPUT_JSON"
