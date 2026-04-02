#!/bin/bash
set -euo pipefail

BOARD_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$BOARD_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-verdict.sh <one-point-zero-major-release-board.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$BOARD_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-verdict.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-verdict.json"

node - "$BOARD_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [boardPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
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
const officialPresets = Array.isArray(board.officialPresets) ? board.officialPresets : [];
const boardSlots = Array.isArray(board.boardSlots) ? board.boardSlots : [];

const gateChecks = [
  {
    name: 'major release board remains ready for board review',
    passed: board.board === 'ready-for-board-review',
  },
  {
    name: 'prepared checklist still targets 1.0.0',
    passed: checklistVersion === '1.0.0' && board.nextVersion === '1.0.0',
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
    name: 'board artifact still includes explicit board validation',
    passed: Array.isArray(board.validationCommands) && board.validationCommands.includes('pnpm release:major:board:test'),
  },
  {
    name: 'board artifact still includes explicit major ship command',
    passed: Array.isArray(board.shipCommands) && board.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'board keeps all reviewer slots pending explicit resolution',
    passed: boardSlots.length > 0 && boardSlots.every((slot) => typeof slot.role === 'string' && slot.role.length > 0),
  },
  {
    name: 'official preset surface remains present',
    passed: officialPresets.length > 0,
  },
];

const verdict = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-go-no-go' : 'hold';
const validationCommands = Array.isArray(board.validationCommands)
  ? [...board.validationCommands, 'pnpm release:major:verdict:test']
  : ['pnpm release:major:verdict:test'];
const shipCommands = Array.isArray(board.shipCommands) ? board.shipCommands : [];

const markdown = [
  '# One Point Zero Major Release Verdict',
  '',
  `- Verdict: \`${verdict}\``,
  `- Current Version: \`${board.currentVersion}\``,
  `- Current Tag: \`${board.currentTag}\``,
  `- Next Version: \`${board.nextVersion}\``,
  `- Board Artifact: \`${path.basename(boardPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Verdict Gates',
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
  '## Official Presets',
  '',
  officialPresets.length > 0
    ? `- Supported presets: ${officialPresets.map((preset) => `\`${preset}\``).join(', ')}`
    : '- Supported presets: none',
  '',
  '## Board Slots',
  '',
  '| Role | Resolution |',
  '| --- | --- |',
  ...boardSlots.map((entry) => `| \`${entry.role}\` | ${entry.resolution} |`),
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
  ...(verdict === 'ready-for-major-go-no-go'
    ? [
        '1. Treat this verdict as the final maintainer go or no-go sheet before the first `pnpm release:ship major` run.',
        '2. Record explicit board outcomes and checklist status changes before promoting the checklist from `draft` to `ready`.',
        '3. If any 1.0-facing preset, release guard, or board artifact changes, regenerate the board and verdict artifacts before shipping.',
      ]
    : [
        '1. Do not attempt the first major release until the failed verdict gates are corrected.',
        '2. Regenerate the board and verdict artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  verdict,
  currentVersion: board.currentVersion,
  currentTag: board.currentTag,
  nextVersion: board.nextVersion,
  officialPresets,
  boardSlots,
  gateChecks,
  validationCommands,
  shipCommands,
  sources: {
    board: boardPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (verdict !== 'ready-for-major-go-no-go') {
  console.error('One Point Zero major release verdict failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release verdict written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
