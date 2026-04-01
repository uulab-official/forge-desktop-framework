#!/bin/bash
set -euo pipefail

REMOTE_DRILL_JSON="${1:-}"
OUTPUT_DIR="${2:-}"

if [[ -z "$REMOTE_DRILL_JSON" ]]; then
  echo "Usage: bash scripts/generate-recovery-command-summary.sh <remote-rollback-drill.json> [output-dir]"
  exit 1
fi

if [[ ! -f "$REMOTE_DRILL_JSON" ]]; then
  echo "Remote rollback drill payload not found: $REMOTE_DRILL_JSON"
  exit 1
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$(cd "$(dirname "$REMOTE_DRILL_JSON")" && pwd)"
fi

mkdir -p "$OUTPUT_DIR"

SUMMARY_MD="$OUTPUT_DIR/recovery-command-summary.md"
SUMMARY_JSON="$OUTPUT_DIR/recovery-command-summary.json"

node - "$REMOTE_DRILL_JSON" "$SUMMARY_MD" "$SUMMARY_JSON" <<'NODE'
const fs = require('node:fs');

const [remoteDrillPath, summaryMdPath, summaryJsonPath] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(remoteDrillPath, 'utf8'));

const provider = payload.provider;
const source = payload.source;
const currentReleaseDir = payload.currentReleaseDir;
const outputDir = payload.outputDir;
const prepared = payload.prepared || {};
const selection = prepared.selection || {};
const selected = selection.selected || {};
const retrieval = prepared.retrieval || {};
const rollbackDrill = payload.rollbackDrill || {};

const providerOptions = payload.providerOptions || {};
const recoveryMode = selection.recoveryMode || providerOptions.recoveryMode || 'github-only';
const currentVersion = selection.currentVersion || rollbackDrill.currentVersion || '';
const rollbackVersion = selected.version || rollbackDrill.rollbackVersion || '';
const platform = selection.platform || rollbackDrill.platform || 'unknown';
const arch = selection.arch || rollbackDrill.arch || 'default';
const historyRoot = providerOptions.historyRoot || prepared.historyRoot || '';
const limit = providerOptions.limit || '';
const channelLabel = providerOptions.channelLabel || '';
const retrievedDir = retrieval.outputDir || `${outputDir}/retrieved-bundle`;
const selectedReleaseRoot = prepared.selection?.selectedReleaseRoot || '';
const rollbackChannels = selected.rollbackChannels || [];
const installers = rollbackDrill.archivedInstallers || [];
const manifests = rollbackDrill.archivedManifests || [];

const rerunArgs = [
  provider,
  source,
  currentReleaseDir,
  platform.replace(/-s3$/, ''),
  arch,
  currentVersion,
  recoveryMode,
];

if (provider === 's3') {
  rerunArgs.push(String(limit || 5));
  rerunArgs.push(channelLabel || 's3');
} else {
  rerunArgs.push(String(limit || 5));
}

const shellQuote = (value) => {
  const stringValue = String(value);
  if (/^[A-Za-z0-9_./:@-]+$/.test(stringValue)) {
    return stringValue;
  }
  return `'${stringValue.replace(/'/g, `'\\''`)}'`;
};

const rerunCommand = `bash scripts/run-remote-release-rollback-drill.sh ${rerunArgs.map(shellQuote).join(' ')}`;

const checks = {
  remoteDrillPassed: payload.status === 'passed',
  selectedRollbackVersionPresent: Boolean(rollbackVersion),
  retrievedBundlePresent: retrieval.status === 'passed',
  archivedAssetsPresent: installers.length > 0 && manifests.length > 0,
  recoveryChannelsResolved: recoveryMode === 'dual-channel'
    ? rollbackChannels.includes('github-releases') && rollbackChannels.includes('s3-or-r2')
    : rollbackChannels.includes('github-releases'),
};

const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const recommendedActions = [
  `Re-run the full remote recovery flow if you need to reproduce the exact selection: \`${rerunCommand}\`.`,
  `Inspect the prepared rollback target metadata at \`${outputDir}/prepared-rollback-target.json\` before touching any live channel.`,
  `Inspect the retrieved archived bundle under \`${retrievedDir}\` and confirm the installers/manifests listed below are the intended rollback assets.`,
  recoveryMode === 'dual-channel'
    ? `Apply the recovered \`${rollbackVersion}\` inventory to both GitHub release assets and the mirrored object-storage channel before reopening auto-update traffic.`
    : `Apply the recovered \`${rollbackVersion}\` inventory to the GitHub release channel before reopening auto-update traffic.`,
  `Keep \`${currentReleaseDir}/rollback-drill.json\` and \`${summaryJsonPath}\` with the incident notes so the recovery attempt remains auditable.`,
];

const markdown = [
  '# Recovery Command Summary',
  '',
  `- Provider: \`${provider}\``,
  `- Source: \`${source}\``,
  `- Target: \`${platform}/${arch}\``,
  `- Current version: \`${currentVersion}\``,
  `- Rollback version: \`${rollbackVersion || 'none'}\``,
  `- Recovery mode: \`${recoveryMode}\``,
  `- Remote drill status: \`${status}\``,
  `- History root: \`${historyRoot || 'n/a'}\``,
  `- Selected release root: \`${selectedReleaseRoot || 'n/a'}\``,
  `- Retrieved bundle: \`${retrievedDir}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Remote rollback drill passed | ${checks.remoteDrillPassed} |`,
  `| Rollback version resolved | ${checks.selectedRollbackVersionPresent} |`,
  `| Retrieved bundle passed validation | ${checks.retrievedBundlePresent} |`,
  `| Archived assets are present | ${checks.archivedAssetsPresent} |`,
  `| Recovery channels match requested mode | ${checks.recoveryChannelsResolved} |`,
  '',
  '## Reproduction Command',
  '',
  '```bash',
  rerunCommand,
  '```',
  '',
  '## Recommended Actions',
  '',
  ...recommendedActions.map((action, index) => `${index + 1}. ${action}`),
  '',
  '## Archived Assets',
  '',
  ...installers.map((installer) => `- Installer: \`${installer}\``),
  ...manifests.map((manifest) => `- Manifest: \`${manifest.file}\` -> \`${manifest.targetPath}\``),
  '',
].join('\n');

const summaryPayload = {
  provider,
  source,
  platform,
  arch,
  currentVersion,
  rollbackVersion,
  recoveryMode,
  status,
  checks,
  historyRoot,
  selectedReleaseRoot,
  retrievedDir,
  rerunCommand,
  rollbackChannels,
  installers,
  manifests,
  recommendedActions,
  remoteRollbackDrillPath: remoteDrillPath,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(summaryPayload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Recovery command summary failed for ${provider}:${source}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Recovery command summary written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
