#!/bin/bash
set -euo pipefail

ARCHIVE_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$ARCHIVE_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-vault.sh <one-point-zero-major-release-archive.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$ARCHIVE_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-vault.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-vault.json"

node - "$ARCHIVE_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [archivePath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
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
const officialPresets = Array.isArray(archive.officialPresets) ? archive.officialPresets : [];
const activationOwners = Array.isArray(archive.activationOwners) ? archive.activationOwners : [];
const executionOwners = Array.isArray(archive.executionOwners) ? archive.executionOwners : [];
const attestationOwners = Array.isArray(archive.attestationOwners) ? archive.attestationOwners : [];
const sealOwners = Array.isArray(archive.sealOwners) ? archive.sealOwners : [];
const charterOwners = Array.isArray(archive.charterOwners) ? archive.charterOwners : [];
const canonOwners = Array.isArray(archive.canonOwners) ? archive.canonOwners : [];
const constitutionOwners = Array.isArray(archive.constitutionOwners) ? archive.constitutionOwners : [];
const covenantOwners = Array.isArray(archive.covenantOwners) ? archive.covenantOwners : [];
const compactOwners = Array.isArray(archive.compactOwners) ? archive.compactOwners : [];
const capsuleOwners = Array.isArray(archive.capsuleOwners) ? archive.capsuleOwners : [];
const ledgerOwners = Array.isArray(archive.ledgerOwners) ? archive.ledgerOwners : [];
const archiveOwners = Array.isArray(archive.archiveOwners) ? archive.archiveOwners : [];

const gateChecks = [
  { name: 'major release archive remains ready for final vault', passed: archive.archive === 'ready-for-major-release-archive' },
  { name: 'prepared checklist remains targeted at 1.0.0', passed: checklistVersion === '1.0.0' && archive.nextVersion === '1.0.0' },
  { name: 'prepared checklist remains marked ready', passed: checklistStatus === 'ready' },
  { name: 'prepared checklist remains a major release checklist', passed: checklistBumpType === 'major' },
  {
    name: 'archive still includes execution, attestation, seal, charter, canon, constitution, covenant, compact, capsule, ledger, and archive validation',
    passed:
      Array.isArray(archive.validationCommands) &&
      archive.validationCommands.includes('pnpm release:major:execution:test') &&
      archive.validationCommands.includes('pnpm release:major:attestation:test') &&
      archive.validationCommands.includes('pnpm release:major:seal:test') &&
      archive.validationCommands.includes('pnpm release:major:charter:test') &&
      archive.validationCommands.includes('pnpm release:major:canon:test') &&
      archive.validationCommands.includes('pnpm release:major:constitution:test') &&
      archive.validationCommands.includes('pnpm release:major:covenant:test') &&
      archive.validationCommands.includes('pnpm release:major:compact:test') &&
      archive.validationCommands.includes('pnpm release:major:capsule:test') &&
      archive.validationCommands.includes('pnpm release:major:ledger:test') &&
      archive.validationCommands.includes('pnpm release:major:archive:test'),
  },
  { name: 'archive still includes explicit major ship command', passed: Array.isArray(archive.shipCommands) && archive.shipCommands.includes('pnpm release:ship major') },
  { name: 'archive owners remain attached to the vault surface', passed: archiveOwners.length > 0 },
  { name: 'ledger owners remain attached to the vault surface', passed: ledgerOwners.length > 0 },
  { name: 'capsule owners remain attached to the vault surface', passed: capsuleOwners.length > 0 },
  { name: 'compact owners remain attached to the vault surface', passed: compactOwners.length > 0 },
  { name: 'covenant owners remain attached to the vault surface', passed: covenantOwners.length > 0 },
  { name: 'constitution owners remain attached to the vault surface', passed: constitutionOwners.length > 0 },
  { name: 'canon owners remain attached to the vault surface', passed: canonOwners.length > 0 },
  { name: 'charter owners remain attached to the vault surface', passed: charterOwners.length > 0 },
  { name: 'seal owners remain attached to the vault surface', passed: sealOwners.length > 0 },
  { name: 'attestation owners remain attached to the vault surface', passed: attestationOwners.length > 0 },
  { name: 'execution owners remain attached to the vault surface', passed: executionOwners.length > 0 },
  { name: 'activation owners remain attached to the vault surface', passed: activationOwners.length > 0 },
  { name: 'official preset surface remains present', passed: officialPresets.length > 0 },
];

