#!/bin/bash
set -euo pipefail

ONE_POINT_ZERO_JSON="${1:-}"
RELEASE_STATUS_JSON="${2:-}"
FREEZE_JSON="${3:-}"
OUTPUT_DIR="${4:-.release-matrix}"

if [[ -z "$ONE_POINT_ZERO_JSON" || -z "$RELEASE_STATUS_JSON" || -z "$FREEZE_JSON" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-decision-report.sh <one-point-zero-readiness.json> <release-status.json> <one-point-zero-freeze.json> [output-dir]"
  exit 1
fi

for path in "$ONE_POINT_ZERO_JSON" "$RELEASE_STATUS_JSON" "$FREEZE_JSON"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-decision.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-decision.json"

node - "$ONE_POINT_ZERO_JSON" "$RELEASE_STATUS_JSON" "$FREEZE_JSON" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');

const [readinessPath, releaseStatusPath, freezePath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const readiness = JSON.parse(fs.readFileSync(readinessPath, 'utf8'));
const releaseStatus = JSON.parse(fs.readFileSync(releaseStatusPath, 'utf8'));
const freeze = JSON.parse(fs.readFileSync(freezePath, 'utf8'));

const officialPresets = (readiness.officialPresets || []).map((entry) => ({
  preset: entry.preset,
  passed: entry.passed,
}));

const gateChecks = [
  {
    name: 'one-point-zero readiness passed',
    passed: readiness.status === 'passed',
  },
  {
    name: 'release-status passed',
    passed: releaseStatus.status === 'passed',
  },
  {
    name: 'freeze decision is go',
    passed: freeze.decision === 'go',
  },
  {
    name: 'release-status version matches freeze version',
    passed: releaseStatus.version === freeze.version,
  },
  {
    name: 'release-status tag matches freeze tag',
    passed: releaseStatus.tag === freeze.tag,
  },
  {
    name: 'official presets remain ready',
    passed: officialPresets.length > 0 && officialPresets.every((entry) => entry.passed),
  },
  {
    name: 'checklist status remains ready',
    passed: freeze.checklist?.status === 'ready',
  },
];

const decision = gateChecks.every((entry) => entry.passed) ? 'ready-for-1.0-review' : 'hold';
const checklist = freeze.checklist || {};

const recommendedActions = [
  `Treat \`${freezePath}\` as the release-scoped freeze record for \`${freeze.version}\`.`,
  'Use the 1.0 gate document and this decision artifact together before cutting any `1.0.0` tag.',
  decision === 'ready-for-1.0-review'
    ? 'The framework can now be reviewed as a 1.0 candidate without stitching together multiple release artifacts by hand.'
    : 'Do not call the framework 1.0-ready until the failing decision gates are corrected.',
];

const markdown = [
  '# One Point Zero Decision',
  '',
  `- Decision: \`${decision}\``,
  `- Version: \`${releaseStatus.version}\``,
  `- Tag: \`${releaseStatus.tag}\``,
  `- Commit: \`${releaseStatus.commit}\``,
  '',
  '## Decision Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Official Presets',
  '',
  '| Preset | Ready |',
  '| --- | --- |',
  ...officialPresets.map((entry) => `| \`${entry.preset}\` | ${entry.passed} |`),
  '',
  '## Checklist Context',
  '',
  `- Summary: ${checklist.summary || ''}`,
  `- User-facing change: ${checklist.userFacingChange || ''}`,
  `- Follow-up risks: ${checklist.followUpRisks || ''}`,
  `- Next target: ${checklist.nextTarget || ''}`,
  '',
  '## Follow-Up',
  '',
  ...recommendedActions.map((action, index) => `${index + 1}. ${action}`),
  '',
].join('\n');

const payload = {
  decision,
  version: releaseStatus.version,
  tag: releaseStatus.tag,
  commit: releaseStatus.commit,
  checklist,
  officialPresets,
  gateChecks,
  recommendedActions,
  sources: {
    onePointZeroReadiness: readinessPath,
    releaseStatus: releaseStatusPath,
    freeze: freezePath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (decision !== 'ready-for-1.0-review') {
  console.error('One Point Zero decision report failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero decision report written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
