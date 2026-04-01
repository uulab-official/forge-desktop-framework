#!/bin/bash
set -euo pipefail

PROMOTION_PLAN_JSON="${1:-}"
OUTPUT_DIR="${2:-.release-matrix}"

if [[ -z "$PROMOTION_PLAN_JSON" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-runbook.sh <one-point-zero-promotion-plan.json> [output-dir]"
  exit 1
fi

if [[ ! -f "$PROMOTION_PLAN_JSON" ]]; then
  echo "Required input not found: $PROMOTION_PLAN_JSON"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-runbook.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-runbook.json"

node - "$PROMOTION_PLAN_JSON" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');

const [promotionPlanPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const promotionPlan = JSON.parse(fs.readFileSync(promotionPlanPath, 'utf8'));

const officialPresets = Array.isArray(promotionPlan.officialPresets) ? promotionPlan.officialPresets : [];

const runbookSteps = [
  {
    step: 'Review the prepared v1.0.0 checklist and change its status from draft to ready after the final human review.',
    command: null,
  },
  {
    step: 'Re-run the 1.0 contract audit.',
    command: 'pnpm release:onepointzero:test',
  },
  {
    step: 'Re-run the condensed release health report.',
    command: 'pnpm release:status:test',
  },
  {
    step: 'Re-run the explicit freeze report.',
    command: 'pnpm release:freeze:test',
  },
  {
    step: 'Re-run the 1.0 decision artifact.',
    command: 'pnpm release:decision:test',
  },
  {
    step: 'Re-run the release-candidate handoff.',
    command: 'pnpm release:rc:test',
  },
  {
    step: 'Re-run the v1.0.0 checklist preparation helper.',
    command: 'pnpm release:major:prepare:test',
  },
  {
    step: 'Re-run the promotion-plan handoff.',
    command: 'pnpm release:promotion:test',
  },
  {
    step: 'Ship the first major release.',
    command: 'pnpm release:ship major',
  },
  {
    step: 'Verify version alignment after the major release.',
    command: 'pnpm version:check',
  },
];

const gateChecks = [
  {
    name: 'promotion plan remains ready',
    passed: promotionPlan.plan === 'ready-to-stage-1.0.0',
  },
  {
    name: 'next version remains 1.0.0',
    passed: promotionPlan.nextVersion === '1.0.0',
  },
  {
    name: 'prepared checklist remains major',
    passed: promotionPlan.checklist?.bumpType === 'major',
  },
  {
    name: 'prepared checklist path remains explicit',
    passed: typeof promotionPlan.checklist?.path === 'string' && promotionPlan.checklist.path.length > 0,
  },
  {
    name: 'official preset surface remains listed',
    passed: officialPresets.length > 0,
  },
  {
    name: 'promotion plan gates remain passed',
    passed: Array.isArray(promotionPlan.gateChecks) && promotionPlan.gateChecks.length > 0 && promotionPlan.gateChecks.every((entry) => entry.passed),
  },
];

const runbook = gateChecks.every((entry) => entry.passed) ? 'ready-for-major-ship' : 'hold';

const markdown = [
  '# One Point Zero Major Release Runbook',
  '',
  `- Runbook: \`${runbook}\``,
  `- Current Version: \`${promotionPlan.currentVersion}\``,
  `- Current Tag: \`${promotionPlan.currentTag}\``,
  `- Next Version: \`${promotionPlan.nextVersion}\``,
  `- Promotion Plan: \`${promotionPlanPath}\``,
  `- Major Checklist: \`${promotionPlan.checklist?.path || ''}\``,
  '',
  '## Gate Checks',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Official Presets',
  '',
  officialPresets.length > 0
    ? `- Supported presets: ${officialPresets.map((preset) => `\`${preset}\``).join(', ')}`
    : '- Supported presets: none',
  '',
  '## Major Release Steps',
  '',
  ...runbookSteps.map((entry, index) => {
    const commandLine = entry.command ? `\n   Command: \`${entry.command}\`` : '';
    return `${index + 1}. ${entry.step}${commandLine}`;
  }),
  '',
  '## Follow-Up',
  '',
  ...((promotionPlan.recommendedActions || []).map((entry, index) => `${index + 1}. ${entry}`)),
  '',
].join('\n');

const payload = {
  runbook,
  currentVersion: promotionPlan.currentVersion,
  currentTag: promotionPlan.currentTag,
  nextVersion: promotionPlan.nextVersion,
  officialPresets,
  checklist: promotionPlan.checklist,
  gateChecks,
  steps: runbookSteps,
  recommendedActions: promotionPlan.recommendedActions || [],
  sources: {
    promotionPlan: promotionPlanPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (runbook !== 'ready-for-major-ship') {
  console.error('One Point Zero major release runbook failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release runbook written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