const vault = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-release-vault' : 'hold';
const validationCommands = Array.isArray(archive.validationCommands)
  ? [...archive.validationCommands, 'pnpm release:major:vault:test']
  : ['pnpm release:major:vault:test'];
const shipCommands = Array.isArray(archive.shipCommands) ? archive.shipCommands : [];
const vaultOwners = [
  { role: 'major-release-vault-custodian', status: 'pending' },
  { role: 'major-release-vault-observer', status: 'pending' },
];
const vaultChecklist = [
  'Confirm the prepared v1.0.0 checklist, archive artifact, and vault artifact still describe the same first-major-release scope.',
  'Run the execution, attestation, seal, charter, canon, constitution, covenant, compact, capsule, ledger, archive, and vault validation stack before attempting the first pnpm release:ship major invocation.',
  'Record the vault custodian and vault observer statuses before executing the first major ship command.',
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
  '# One Point Zero Major Release Vault',
  '',
  `- Vault: \`${vault}\``,
  `- Current Version: \`${archive.currentVersion}\``,
  `- Current Tag: \`${archive.currentTag}\``,
  `- Next Version: \`${archive.nextVersion}\``,
  `- Archive Artifact: \`${path.basename(archivePath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Vault Gates',
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
  ...ownerSection('Activation Owners', activationOwners),
  ...ownerSection('Execution Owners', executionOwners),
  ...ownerSection('Attestation Owners', attestationOwners),
  ...ownerSection('Seal Owners', sealOwners),
  ...ownerSection('Charter Owners', charterOwners),
  ...ownerSection('Canon Owners', canonOwners),
  ...ownerSection('Constitution Owners', constitutionOwners),
  ...ownerSection('Covenant Owners', covenantOwners),
  ...ownerSection('Compact Owners', compactOwners),
  ...ownerSection('Capsule Owners', capsuleOwners),
  ...ownerSection('Ledger Owners', ledgerOwners),
  ...ownerSection('Archive Owners', archiveOwners),
  ...ownerSection('Vault Owners', vaultOwners),
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Vault Checklist',
  '',
  ...vaultChecklist.map((step, index) => `${index + 1}. ${step}`),
  '',
  '## Follow-Up',
  '',
  ...(vault === 'ready-for-major-release-vault'
    ? [
        '1. Treat this vault artifact as the final immutable vault before the first `pnpm release:ship major` run.',
        '2. Record the vault custodian and vault observer statuses above before executing the first major ship command.',
        '3. If any `1.0` checklist line, archive gate, or major ship command changes, regenerate the archive and vault artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed vault gates are corrected.',
        '2. Regenerate the archive and vault artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  vault,
  currentVersion: archive.currentVersion,
  currentTag: archive.currentTag,
  nextVersion: archive.nextVersion,
  officialPresets,
  activationOwners,
  executionOwners,
  attestationOwners,
  sealOwners,
  charterOwners,
  canonOwners,
  constitutionOwners,
  covenantOwners,
  compactOwners,
  capsuleOwners,
  ledgerOwners,
  archiveOwners,
  vaultOwners,
  gateChecks,
  validationCommands,
  shipCommands,
  vaultChecklist,
  sources: {
    archive: archivePath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (vault !== 'ready-for-major-release-vault') {
  console.error('One Point Zero major release vault failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release vault written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
