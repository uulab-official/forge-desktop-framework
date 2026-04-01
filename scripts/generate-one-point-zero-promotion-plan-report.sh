#!/bin/bash
set -euo pipefail

RELEASE_CANDIDATE_JSON="${1:-}"
MAJOR_CHECKLIST_MD="${2:-}"
OUTPUT_DIR="${3:-.release-matrix}"

if [[ -z "$RELEASE_CANDIDATE_JSON" || -z "$MAJOR_CHECKLIST_MD" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-promotion-plan-report.sh <one-point-zero-release-candidate.json> <major-checklist.md> [output-dir]"
  exit 1
fi

for path in "$RELEASE_CANDIDATE_JSON" "$MAJOR_CHECKLIST_MD"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-promotion-plan.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-promotion-plan.json"

node - "$RELEASE_CANDIDATE_JSON" "$MAJOR_CHECKLIST_MD" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [releaseCandidatePath, checklistPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const releaseCandidate = JSON.parse(fs.readFileSync(releaseCandidatePath, 'utf8'));
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
const checklistFollowUpRisks = extractChecklistValue('Follow-up risks');
const checklistNextTarget = extractChecklistValue('Next target');
const checklistFilename = path.basename(checklistPath);
const expectedChecklistFilename = path.basename(releaseCandidate.nextChecklistPath || '');
const officialPresets = Array.isArray(releaseCandidate.officialPresets)
  ? releaseCandidate.officialPresets.map((entry) => entry.preset)
  : [];

const gateChecks = [
  {
    name: 'release candidate remains ready',
    passed: releaseCandidate.candidate === 'ready-for-1.0-rc',
  },
  {
    name: 'next version remains 1.0.0',
    passed: releaseCandidate.nextVersion === '1.0.0',
  },
  {
    name: 'prepared checklist version matches next version',
    passed: checklistVersion === releaseCandidate.nextVersion,
  },
  {
    name: 'prepared checklist path matches release candidate target',
    passed: checklistFilename === expectedChecklistFilename,
  },
  {
    name: 'prepared checklist is still draft or ready',
    passed: checklistStatus === 'draft' || checklistStatus === 'ready',
  },
  {
    name: 'prepared checklist is marked major',
    passed: checklistBumpType === 'major',
  },
  {
    name: 'prepared checklist includes official preset surface',
    passed: officialPresets.length > 0 && officialPresets.every((preset) => checklist.includes(`\`${preset}\``)),
  },
  {
    name: 'prepared checklist includes major ship command',
    passed: checklist.includes('`pnpm release:ship major`'),
  },
];

const plan = gateChecks.every((entry) => entry.passed) ? 'ready-to-stage-1.0.0' : 'hold';

const recommendedActions = [
  `Review and complete \`${checklistPath}\` before attempting the first major release.`,
  'Treat the release-candidate artifact as the stable source for the current promotion target and supporting rationale.',
  plan === 'ready-to-stage-1.0.0'
    ? 'When the checklist is marked `ready`, run `pnpm release:ship major` to stage Forge `1.0.0`.'
    : 'Do not stage `1.0.0` until the failed promotion-plan gates are corrected.',
];

const markdown = [
  '# One Point Zero Promotion Plan',
  '',
  `- Plan: \`${plan}\``,
  `- Current Version: \`${releaseCandidate.currentVersion}\``,
  `- Current Tag: \`${releaseCandidate.currentTag}\``,
  `- Current Commit: \`${releaseCandidate.currentCommit}\``,
  `- Next Version: \`${releaseCandidate.nextVersion}\``,
  `- Release Candidate: \`${releaseCandidatePath}\``,
  `- Major Checklist: \`${checklistPath}\``,
  '',
  '## Promotion Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Prepared Checklist Context',
  '',
  `- Status: ${checklistStatus}`,
  `- Bump Type: ${checklistBumpType}`,
  `- Summary: ${checklistSummary}`,
  `- User-facing change: ${checklistUserFacingChange}`,
  `- Follow-up risks: ${checklistFollowUpRisks}`,
  `- Next target: ${checklistNextTarget}`,
  '',
  '## Follow-Up',
  '',
  ...recommendedActions.map((action, index) => `${index + 1}. ${action}`),
  '',
].join('\n');

const payload = {
  plan,
  currentVersion: releaseCandidate.currentVersion,
  currentTag: releaseCandidate.currentTag,
  currentCommit: releaseCandidate.currentCommit,
  nextVersion: releaseCandidate.nextVersion,
  releaseCandidate: {
    candidate: releaseCandidate.candidate,
    nextChecklistPath: releaseCandidate.nextChecklistPath,
  },
  checklist: {
    path: checklistPath,
    status: checklistStatus,
    bumpType: checklistBumpType,
    version: checklistVersion,
    summary: checklistSummary,
    userFacingChange: checklistUserFacingChange,
    followUpRisks: checklistFollowUpRisks,
    nextTarget: checklistNextTarget,
  },
  officialPresets,
  gateChecks,
  recommendedActions,
  sources: {
    releaseCandidate: releaseCandidatePath,
    majorChecklist: checklistPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (plan !== 'ready-to-stage-1.0.0') {
  console.error('One Point Zero promotion plan report failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero promotion plan report written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
