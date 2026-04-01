#!/bin/bash
set -euo pipefail

PACKET_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$PACKET_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-signoff.sh <one-point-zero-major-release-packet.json> <v1.0.0-checklist.md> [output-dir]"
  exit 1
fi

for path in "$PACKET_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-signoff.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-signoff.json"

node - "$PACKET_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [packetPath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
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
const officialPresets = Array.isArray(packet.officialPresets) ? packet.officialPresets : [];

const gateChecks = [
  {
    name: 'major release packet remains ready for human signoff',
    passed: packet.packet === 'ready-for-human-signoff',
  },
  {
    name: 'prepared checklist still targets 1.0.0',
    passed: checklistVersion === '1.0.0' && packet.nextVersion === '1.0.0',
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
    name: 'packet still includes explicit major ship command',
    passed: Array.isArray(packet.shipCommands) && packet.shipCommands.includes('pnpm release:ship major'),
  },
  {
    name: 'packet still includes explicit cockpit validation',
    passed: Array.isArray(packet.validationCommands) && packet.validationCommands.includes('pnpm release:major:cockpit:test'),
  },
  {
    name: 'packet still includes official preset surface',
    passed: officialPresets.length > 0,
  },
];

const signoff = gateChecks.every((entry) => entry.passed) ? 'ready-for-final-human-signoff' : 'hold';
const validationCommands = Array.isArray(packet.validationCommands)
  ? [...packet.validationCommands, 'pnpm release:major:packet:test', 'pnpm release:major:signoff:test']
  : ['pnpm release:major:packet:test', 'pnpm release:major:signoff:test'];
const reviewers = [
  { role: 'framework-maintainer', status: 'pending' },
  { role: 'release-operator', status: 'pending' },
  { role: 'product-owner', status: 'pending' },
];

const markdown = [
  '# One Point Zero Major Release Signoff',
  '',
  `- Signoff Status: \`${signoff}\``,
  `- Current Version: \`${packet.currentVersion}\``,
  `- Current Tag: \`${packet.currentTag}\``,
  `- Next Version: \`${packet.nextVersion}\``,
  `- Packet: \`${path.basename(packetPath)}\``,
  `- Checklist: \`${path.basename(checklistPath)}\``,
  '',
  '## Signoff Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Reviewer Slots',
  '',
  '| Role | Status |',
  '| --- | --- |',
  ...reviewers.map((entry) => `| \`${entry.role}\` | ${entry.status} |`),
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Ship Commands',
  '',
  ...((packet.shipCommands || []).map((command, index) => `${index + 1}. \`${command}\``)),
  '',
  '## Follow-Up',
  '',
  ...(signoff === 'ready-for-final-human-signoff'
    ? [
        '1. Bring this signoff sheet, the packet artifact, and the `v1.0.0` checklist into the final human approval meeting.',
        '2. Record human approvals against the reviewer slots before changing the `v1.0.0` checklist status to `ready`.',
        '3. Once approvals are complete, run the ship commands in order without changing the frozen 1.0-facing surface.',
      ]
    : [
        '1. Do not begin the first major release until the failed signoff gates are corrected.',
        '2. Regenerate the packet and signoff artifacts after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  signoff,
  currentVersion: packet.currentVersion,
  currentTag: packet.currentTag,
  nextVersion: packet.nextVersion,
  officialPresets,
  reviewers,
  gateChecks,
  validationCommands,
  shipCommands: packet.shipCommands || [],
  sources: {
    packet: packetPath,
    checklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (signoff !== 'ready-for-final-human-signoff') {
  console.error('One Point Zero major release signoff failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release signoff written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
