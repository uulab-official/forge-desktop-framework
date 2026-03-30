#!/bin/bash
set -euo pipefail

RELEASE_DIR="${1:-apps/app/release}"
PLATFORM_LABEL="${2:-unknown}"
ARCH_LABEL="${3:-default}"
EXPECTED_VERSION="${4:-}"
RECOVERY_MODE="${5:-github-only}"

if [[ -z "$EXPECTED_VERSION" ]]; then
  echo "Usage: bash scripts/audit-release-channel-recovery.sh <release-dir> <platform> <arch> <expected-version> [github-only|dual-channel]"
  exit 1
fi

if [[ "$RECOVERY_MODE" != "github-only" && "$RECOVERY_MODE" != "dual-channel" ]]; then
  echo "Recovery mode must be one of: github-only, dual-channel"
  exit 1
fi

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Release directory not found: $RELEASE_DIR"
  exit 1
fi

if [[ "$EXPECTED_VERSION" == v* ]]; then
  EXPECTED_VERSION="${EXPECTED_VERSION#v}"
fi

ARTIFACT_SUMMARY_JSON="$RELEASE_DIR/artifact-summary.json"
MANIFEST_AUDIT_JSON="$RELEASE_DIR/manifest-audit.json"
ROLLBACK_READINESS_JSON="$RELEASE_DIR/rollback-readiness.json"
ROLLBACK_PLAYBOOK_JSON="$RELEASE_DIR/rollback-playbook.json"
CHANNEL_PARITY_JSON="$RELEASE_DIR/channel-parity.json"
SUMMARY_MD="$RELEASE_DIR/channel-recovery.md"
SUMMARY_JSON="$RELEASE_DIR/channel-recovery.json"

for required_file in "$ARTIFACT_SUMMARY_JSON" "$MANIFEST_AUDIT_JSON" "$ROLLBACK_READINESS_JSON" "$ROLLBACK_PLAYBOOK_JSON"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required recovery audit input not found: $required_file"
    exit 1
  fi
done

node - "$ARTIFACT_SUMMARY_JSON" "$MANIFEST_AUDIT_JSON" "$ROLLBACK_READINESS_JSON" "$ROLLBACK_PLAYBOOK_JSON" "$CHANNEL_PARITY_JSON" "$SUMMARY_MD" "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" "$RECOVERY_MODE" <<'NODE'
const fs = require('node:fs');

const [
  artifactSummaryPath,
  manifestAuditPath,
  rollbackReadinessPath,
  rollbackPlaybookPath,
  channelParityPath,
  summaryMdPath,
  summaryJsonPath,
  platform,
  arch,
  expectedVersion,
  recoveryMode,
] = process.argv.slice(2);

const artifactSummary = JSON.parse(fs.readFileSync(artifactSummaryPath, 'utf8'));
const manifestAudit = JSON.parse(fs.readFileSync(manifestAuditPath, 'utf8'));
const rollbackReadiness = JSON.parse(fs.readFileSync(rollbackReadinessPath, 'utf8'));
const rollbackPlaybook = JSON.parse(fs.readFileSync(rollbackPlaybookPath, 'utf8'));
const channelParity = fs.existsSync(channelParityPath)
  ? JSON.parse(fs.readFileSync(channelParityPath, 'utf8'))
  : null;

const installers = (artifactSummary.artifacts || [])
  .filter((artifact) => artifact.kind === 'installer')
  .map((artifact) => artifact.file)
  .sort();
const playbookInstallers = [...(rollbackPlaybook.installers || [])].sort();

const manifests = (manifestAudit.manifests || [])
  .map((manifest) => `${manifest.file}:${manifest.path}`)
  .sort();
const playbookManifests = (rollbackPlaybook.manifests || [])
  .map((manifest) => `${manifest.file}:${manifest.targetPath}`)
  .sort();

const channels = rollbackPlaybook.channels || [];
const hasGithubChannel = channels.includes('github-releases');
const hasS3Channel = channels.includes('s3-or-r2');
const expectsDualChannel = recoveryMode === 'dual-channel';

const checks = {
  versionMatchesExpected:
    artifactSummary.version === expectedVersion &&
    rollbackPlaybook.expectedVersion === expectedVersion,
  rollbackReadinessPassed: rollbackReadiness.status === 'passed',
  rollbackPlaybookPassed: rollbackPlaybook.status === 'passed',
  installerSetMatchesPlaybook: JSON.stringify(installers) === JSON.stringify(playbookInstallers),
  manifestSetMatchesPlaybook: JSON.stringify(manifests) === JSON.stringify(playbookManifests),
  githubChannelPresent: hasGithubChannel,
  s3ChannelMatchesMode: expectsDualChannel ? hasS3Channel : !hasS3Channel,
  channelParityMatchesMode: expectsDualChannel
    ? Boolean(channelParity && channelParity.status === 'passed')
    : !channelParity,
  playbookActionsPresent:
    Array.isArray(rollbackPlaybook.recommendedActions?.github) &&
    rollbackPlaybook.recommendedActions.github.length > 0 &&
    Array.isArray(rollbackPlaybook.recommendedActions?.verify) &&
    rollbackPlaybook.recommendedActions.verify.length > 0 &&
    (expectsDualChannel
      ? Array.isArray(rollbackPlaybook.recommendedActions?.s3) &&
        rollbackPlaybook.recommendedActions.s3.length > 0
      : true),
};

const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# Release Channel Recovery Audit',
  '',
  `- Platform: \`${platform}\``,
  `- Arch: \`${arch}\``,
  `- Tagged version: \`${expectedVersion}\``,
  `- Recovery mode: \`${recoveryMode}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Version matches expected | ${checks.versionMatchesExpected} |`,
  `| Rollback readiness passed | ${checks.rollbackReadinessPassed} |`,
  `| Rollback playbook passed | ${checks.rollbackPlaybookPassed} |`,
  `| Installer set matches playbook | ${checks.installerSetMatchesPlaybook} |`,
  `| Manifest set matches playbook | ${checks.manifestSetMatchesPlaybook} |`,
  `| GitHub recovery channel present | ${checks.githubChannelPresent} |`,
  `| Recovery channels match mode | ${checks.s3ChannelMatchesMode} |`,
  `| Channel parity metadata matches mode | ${checks.channelParityMatchesMode} |`,
  `| Playbook actions present | ${checks.playbookActionsPresent} |`,
  '',
  '## Channels',
  '',
  ...channels.map((channel) => `- \`${channel}\``),
  '',
].join('\n');

const payload = {
  platform,
  arch,
  expectedVersion,
  recoveryMode,
  status,
  checks,
  channels,
  installers,
  manifests: (rollbackPlaybook.manifests || []),
  channelParityStatus: channelParity?.status ?? 'not-run',
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Release channel recovery audit failed for ${platform}/${arch} (${recoveryMode})`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release channel recovery audit written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
