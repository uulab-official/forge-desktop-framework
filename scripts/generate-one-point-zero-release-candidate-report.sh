#!/bin/bash
set -euo pipefail

DECISION_JSON="${1:-}"
OUTPUT_DIR="${2:-.release-matrix}"

if [[ -z "$DECISION_JSON" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-release-candidate-report.sh <one-point-zero-decision.json> [output-dir]"
  exit 1
fi

if [[ ! -f "$DECISION_JSON" ]]; then
  echo "Required input not found: $DECISION_JSON"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-release-candidate.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-release-candidate.json"

node - "$DECISION_JSON" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');

const [decisionPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

const [major] = String(decision.version || '').split('.').map((segment) => Number(segment));
const nextMajorVersion = Number.isFinite(major) ? `${major + 1}.0.0` : '1.0.0';
const nextChecklistPath = `docs/release-checklists/v${nextMajorVersion}.md`;

const gateChecks = [
  {
    name: 'one-point-zero decision ready for review',
    passed: decision.decision === 'ready-for-1.0-review',
  },
  {
    name: 'current checklist remains ready',
    passed: decision.checklist?.status === 'ready',
  },
  {
    name: 'next major version is 1.0.0',
    passed: nextMajorVersion === '1.0.0',
  },
  {
    name: 'official presets remain ready',
    passed: Array.isArray(decision.officialPresets) && decision.officialPresets.length > 0 && decision.officialPresets.every((entry) => entry.passed),
  },
  {
    name: 'all upstream decision gates remain ready',
    passed: Array.isArray(decision.gateChecks) && decision.gateChecks.length > 0 && decision.gateChecks.every((entry) => entry.passed),
  },
];

const candidate = gateChecks.every((entry) => entry.passed) ? 'ready-for-1.0-rc' : 'hold';

const recommendedActions = [
  `Prepare the next checklist at \`${nextChecklistPath}\` before attempting the major release.`,
  'Review the final decision artifact alongside the 1.0 gate document before cutting `1.0.0`.',
  candidate === 'ready-for-1.0-rc'
    ? 'When the product surface is frozen, run `pnpm release:ship major` to promote Forge to `1.0.0`.'
    : 'Do not attempt a `1.0.0` cut until the failed release-candidate gates are corrected.',
];

const markdown = [
  '# One Point Zero Release Candidate',
  '',
  `- Candidate: \`${candidate}\``,
  `- Current Version: \`${decision.version}\``,
  `- Current Tag: \`${decision.tag}\``,
  `- Current Commit: \`${decision.commit}\``,
  `- Next Version: \`${nextMajorVersion}\``,
  `- Next Checklist: \`${nextChecklistPath}\``,
  '',
  '## Release Candidate Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Current Checklist Context',
  '',
  `- Summary: ${decision.checklist?.summary || ''}`,
  `- User-facing change: ${decision.checklist?.userFacingChange || ''}`,
  `- Follow-up risks: ${decision.checklist?.followUpRisks || ''}`,
  `- Next target: ${decision.checklist?.nextTarget || ''}`,
  '',
  '## Follow-Up',
  '',
  ...recommendedActions.map((action, index) => `${index + 1}. ${action}`),
  '',
].join('\n');

const payload = {
  candidate,
  currentVersion: decision.version,
  currentTag: decision.tag,
  currentCommit: decision.commit,
  nextVersion: nextMajorVersion,
  nextChecklistPath,
  checklist: decision.checklist || {},
  officialPresets: decision.officialPresets || [],
  gateChecks,
  recommendedActions,
  source: decisionPath,
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (candidate !== 'ready-for-1.0-rc') {
  console.error('One Point Zero release candidate report failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero release candidate report written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
