#!/bin/bash
set -euo pipefail

PORTFOLIO_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$PORTFOLIO_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-compendium.sh <one-point-zero-major-release-portfolio.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$PORTFOLIO_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-compendium.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-compendium.json"

node - "$PORTFOLIO_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [portfolioPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
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
const officialPresets = Array.isArray(portfolio.officialPresets) ? portfolio.officialPresets : [];

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
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(portfolio[key]) ? portfolio[key] : []]),
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
];

const gateChecks = [
  { name: 'major release portfolio remains ready for final compendium', passed: portfolio.portfolio === 'ready-for-major-release-portfolio' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && portfolio.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'portfolio still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(portfolio.validationCommands) &&
      requiredValidation.every((command) => portfolio.validationCommands.includes(command)) &&
      portfolio.validationCommands.includes('pnpm release:major:portfolio:test') &&
      Array.isArray(portfolio.shipCommands) &&
      portfolio.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the compendium surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const compendium = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-compendium' : 'hold';
const validationCommands = Array.isArray(portfolio.validationCommands)
  ? [...portfolio.validationCommands, 'pnpm release:major:compendium:test']
  : ['pnpm release:major:compendium:test'];
const shipCommands = Array.isArray(portfolio.shipCommands) ? portfolio.shipCommands : [];
const compendiumOwners = [
  { role: 'major-release-compendium-curator', status: 'pending' },
  { role: 'major-release-compendium-auditor', status: 'pending' },
];
const compendiumChecklist = [
  'Confirm the prepared v1.0.0 checklist, portfolio artifact, and compendium artifact still describe the same first-major-release scope.',
  'Run the full execution-through-portfolio validation stack plus the compendium validation before attempting the first pnpm release:ship major invocation.',
  'Record the compendium curator and compendium auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Compendium',
  '',
  `- Compendium: \`${compendium}\``,
  `- Current Version: \`${portfolio.currentVersion}\``,
  `- Current Tag: \`${portfolio.currentTag}\``,
  `- Next Version: \`${portfolio.nextVersion}\``,
  `- Portfolio Artifact: \`${path.basename(portfolioPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Compendium Gates',
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
  ...ownerSection('Compendium Owners', compendiumOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Compendium Checklist',
  '',
  ...compendiumChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(compendium === 'ready-for-major-release-compendium'
    ? [
        '1. Treat this compendium artifact as the final immutable compendium before the first `pnpm release:ship major` run.',
        '2. Record the compendium curator and compendium auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, portfolio gate, or major ship command changes, regenerate the portfolio and compendium artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed compendium gates are corrected.',
        '2. Regenerate the portfolio and compendium artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  compendium,
  currentVersion: portfolio.currentVersion,
  currentTag: portfolio.currentTag,
  nextVersion: portfolio.nextVersion,
  officialPresets,
  ...ownerCollections,
  compendiumOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  compendiumChecklist,
  sources: {
    portfolio: portfolioPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (compendium !== 'ready-for-major-release-compendium') {
  console.error('One Point Zero major release compendium is not ready.');
  process.exit(1);
}
NODE

echo "One Point Zero major release compendium written to $OUTPUT_MD and $OUTPUT_JSON"
