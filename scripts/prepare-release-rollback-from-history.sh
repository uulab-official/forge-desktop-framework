#!/bin/bash
set -euo pipefail

HISTORY_ROOT="${1:-}"
PLATFORM_LABEL="${2:-}"
ARCH_LABEL="${3:-}"
CURRENT_VERSION="${4:-}"
RECOVERY_MODE="${5:-github-only}"
OUTPUT_DIR="${6:-}"

if [[ -z "$HISTORY_ROOT" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" || -z "$CURRENT_VERSION" ]]; then
  echo "Usage: bash scripts/prepare-release-rollback-from-history.sh <history-root> <platform> <arch> <current-version> [github-only|dual-channel] [output-dir]"
  exit 1
fi

if [[ "$RECOVERY_MODE" != "github-only" && "$RECOVERY_MODE" != "dual-channel" ]]; then
  echo "Recovery mode must be one of: github-only, dual-channel"
  exit 1
fi

if [[ ! -d "$HISTORY_ROOT" ]]; then
  echo "History root not found: $HISTORY_ROOT"
  exit 1
fi

if [[ "$CURRENT_VERSION" == v* ]]; then
  CURRENT_VERSION="${CURRENT_VERSION#v}"
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR=".prepared-rollback-targets/${PLATFORM_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}-${RECOVERY_MODE}"
fi

HISTORY_INDEX_JSON="$HISTORY_ROOT/release-history-index.json"
if [[ ! -f "$HISTORY_INDEX_JSON" ]]; then
  bash scripts/generate-release-history-index.sh "$HISTORY_ROOT" "$HISTORY_ROOT"
fi

if [[ ! -f "$HISTORY_INDEX_JSON" ]]; then
  echo "Release history index not found under $HISTORY_ROOT"
  exit 1
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

SELECTION_MD="$OUTPUT_DIR/history-rollback-selection.md"
SELECTION_JSON="$OUTPUT_DIR/history-rollback-selection.json"
SELECTION_ENV="$OUTPUT_DIR/history-rollback-selection.env"

node - "$HISTORY_INDEX_JSON" "$SELECTION_MD" "$SELECTION_JSON" "$SELECTION_ENV" "$HISTORY_ROOT" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$RECOVERY_MODE" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [
  indexPath,
  summaryMdPath,
  summaryJsonPath,
  summaryEnvPath,
  historyRoot,
  platform,
  arch,
  currentVersion,
  recoveryMode,
] = process.argv.slice(2);

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

const semverTuple = (value) => String(value).split('.').map((part) => Number.parseInt(part, 10) || 0);
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
const selectedReleaseRoot = selected ? path.join(historyRoot, selected.releaseRoot || '.') : '';

const checks = {
  historyIndexPresent: true,
  requestedTargetPresent: requestedBundles.length > 0,
  previousPassedBundleAvailable: Boolean(selected),
  selectedReleaseRootPresent: selected ? fs.existsSync(selectedReleaseRoot) : false,
};

const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# History Rollback Preparation',
  '',
  `- History root: \`${historyRoot}\``,
  `- Target: \`${platform}/${arch}\``,
  `- Current version: \`${currentVersion}\``,
  `- Recovery mode: \`${recoveryMode}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| History index present | ${checks.historyIndexPresent} |`,
  `| Requested target exists in history | ${checks.requestedTargetPresent} |`,
  `| Previous passed bundle is available | ${checks.previousPassedBundleAvailable} |`,
  `| Selected release root exists | ${checks.selectedReleaseRootPresent} |`,
  '',
  selected
    ? `- Selected rollback target: \`${selected.version}\` from \`${selected.tag}\` (\`${selected.releaseRoot}\`)`
    : '- Selected rollback target: `none`',
  '',
  '## Eligible Candidates',
  '',
  ...(eligibleBundles.length > 0
    ? eligibleBundles.map((bundle) =>
        `- \`${bundle.version}\` from \`${bundle.tag}\` | recovery=${bundle.recoveryMode} | channels=${(bundle.rollbackChannels || []).join(', ') || 'none'} | root=\`${bundle.releaseRoot}\``,
      )
    : ['- No eligible archived bundle matched the requested target and recovery mode.']),
  '',
].join('\n');

