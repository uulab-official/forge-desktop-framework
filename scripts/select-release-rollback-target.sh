#!/bin/bash
set -euo pipefail

ARCHIVE_ROOT="${1:-}"
PLATFORM_LABEL="${2:-}"
ARCH_LABEL="${3:-}"
CURRENT_VERSION="${4:-}"
RECOVERY_MODE="${5:-github-only}"
OUTPUT_DIR="${6:-}"

if [[ -z "$ARCHIVE_ROOT" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" || -z "$CURRENT_VERSION" ]]; then
  echo "Usage: bash scripts/select-release-rollback-target.sh <archive-root> <platform> <arch> <current-version> [github-only|dual-channel] [output-dir]"
  exit 1
fi

if [[ "$RECOVERY_MODE" != "github-only" && "$RECOVERY_MODE" != "dual-channel" ]]; then
  echo "Recovery mode must be one of: github-only, dual-channel"
  exit 1
fi

if [[ ! -d "$ARCHIVE_ROOT" ]]; then
  echo "Archive root not found: $ARCHIVE_ROOT"
  exit 1
fi

if [[ "$CURRENT_VERSION" == v* ]]; then
  CURRENT_VERSION="${CURRENT_VERSION#v}"
fi

INDEX_JSON="$ARCHIVE_ROOT/release-bundle-index.json"
if [[ ! -f "$INDEX_JSON" ]]; then
  bash scripts/generate-release-bundle-index.sh "$ARCHIVE_ROOT" "$ARCHIVE_ROOT"
fi

if [[ ! -f "$INDEX_JSON" ]]; then
  echo "Release bundle index not found under $ARCHIVE_ROOT"
  exit 1
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR=".selected-rollback-targets/${PLATFORM_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}-${RECOVERY_MODE}"
fi

mkdir -p "$OUTPUT_DIR"

SUMMARY_MD="$OUTPUT_DIR/rollback-target-selection.md"
SUMMARY_JSON="$OUTPUT_DIR/rollback-target-selection.json"
SUMMARY_ENV="$OUTPUT_DIR/rollback-target-selection.env"

node - "$INDEX_JSON" "$SUMMARY_MD" "$SUMMARY_JSON" "$SUMMARY_ENV" "$ARCHIVE_ROOT" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$RECOVERY_MODE" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [
  indexPath,
  summaryMdPath,
  summaryJsonPath,
  summaryEnvPath,
  archiveRoot,
  platform,
  arch,
  currentVersion,
  recoveryMode,
] = process.argv.slice(2);

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

const semverTuple = (value) => value.split('.').map((part) => Number.parseInt(part, 10) || 0);
const compareSemver = (left, right) => {
  const a = semverTuple(left);
  const b = semverTuple(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

const requiredChannels = recoveryMode === 'dual-channel'
  ? ['github-releases', 's3-or-r2']
  : ['github-releases'];

const requestedBundles = (index.bundles || [])
  .filter((bundle) => bundle.platform === platform && bundle.arch === arch)
  .sort((left, right) => compareSemver(right.version, left.version));

const eligibleBundles = requestedBundles.filter((bundle) => {
  if (bundle.status !== 'passed') return false;
  if (compareSemver(bundle.version, currentVersion) >= 0) return false;
  const channels = Array.isArray(bundle.rollbackChannels) ? bundle.rollbackChannels : [];
  if (!requiredChannels.every((channel) => channels.includes(channel))) return false;
  if (recoveryMode === 'dual-channel' && (!bundle.hasChannelParity || bundle.recoveryMode !== 'dual-channel')) {
    return false;
  }
  return true;
});

const selected = eligibleBundles[0] || null;

const checks = {
  bundleIndexPresent: true,
  requestedTargetPresent: requestedBundles.length > 0,
  previousPassedBundleAvailable: Boolean(selected),
  recoveryModeCompatible: Boolean(selected),
};

const status = selected ? 'passed' : 'failed';

const markdown = [
  '# Rollback Target Selection',
  '',
  `- Archive root: \`${archiveRoot}\``,
  `- Target: \`${platform}/${arch}\``,
  `- Current version: \`${currentVersion}\``,
  `- Recovery mode: \`${recoveryMode}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Bundle index present | ${checks.bundleIndexPresent} |`,
  `| Requested target exists in archive index | ${checks.requestedTargetPresent} |`,
  `| Previous passed bundle is available | ${checks.previousPassedBundleAvailable} |`,
  `| Previous bundle matches requested recovery mode | ${checks.recoveryModeCompatible} |`,
  '',
  selected
    ? `- Selected rollback target: \`${selected.version}\` from \`${selected.bundleDir}\``
    : '- Selected rollback target: `none`',
  '',
  '## Eligible Candidates',
  '',
  ...(eligibleBundles.length > 0
    ? eligibleBundles.map((bundle) =>
        `- \`${bundle.version}\` -> \`${bundle.bundleDir}\` (${bundle.recoveryMode}, channels: ${(bundle.rollbackChannels || []).join(', ') || 'none'})`,
      )
    : ['- No eligible archived bundle matched the requested target and recovery mode.']),
  '',
  '## Indexed Bundles For Target',
  '',
  ...(requestedBundles.length > 0
    ? requestedBundles.map((bundle) =>
        `- \`${bundle.version}\` | status=${bundle.status} | recovery=${bundle.recoveryMode} | parity=${bundle.hasChannelParity} | channels=${(bundle.rollbackChannels || []).join(', ') || 'none'}`,
      )
    : ['- No bundles were indexed for this target.']),
  '',
].join('\n');

const payload = {
  archiveRoot,
  platform,
  arch,
  currentVersion,
  recoveryMode,
  status,
  checks,
  selected,
  eligibleBundles,
  requestedBundles,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(
  summaryEnvPath,
  [
    `ROLLBACK_TARGET_PLATFORM=${platform}`,
    `ROLLBACK_TARGET_ARCH=${arch}`,
    `ROLLBACK_TARGET_CURRENT_VERSION=${currentVersion}`,
    `ROLLBACK_TARGET_RECOVERY_MODE=${recoveryMode}`,
    `ROLLBACK_TARGET_SELECTED_VERSION=${selected ? selected.version : ''}`,
    `ROLLBACK_TARGET_SELECTED_BUNDLE_DIR=${selected ? path.join(archiveRoot, selected.bundleDir) : ''}`,
    `ROLLBACK_TARGET_SELECTED_FILES_DIR=${selected ? path.join(archiveRoot, selected.filesDir) : ''}`,
  ].join('\n') + '\n',
);

if (!selected) {
  console.error(`No rollback target found for ${platform}/${arch} before ${currentVersion} (${recoveryMode})`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Rollback target selection written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
echo "  $SUMMARY_ENV"
