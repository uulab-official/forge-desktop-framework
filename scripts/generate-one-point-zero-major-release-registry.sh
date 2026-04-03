#!/bin/bash
set -euo pipefail

VAULT_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$VAULT_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-registry.sh <one-point-zero-major-release-vault.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$VAULT_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-registry.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-registry.json"

node - "$VAULT_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [vaultPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
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
const officialPresets = Array.isArray(vault.officialPresets) ? vault.officialPresets : [];

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
];

const ownerCollections = Object.fromEntries(
  ownerKeys.map((key) => [key, Array.isArray(vault[key]) ? vault[key] : []]),
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
];

const gateChecks = [
  { name: 'major release vault remains ready for final registry', passed: vault.vault === 'ready-for-major-release-vault' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && vault.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'vault still includes explicit major validation stack and ship command',
    passed:
      Array.isArray(vault.validationCommands) &&
      requiredValidation.every((command) => vault.validationCommands.includes(command)) &&
      vault.validationCommands.includes('pnpm release:major:vault:test') &&
      Array.isArray(vault.shipCommands) &&
      vault.shipCommands.includes('pnpm release:ship major'),
  },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
  ...ownerKeys.map((key) => ({
    name: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} remain attached to the registry surface`,
    passed: ownerCollections[key].length > 0,
  })),
];

const registry = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-registry' : 'hold';
const validationCommands = Array.isArray(vault.validationCommands)
  ? [...vault.validationCommands, 'pnpm release:major:registry:test']
  : ['pnpm release:major:registry:test'];
const shipCommands = Array.isArray(vault.shipCommands) ? vault.shipCommands : [];
const registryOwners = [
  { role: 'major-release-registry-curator', status: 'pending' },
  { role: 'major-release-registry-auditor', status: 'pending' },
];
const registryChecklist = [
  'Confirm the prepared v1.0.0 checklist, vault artifact, and registry artifact still describe the same first-major-release scope.',
  'Run the full execution-through-vault validation stack plus the registry validation before attempting the first pnpm release:ship major invocation.',
  'Record the registry curator and registry auditor statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Registry',
  '',
  `- Registry: \`${registry}\``,
  `- Current Version: \`${vault.currentVersion}\``,
  `- Current Tag: \`${vault.currentTag}\``,
  `- Next Version: \`${vault.nextVersion}\``,
  `- Vault Artifact: \`${path.basename(vaultPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Registry Gates',
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
  ...ownerKeys.flatMap((key) => ownerSection(
    key.replace(/Owners$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()) + ' Owners',
    ownerCollections[key],
  )),
  ...ownerSection('Registry Owners', registryOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Registry Checklist',
  '',
  ...registryChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(registry === 'ready-for-major-release-registry'
    ? [
        '1. Treat this registry artifact as the final immutable registry before the first `pnpm release:ship major` run.',
        '2. Record the registry curator and registry auditor statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, vault gate, or major ship command changes, regenerate the vault and registry artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed registry gates are corrected.',
        '2. Regenerate the vault and registry artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  registry,
  currentVersion: vault.currentVersion,
  currentTag: vault.currentTag,
  nextVersion: vault.nextVersion,
  officialPresets,
  ...ownerCollections,
  registryOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  registryChecklist,
  sources: {
    vault: vaultPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (registry !== 'ready-for-major-release-registry') {
  process.exit(1);
}
NODE

echo "One Point Zero major release registry written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
