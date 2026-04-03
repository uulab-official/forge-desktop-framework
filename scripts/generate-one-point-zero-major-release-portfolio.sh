#!/bin/bash
set -euo pipefail

FOLIO_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$FOLIO_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-portfolio.sh <one-point-zero-major-release-folio.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$FOLIO_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-portfolio.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-portfolio.json"

node - "$FOLIO_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [folioPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const folio = JSON.parse(fs.readFileSync(folioPath, 'utf8'));
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
const officialPresets = Array.isArray(folio.officialPresets) ? folio.officialPresets : [];

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
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(folio[key]) ? folio[key] : []]),
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
];

const gateChecks = [
  { name: 'major release folio remains ready for final portfolio', passed: folio.folio === 'ready-for-major-release-folio' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && folio.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'folio still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(folio.validationCommands) &&
      requiredValidation.every((command) => folio.validationCommands.includes(command)) &&
      folio.validationCommands.includes('pnpm release:major:folio:test') &&
      Array.isArray(folio.shipCommands) &&
      folio.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the portfolio surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const portfolio = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-portfolio' : 'hold';
const validationCommands = Array.isArray(folio.validationCommands)
  ? [...folio.validationCommands, 'pnpm release:major:portfolio:test']
  : ['pnpm release:major:portfolio:test'];
const shipCommands = Array.isArray(folio.shipCommands) ? folio.shipCommands : [];
const portfolioOwners = [
  { role: 'major-release-portfolio-curator', status: 'pending' },
  { role: 'major-release-portfolio-auditor', status: 'pending' },
];
const portfolioChecklist = [
  'Confirm the prepared v1.0.0 checklist, folio artifact, and portfolio artifact still describe the same first-major-release scope.',
  'Run the full execution-through-folio validation stack plus the portfolio validation before attempting the first pnpm release:ship major invocation.',
  'Record the portfolio curator and portfolio auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Portfolio',
  '',
  `- Portfolio: \`${portfolio}\``,
  `- Current Version: \`${folio.currentVersion}\``,
  `- Current Tag: \`${folio.currentTag}\``,
  `- Next Version: \`${folio.nextVersion}\``,
  `- Folio Artifact: \`${path.basename(folioPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Portfolio Gates',
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
  ...ownerSection('Portfolio Owners', portfolioOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Portfolio Checklist',
  '',
  ...portfolioChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(portfolio === 'ready-for-major-release-portfolio'
    ? [
        '1. Treat this portfolio artifact as the final immutable portfolio before the first `pnpm release:ship major` run.',
        '2. Record the portfolio curator and portfolio auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, folio gate, or major ship command changes, regenerate the folio and portfolio artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed portfolio gates are corrected.',
        '2. Regenerate the folio and portfolio artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  portfolio,
  currentVersion: folio.currentVersion,
  currentTag: folio.currentTag,
  nextVersion: folio.nextVersion,
  officialPresets,
  ...ownerCollections,
  portfolioOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  portfolioChecklist,
  sources: {
    folio: folioPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (portfolio !== 'ready-for-major-release-portfolio') {
  process.exit(1);
}
NODE

echo "One Point Zero major release portfolio written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
