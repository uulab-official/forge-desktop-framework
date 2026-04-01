#!/bin/bash
set -euo pipefail

PROVIDER="${1:-}"
SOURCE="${2:-}"
CURRENT_RELEASE_DIR="${3:-}"
PLATFORM_LABEL="${4:-}"
ARCH_LABEL="${5:-}"
CURRENT_VERSION="${6:-}"
RECOVERY_MODE="${7:-github-only}"
LIMIT="${8:-5}"
CHANNEL_LABEL="${9:-s3}"
HISTORY_ROOT="${10:-}"
OUTPUT_DIR="${11:-}"

if [[ -z "$PROVIDER" || -z "$SOURCE" || -z "$CURRENT_RELEASE_DIR" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" || -z "$CURRENT_VERSION" ]]; then
  echo "Usage: bash scripts/run-remote-release-rollback-drill.sh <github|s3> <repo-or-bucket> <current-release-dir> <platform> <arch> <current-version> [github-only|dual-channel] [limit] [channel] [history-root] [output-dir]"
  exit 1
fi

if [[ "$PROVIDER" != "github" && "$PROVIDER" != "s3" ]]; then
  echo "Provider must be one of: github, s3"
  exit 1
fi

if [[ "$RECOVERY_MODE" != "github-only" && "$RECOVERY_MODE" != "dual-channel" ]]; then
  echo "Recovery mode must be one of: github-only, dual-channel"
  exit 1
fi

if [[ ! -d "$CURRENT_RELEASE_DIR" ]]; then
  echo "Current release directory not found: $CURRENT_RELEASE_DIR"
  exit 1
fi

if [[ "$CURRENT_VERSION" == v* ]]; then
  CURRENT_VERSION="${CURRENT_VERSION#v}"
fi

if [[ -z "$HISTORY_ROOT" ]]; then
  case "$PROVIDER" in
    github)
      HISTORY_ROOT=".fetched-release-history/github-${PLATFORM_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}"
      ;;
    s3)
      HISTORY_ROOT=".fetched-release-history/s3-${PLATFORM_LABEL}-${CHANNEL_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}"
      ;;
  esac
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  case "$PROVIDER" in
    github)
      OUTPUT_DIR=".prepared-rollback-targets/github-${PLATFORM_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}-${RECOVERY_MODE}"
      ;;
    s3)
      OUTPUT_DIR=".prepared-rollback-targets/s3-${PLATFORM_LABEL}-${CHANNEL_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}-${RECOVERY_MODE}"
      ;;
  esac
fi

case "$PROVIDER" in
  github)
    bash scripts/prepare-release-rollback-from-github-history.sh \
      "$SOURCE" \
      "$PLATFORM_LABEL" \
      "$ARCH_LABEL" \
      "$CURRENT_VERSION" \
      "$RECOVERY_MODE" \
      "$LIMIT" \
      "$HISTORY_ROOT" \
      "$OUTPUT_DIR"
    ;;
  s3)
    bash scripts/prepare-release-rollback-from-s3-history.sh \
      "$SOURCE" \
      "$PLATFORM_LABEL" \
      "$ARCH_LABEL" \
      "$CURRENT_VERSION" \
      "$RECOVERY_MODE" \
      "$CHANNEL_LABEL" \
      "$LIMIT" \
      "$HISTORY_ROOT" \
      "$OUTPUT_DIR"
    ;;
esac

PREPARED_JSON="$OUTPUT_DIR/prepared-rollback-target.json"
RETRIEVED_DIR="$OUTPUT_DIR/retrieved-bundle"

if [[ ! -f "$PREPARED_JSON" ]]; then
  echo "Prepared rollback metadata not found: $PREPARED_JSON"
  exit 1
fi

if [[ ! -d "$RETRIEVED_DIR" ]]; then
  echo "Prepared retrieved bundle not found: $RETRIEVED_DIR"
  exit 1
fi

ROLLBACK_VERSION="$(
  node -e "const fs=require('node:fs'); const payload=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(payload.selection && payload.selection.selected ? payload.selection.selected.version : '');" \
    "$PREPARED_JSON"
)"

if [[ -z "$ROLLBACK_VERSION" ]]; then
  echo "Failed to resolve rollback version from $PREPARED_JSON"
  exit 1
fi

bash scripts/run-rollback-drill.sh "$CURRENT_RELEASE_DIR" "$RETRIEVED_DIR" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$ROLLBACK_VERSION" "$RECOVERY_MODE"

SUMMARY_MD="$OUTPUT_DIR/remote-rollback-drill.md"
SUMMARY_JSON="$OUTPUT_DIR/remote-rollback-drill.json"
RECOVERY_SUMMARY_DIR="$OUTPUT_DIR"

node - "$PREPARED_JSON" "$CURRENT_RELEASE_DIR/rollback-drill.json" "$SUMMARY_MD" "$SUMMARY_JSON" "$PROVIDER" "$SOURCE" "$CURRENT_RELEASE_DIR" "$OUTPUT_DIR" "$RECOVERY_MODE" "$HISTORY_ROOT" "$LIMIT" "$CHANNEL_LABEL" <<'NODE'
const fs = require('node:fs');

const [
  preparedJsonPath,
  rollbackDrillJsonPath,
  summaryMdPath,
  summaryJsonPath,
  provider,
  source,
  currentReleaseDir,
  outputDir,
  recoveryMode,
  historyRoot,
  limit,
  channelLabel,
] = process.argv.slice(2);

const prepared = JSON.parse(fs.readFileSync(preparedJsonPath, 'utf8'));
const rollbackDrill = JSON.parse(fs.readFileSync(rollbackDrillJsonPath, 'utf8'));

const checks = {
  preparedTargetPassed: prepared.status === 'passed',
  rollbackDrillPassed: rollbackDrill.status === 'passed',
  selectedVersionMatchesDrill: prepared.selection?.selected?.version === rollbackDrill.rollbackVersion,
};
const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# Remote Rollback Drill',
  '',
  `- Provider: \`${provider}\``,
  `- Source: \`${source}\``,
  `- Current release dir: \`${currentReleaseDir}\``,
  `- Prepared output dir: \`${outputDir}\``,
  `- Target: \`${prepared.selection.platform}/${prepared.selection.arch}\``,
  `- Current version: \`${prepared.selection.currentVersion}\``,
  `- Rollback version: \`${prepared.selection.selected?.version || 'none'}\``,
  `- Recovery mode: \`${prepared.selection.recoveryMode}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Remote history preparation passed | ${checks.preparedTargetPassed} |`,
  `| Rollback drill passed | ${checks.rollbackDrillPassed} |`,
  `| Prepared version matches rollback drill | ${checks.selectedVersionMatchesDrill} |`,
  '',
].join('\n');

const payload = {
  provider,
  source,
  currentReleaseDir,
  outputDir,
  providerOptions: {
    recoveryMode,
    historyRoot,
    limit: Number.parseInt(limit, 10) || null,
    channelLabel,
  },
  status,
  checks,
  prepared,
  rollbackDrill,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Remote rollback drill failed for ${provider}:${source}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Remote rollback drill written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"

bash scripts/generate-recovery-command-summary.sh "$SUMMARY_JSON" "$RECOVERY_SUMMARY_DIR"
