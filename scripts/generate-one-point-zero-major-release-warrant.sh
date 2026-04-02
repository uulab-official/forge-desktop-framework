#!/bin/bash
set -euo pipefail

AUTHORIZATION_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$AUTHORIZATION_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-warrant.sh <one-point-zero-major-release-authorization.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$AUTHORIZATION_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-warrant.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-warrant.json"

node - "$AUTHORIZATION_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [authorizationPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const authorization = JSON.parse(fs.readFileSync(authorizationPath, 'utf8'));
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
const officialPresets = Array.isArray(authorization.officialPresets) ? authorization.officialPresets : [];
const authorizationOwners = Array.isArray(authorization.authorizationOwners) ? authorization.authorizationOwners : [];

const gateChecks = [
  {
    name: 'major release authorization remains authorized for major ship',
    passed: authorization.authorization === 'authorized-for-major-ship',
  },
  {
    name: 'prepared checklist still targets 1.0.0',
    passed: checklistVersion === '1.0.0' && authorization.nextVersion === '1.0.0',
  },
  {
    name: 'prepared checklist remains a major release checklist',
    passed: checklistBumpType === 'major',
  },
  {
    name: 'prepared checklist remains draft or ready',
    passed: checklistStatus === 'draft' || checklistStatus === 'ready',
  },
  {
    name: 'authorization still includes explicit major ship command',
    passed: Array.isArray(authorization.shipCommands) && authorization.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'authorization still includes explicit authorization validation',
    passed: Array.isArray(authorization.validationCommands) && authorization.validationCommands.includes('pnpm release:major:authorization:test'),
  },
  {
    name: 'authorization owners remain attached to the final warrant surface',
    passed: authorizationOwners.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const warrant = gateChecks.every((entry) => entry.passed) ? 'warranted-for-major-launch' : 'hold';
const validationCommands = Array.isArray(authorization.validationCommands)
  ? [...authorization.validationCommands, 'pnpm release:major:warrant:test']
  : ['pnpm release:major:warrant:test'];
const shipCommands = Array.isArray(authorization.shipCommands) ? authorization.shipCommands : [];
const warrantWitnesses = [
  { role: 'major-release-custodian', status: 'pending' },
  { role: 'launch-witness', status: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Warrant',
  '',
  `- Warrant: \`${warrant}\``,
  `- Current Version: \`${authorization.currentVersion}\``,
  `- Current Tag: \`${authorization.currentTag}\``,
  `- Next Version: \`${authorization.nextVersion}\``,
  `- Authorization Artifact: \`${path.basename(authorizationPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Warrant Gates',
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
  '## Authorization Owners',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...authorizationOwners.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Warrant Witnesses',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...warrantWitnesses.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Follow-Up',
  '',
  ...(warrant === 'warranted-for-major-launch'
    ? [
        '1. Treat this warrant as the last launch-side maintainer document before the first `pnpm release:ship major` run.',
        '2. Record the final custodian and launch witness statuses above before promoting the `v1.0.0` checklist to `ready`.',
        '3. If any 1.0-facing preset, authorization gate, or major ship command changes, regenerate the authorization and warrant artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed warrant gates are corrected.',
        '2. Regenerate the authorization and warrant artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  warrant,
  currentVersion: authorization.currentVersion,
  currentTag: authorization.currentTag,
  nextVersion: authorization.nextVersion,
  officialPresets,
  authorizationOwners,
  warrantWitnesses,
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    authorization: authorizationPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (warrant !== 'warranted-for-major-launch') {
  console.error('One Point Zero major release warrant failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release warrant written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
