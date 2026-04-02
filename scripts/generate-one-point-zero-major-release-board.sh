#!/bin/bash
set -euo pipefail

SIGNOFF_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$SIGNOFF_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-board.sh <one-point-zero-major-release-signoff.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$SIGNOFF_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-board.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-board.json"

node - "$SIGNOFF_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [signoffPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const signoff = JSON.parse(fs.readFileSync(signoffPath, 'utf8'));
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
const officialPresets = Array.isArray(signoff.officialPresets) ? signoff.officialPresets : [];

const gateChecks = [
  {
    name: 'major release signoff remains ready for final human signoff',
    passed: signoff.signoff === 'ready-for-final-human-signoff',
  },
  {
    name: 'prepared checklist still targets 1.0.0',
    passed: checklistVersion === '1.0.0' && signoff.nextVersion === '1.0.0',
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
    name: 'signoff still includes major ship command',
    passed: Array.isArray(signoff.shipCommands) && signoff.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'signoff still includes packet validation',
    passed: Array.isArray(signoff.validationCommands) && signoff.validationCommands.includes('pnpm release:major:packet:test'),
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const board = gateChecks.every((entry) => entry.passed) ? 'ready-for-board-review' : 'hold';
const validationCommands = Array.isArray(signoff.validationCommands)
  ? [...signoff.validationCommands, 'pnpm release:major:board:test']
  : ['pnpm release:major:board:test'];
const boardSlots = [
  { role: 'framework-board-chair', resolution: 'pending' },
  { role: 'release-operations-lead', resolution: 'pending' },
  { role: 'product-sponsor', resolution: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Board',
  '',
  `- Board Status: \`${board}\``,
  `- Current Version: \`${signoff.currentVersion}\``,
  `- Current Tag: \`${signoff.currentTag}\``,
  `- Next Version: \`${signoff.nextVersion}\``,
  `- Signoff Sheet: \`${path.basename(signoffPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Board Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Board Resolutions',
  '',
  '| Role | Resolution |',
  '| --- | --- |',
  ...boardSlots.map((entry) => `| \`${entry.role}\` | ${entry.resolution} |`),
  '',
  '## Checklist Context',
  '',
  `- Status: ${checklistStatus}`,
  `- Bump Type: ${checklistBumpType}`,
  `- Summary: ${checklistSummary}`,
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...((signoff.shipCommands || []).map((command, index) => `${index + 1}. \`${command}\``)),
  '',
  '## Follow-Up',
  '',
  ...(board === 'ready-for-board-review'
    ? [
        '1. Use this board artifact as the final reviewer packet for the first `1.0.0` approval meeting.',
        '2. Record board resolutions against the slots above before changing the `v1.0.0` checklist status to `ready`.',
        '3. Once the board resolves `approve`, run the ship commands in order without changing the frozen 1.0-facing surface.',
      ]
    : [
        '1. Do not bring the first major release to the approval board until the failed gates are corrected.',
        '2. Regenerate the signoff and board artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  board,
  currentVersion: signoff.currentVersion,
  currentTag: signoff.currentTag,
  nextVersion: signoff.nextVersion,
  officialPresets,
  boardSlots,
  gateChecks,
  validationCommands,
  shipCommands: signoff.shipCommands || [],
  sources: {
    signoff: signoffPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (board !== 'ready-for-board-review') {
  console.error('One Point Zero major release board failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release board written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
