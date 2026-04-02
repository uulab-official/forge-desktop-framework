#!/bin/bash
set -euo pipefail

WARRANT_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$WARRANT_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-launch-sheet.sh <one-point-zero-major-release-warrant.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$WARRANT_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-launch-sheet.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-launch-sheet.json"

node - "$WARRANT_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [warrantPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const warrant = JSON.parse(fs.readFileSync(warrantPath, 'utf8'));
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
const officialPresets = Array.isArray(warrant.officialPresets) ? warrant.officialPresets : [];
const warrantWitnesses = Array.isArray(warrant.warrantWitnesses) ? warrant.warrantWitnesses : [];

const gateChecks = [
  {
    name: 'major release warrant remains warranted for launch',
    passed: warrant.warrant === 'warranted-for-major-launch',
  },
  {
    name: 'prepared checklist still targets 1.0.0',
    passed: checklistVersion === '1.0.0' && warrant.nextVersion === '1.0.0',
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
    name: 'warrant still includes explicit major ship command',
    passed: Array.isArray(warrant.shipCommands) && warrant.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'warrant still includes explicit warrant validation',
    passed: Array.isArray(warrant.validationCommands) && warrant.validationCommands.includes('pnpm release:major:warrant:test'),
  },
  {
    name: 'warrant witnesses remain attached to the launch sheet surface',
    passed: warrantWitnesses.length > 0,
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const launchSheet = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-launch-execution' : 'hold';
const validationCommands = Array.isArray(warrant.validationCommands)
  ? [...warrant.validationCommands, 'pnpm release:major:launch-sheet:test']
  : ['pnpm release:major:launch-sheet:test'];
const shipCommands = Array.isArray(warrant.shipCommands) ? warrant.shipCommands : [];
const launchOperators = [
  { role: 'release-operator', status: 'pending' },
  { role: 'launch-observer', status: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Launch Sheet',
  '',
  `- Launch Sheet: \`${launchSheet}\``,
  `- Current Version: \`${warrant.currentVersion}\``,
  `- Current Tag: \`${warrant.currentTag}\``,
  `- Next Version: \`${warrant.nextVersion}\``,
  `- Warrant Artifact: \`${path.basename(warrantPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Launch Gates',
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
  '## Warrant Witnesses',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...warrantWitnesses.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Launch Operators',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...launchOperators.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
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
  ...(launchSheet === 'ready-for-major-launch-execution'
    ? [
        '1. Treat this launch sheet as the last operator-facing execution surface before the first `pnpm release:ship major` run.',
        '2. Record the release operator and launch observer statuses above before promoting the `v1.0.0` checklist to `ready`.',
        '3. If any 1.0-facing preset, warrant gate, or major ship command changes, regenerate the warrant and launch sheet artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed launch gates are corrected.',
        '2. Regenerate the warrant and launch sheet artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  launchSheet,
  currentVersion: warrant.currentVersion,
  currentTag: warrant.currentTag,
  nextVersion: warrant.nextVersion,
  officialPresets,
  warrantWitnesses,
  launchOperators,
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    warrant: warrantPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (launchSheet !== 'ready-for-major-launch-execution') {
  console.error('One Point Zero major release launch sheet failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release launch sheet written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
