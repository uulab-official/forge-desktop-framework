#!/bin/bash
set -euo pipefail

READINESS_JSON="${1:-}"
RELEASE_STATUS_JSON="${2:-}"
DECISION_JSON="${3:-}"
PROMOTION_PLAN_JSON="${4:-}"
RUNBOOK_JSON="${5:-}"
APPROVAL_JSON="${6:-}"
OUTPUT_DIR="${7:-.release-matrix}"

if [[ -z "$READINESS_JSON" || -z "$RELEASE_STATUS_JSON" || -z "$DECISION_JSON" || -z "$PROMOTION_PLAN_JSON" || -z "$RUNBOOK_JSON" || -z "$APPROVAL_JSON" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-cockpit.sh <one-point-zero-readiness.json> <release-status.json> <one-point-zero-decision.json> <one-point-zero-promotion-plan.json> <one-point-zero-major-release-runbook.json> <one-point-zero-major-release-approval.json> [output-dir]"
  exit 1
fi

for path in "$READINESS_JSON" "$RELEASE_STATUS_JSON" "$DECISION_JSON" "$PROMOTION_PLAN_JSON" "$RUNBOOK_JSON" "$APPROVAL_JSON"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-cockpit.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-cockpit.json"

node - "$READINESS_JSON" "$RELEASE_STATUS_JSON" "$DECISION_JSON" "$PROMOTION_PLAN_JSON" "$RUNBOOK_JSON" "$APPROVAL_JSON" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');

const [readinessPath, releaseStatusPath, decisionPath, promotionPlanPath, runbookPath, approvalPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const readiness = JSON.parse(fs.readFileSync(readinessPath, 'utf8'));
const releaseStatus = JSON.parse(fs.readFileSync(releaseStatusPath, 'utf8'));
const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
const promotionPlan = JSON.parse(fs.readFileSync(promotionPlanPath, 'utf8'));
const runbook = JSON.parse(fs.readFileSync(runbookPath, 'utf8'));
const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));

const officialPresets = Array.isArray(approval.officialPresets)
  ? approval.officialPresets
  : Array.isArray(runbook.officialPresets)
    ? runbook.officialPresets
    : [];

const cockpitChecks = [
  { name: 'one-point-zero readiness passed', passed: readiness.status === 'passed' },
  { name: 'release-status passed', passed: releaseStatus.status === 'passed' },
  { name: 'one-point-zero decision remains ready-for-1.0-review', passed: decision.decision === 'ready-for-1.0-review' },
  { name: 'promotion plan remains ready-to-stage-1.0.0', passed: promotionPlan.plan === 'ready-to-stage-1.0.0' },
  { name: 'major release runbook remains ready-for-major-ship', passed: runbook.runbook === 'ready-for-major-ship' },
  { name: 'major release approval remains approved-for-major-staging', passed: approval.approval === 'approved-for-major-staging' },
  {
    name: 'all 1.0 artifacts target the same current version',
    passed:
      releaseStatus.version === decision.version &&
      decision.version === promotionPlan.currentVersion &&
      promotionPlan.currentVersion === runbook.currentVersion &&
      runbook.currentVersion === approval.currentVersion,
  },
  {
    name: 'all 1.0 artifacts target the same current tag',
    passed:
      releaseStatus.tag === decision.tag &&
      decision.tag === promotionPlan.currentTag &&
      promotionPlan.currentTag === runbook.currentTag &&
      runbook.currentTag === approval.currentTag,
  },
  {
    name: 'all 1.0 artifacts target next version 1.0.0',
    passed:
      promotionPlan.nextVersion === '1.0.0' &&
      runbook.nextVersion === '1.0.0' &&
      approval.nextVersion === '1.0.0',
  },
  {
    name: 'official presets remain fully ready',
    passed: officialPresets.length > 0 && officialPresets.every(Boolean),
  },
];

const status = cockpitChecks.every((entry) => entry.passed) ? 'major-release-cockpit-green' : 'hold';
const shipCommands = Array.isArray(approval.commands) ? approval.commands : [];
const validationCommands = [
  'pnpm release:onepointzero:test',
  'pnpm release:status:test',
  'pnpm release:decision:test',
  'pnpm release:promotion:test',
  'pnpm release:major:runbook:test',
  'pnpm release:major:approval:test',
  'pnpm release:major:cockpit:test',
];

const artifactSet = [
  'one-point-zero-readiness.md/json',
  'release-status.md/json',
  'one-point-zero-decision.md/json',
  'one-point-zero-promotion-plan.md/json',
  'one-point-zero-major-release-runbook.md/json',
  'one-point-zero-major-release-approval.md/json',
  'one-point-zero-major-release-cockpit.md/json',
  'v1.0.0.md',
];

const markdown = [
  '# One Point Zero Major Release Cockpit',
  '',
  `- Status: \`${status}\``,
  `- Current Version: \`${approval.currentVersion}\``,
  `- Current Tag: \`${approval.currentTag}\``,
  `- Next Version: \`${approval.nextVersion}\``,
  '',
  '## Cockpit Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...cockpitChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Official Presets',
  '',
  officialPresets.length > 0
    ? `- Supported presets: ${officialPresets.map((preset) => `\`${preset}\``).join(', ')}`
    : '- Supported presets: none',
  '',
  '## Validation Commands',
  '',
  ...validationCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Major Ship Commands',
  '',
  ...shipCommands.map((command, index) => `${index + 1}. \`${command}\``),
  '',
  '## Required Artifacts',
  '',
  ...artifactSet.map((artifact) => `- \`${artifact}\``),
  '',
  '## Follow-Up',
  '',
  ...(status === 'major-release-cockpit-green'
    ? [
        '1. Review the generated `v1.0.0` checklist, approval artifact, and this cockpit summary together as the final maintainer handoff.',
        '2. Re-run the validation commands above if any 1.0-facing document, preset, or release script changes after this artifact is generated.',
        '3. Use the major ship commands exactly in order when the first `1.0.0` release is approved.',
      ]
    : [
        '1. Do not attempt `pnpm release:ship major` until the failed cockpit gates are corrected.',
        '2. Rebuild the decision, promotion, runbook, and approval artifacts after the fixes land, then regenerate this cockpit summary.',
      ]),
  '',
].join('\n');

const payload = {
  status,
  currentVersion: approval.currentVersion,
  currentTag: approval.currentTag,
  nextVersion: approval.nextVersion,
  officialPresets,
  gateChecks: cockpitChecks,
  validationCommands,
  shipCommands,
  artifacts: artifactSet,
  sources: {
    readiness: readinessPath,
    releaseStatus: releaseStatusPath,
    decision: decisionPath,
    promotionPlan: promotionPlanPath,
    runbook: runbookPath,
    approval: approvalPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'major-release-cockpit-green') {
  console.error('One Point Zero major release cockpit failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release cockpit written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
