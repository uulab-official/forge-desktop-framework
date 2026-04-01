#!/bin/bash
set -euo pipefail

DECISION_JSON="${1:-}"
PROMOTION_PLAN_JSON="${2:-}"
RUNBOOK_JSON="${3:-}"
OUTPUT_DIR="${4:-.release-matrix}"

if [[ -z "$DECISION_JSON" || -z "$PROMOTION_PLAN_JSON" || -z "$RUNBOOK_JSON" ]]; then
  echo "Usage: bash scripts/generate-one-point-zero-major-release-approval.sh <one-point-zero-decision.json> <one-point-zero-promotion-plan.json> <one-point-zero-major-release-runbook.json> [output-dir]"
  exit 1
fi

for path in "$DECISION_JSON" "$PROMOTION_PLAN_JSON" "$RUNBOOK_JSON"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/one-point-zero-major-release-approval.md"
OUTPUT_JSON="$OUTPUT_DIR/one-point-zero-major-release-approval.json"

node - "$DECISION_JSON" "$PROMOTION_PLAN_JSON" "$RUNBOOK_JSON" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');

const [decisionPath, promotionPlanPath, runbookPath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
const promotionPlan = JSON.parse(fs.readFileSync(promotionPlanPath, 'utf8'));
const runbook = JSON.parse(fs.readFileSync(runbookPath, 'utf8'));

const gateChecks = [
  {
    name: 'one-point-zero decision remains ready for review',
    passed: decision.decision === 'ready-for-1.0-review',
  },
  {
    name: 'promotion plan remains ready to stage 1.0.0',
    passed: promotionPlan.plan === 'ready-to-stage-1.0.0',
  },
  {
    name: 'major release runbook remains ready for major ship',
    passed: runbook.runbook === 'ready-for-major-ship',
  },
  {
    name: 'all artifacts point at 1.0.0',
    passed: decision.version === promotionPlan.currentVersion && promotionPlan.nextVersion === '1.0.0' && runbook.nextVersion === '1.0.0',
  },
  {
    name: 'all artifacts target the same current tag',
    passed: decision.tag === promotionPlan.currentTag && promotionPlan.currentTag === runbook.currentTag,
  },
  {
    name: 'promotion-plan gates remain passed',
    passed: Array.isArray(promotionPlan.gateChecks) && promotionPlan.gateChecks.length > 0 && promotionPlan.gateChecks.every((entry) => entry.passed),
  },
  {
    name: 'runbook gates remain passed',
    passed: Array.isArray(runbook.gateChecks) && runbook.gateChecks.length > 0 && runbook.gateChecks.every((entry) => entry.passed),
  },
];

const approval = gateChecks.every((entry) => entry.passed) ? 'approved-for-major-staging' : 'hold';
const officialPresets = Array.isArray(runbook.officialPresets) ? runbook.officialPresets : [];
const commandSteps = Array.isArray(runbook.steps) ? runbook.steps.filter((entry) => entry.command) : [];

const markdown = [
  '# One Point Zero Major Release Approval',
  '',
  `- Approval: \`${approval}\``,
  `- Current Version: \`${promotionPlan.currentVersion}\``,
  `- Current Tag: \`${promotionPlan.currentTag}\``,
  `- Next Version: \`${promotionPlan.nextVersion}\``,
  '',
  '## Approval Gates',
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
  '## Major Ship Commands',
  '',
  ...commandSteps.map((entry, index) => `${index + 1}. \`${entry.command}\``),
  '',
  '## Follow-Up',
  '',
  ...(approval === 'approved-for-major-staging'
    ? [
        '1. Review the generated `v1.0.0` checklist one last time and mark it `ready` when human sign-off is complete.',
        '2. Use the runbook commands in order, ending with `pnpm release:ship major`.',
        '3. Treat this approval artifact as the final go/no-go handoff before the first major release tag is cut.',
      ]
    : [
        '1. Do not attempt the first major release until the failed approval gates are corrected.',
        '2. Re-run the decision, promotion-plan, and major-runbook layers after the fixes land.',
      ]),
  '',
].join('\n');

const payload = {
  approval,
  currentVersion: promotionPlan.currentVersion,
  currentTag: promotionPlan.currentTag,
  nextVersion: promotionPlan.nextVersion,
  officialPresets,
  gateChecks,
  commands: commandSteps.map((entry) => entry.command),
  sources: {
    decision: decisionPath,
    promotionPlan: promotionPlanPath,
    runbook: runbookPath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (approval !== 'approved-for-major-staging') {
  console.error('One Point Zero major release approval failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "One Point Zero major release approval written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