const payload = {
  historyRoot,
  platform,
  arch,
  currentVersion,
  recoveryMode,
  status,
  checks,
  selected,
  selectedReleaseRoot: selected ? selectedReleaseRoot : null,
  eligibleBundles,
  requestedBundles,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(
  summaryEnvPath,
  [
    `ROLLBACK_HISTORY_ROOT=${historyRoot}`,
    `ROLLBACK_TARGET_PLATFORM=${platform}`,
    `ROLLBACK_TARGET_ARCH=${arch}`,
    `ROLLBACK_TARGET_CURRENT_VERSION=${currentVersion}`,
    `ROLLBACK_TARGET_RECOVERY_MODE=${recoveryMode}`,
    `ROLLBACK_TARGET_SELECTED_TAG=${selected ? selected.tag : ''}`,
    `ROLLBACK_TARGET_SELECTED_VERSION=${selected ? selected.version : ''}`,
    `ROLLBACK_TARGET_SELECTED_RELEASE_ROOT=${selected ? selectedReleaseRoot : ''}`,
    `ROLLBACK_TARGET_SELECTED_BUNDLE_DIR=${selected ? path.join(historyRoot, selected.bundleDir) : ''}`,
    `ROLLBACK_TARGET_SELECTED_FILES_DIR=${selected ? path.join(historyRoot, selected.filesDir) : ''}`,
  ].join('\n') + '\n',
);

if (!selected) {
  console.error(`No rollback target found in history for ${platform}/${arch} before ${currentVersion} (${recoveryMode})`);
  process.exit(1);
}

if (status !== 'passed') {
  console.error(`Rollback history preparation failed for ${platform}/${arch}`);
  process.exit(1);
}
NODE

SELECTED_VERSION="$(
  node -e "const fs=require('node:fs'); const env=fs.readFileSync(process.argv[1],'utf8'); const line=env.split('\\n').find((entry)=>entry.startsWith('ROLLBACK_TARGET_SELECTED_VERSION=')); process.stdout.write((line || '').split('=')[1] || '');" \
    "$SELECTION_ENV"
)"

SELECTED_RELEASE_ROOT="$(
  node -e "const fs=require('node:fs'); const env=fs.readFileSync(process.argv[1],'utf8'); const line=env.split('\\n').find((entry)=>entry.startsWith('ROLLBACK_TARGET_SELECTED_RELEASE_ROOT=')); process.stdout.write((line || '').split('=')[1] || '');" \
    "$SELECTION_ENV"
)"

if [[ -z "$SELECTED_VERSION" || -z "$SELECTED_RELEASE_ROOT" ]]; then
  echo "Failed to resolve selected rollback target from $SELECTION_ENV"
  exit 1
fi

RETRIEVED_DIR="$OUTPUT_DIR/retrieved-bundle"
bash scripts/retrieve-release-inventory-bundle.sh "$SELECTED_RELEASE_ROOT" "$PLATFORM_LABEL" "$ARCH_LABEL" "$SELECTED_VERSION" "$RETRIEVED_DIR"

PREPARED_MD="$OUTPUT_DIR/prepared-rollback-target.md"
PREPARED_JSON="$OUTPUT_DIR/prepared-rollback-target.json"

node - "$SELECTION_JSON" "$RETRIEVED_DIR/retrieval-summary.json" "$PREPARED_MD" "$PREPARED_JSON" "$OUTPUT_DIR" <<'NODE'
const fs = require('node:fs');

const [selectionJsonPath, retrievalJsonPath, preparedMdPath, preparedJsonPath, outputDir] = process.argv.slice(2);
const selection = JSON.parse(fs.readFileSync(selectionJsonPath, 'utf8'));
const retrieval = JSON.parse(fs.readFileSync(retrievalJsonPath, 'utf8'));

const checks = {
  selectionPassed: selection.status === 'passed',
  retrievalPassed: retrieval.status === 'passed',
  selectedVersionRetrieved: selection.selected?.version === retrieval.version,
};
const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# Prepared Rollback Target',
  '',
  `- Target: \`${selection.platform}/${selection.arch}\``,
  `- Current version: \`${selection.currentVersion}\``,
  `- Recovery mode: \`${selection.recoveryMode}\``,
  `- Selected tag: \`${selection.selected?.tag || 'none'}\``,
  `- Selected version: \`${selection.selected?.version || 'none'}\``,
  `- Selected release root: \`${selection.selectedReleaseRoot || 'none'}\``,
  `- Retrieved bundle: \`${retrieval.outputDir}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| History selection passed | ${checks.selectionPassed} |`,
  `| Bundle retrieval passed | ${checks.retrievalPassed} |`,
  `| Retrieved bundle matches selected version | ${checks.selectedVersionRetrieved} |`,
  '',
  `- Output root: \`${outputDir}\``,
  '',
].join('\n');

const payload = {
  status,
  checks,
  outputDir,
  selection,
  retrieval,
};

fs.writeFileSync(preparedMdPath, `${markdown}\n`);
fs.writeFileSync(preparedJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error('Prepared rollback target failed validation');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$PREPARED_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Prepared rollback target from release history:"
echo "  $PREPARED_MD"
echo "  $PREPARED_JSON"
echo "  $RETRIEVED_DIR"
