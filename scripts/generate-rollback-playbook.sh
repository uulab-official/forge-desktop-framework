#!/bin/bash
set -euo pipefail

RELEASE_DIR="${1:-apps/app/release}"
PLATFORM_LABEL="${2:-unknown}"
ARCH_LABEL="${3:-default}"
EXPECTED_VERSION="${4:-}"

if [[ -z "$EXPECTED_VERSION" ]]; then
  echo "Usage: bash scripts/generate-rollback-playbook.sh <release-dir> <platform> <arch> <expected-version>"
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
CHANNEL_PARITY_JSON="$RELEASE_DIR/channel-parity.json"
SUMMARY_MD="$RELEASE_DIR/rollback-playbook.md"
SUMMARY_JSON="$RELEASE_DIR/rollback-playbook.json"

for required_file in "$ARTIFACT_SUMMARY_JSON" "$MANIFEST_AUDIT_JSON" "$ROLLBACK_READINESS_JSON"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required rollback playbook input not found: $required_file"
    exit 1
  fi
done

node - "$ARTIFACT_SUMMARY_JSON" "$MANIFEST_AUDIT_JSON" "$ROLLBACK_READINESS_JSON" "$CHANNEL_PARITY_JSON" "$SUMMARY_MD" "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" <<'NODE'
const fs = require('node:fs');

const [
  artifactSummaryPath,
  manifestAuditPath,
  rollbackReadinessPath,
  channelParityPath,
  summaryMdPath,
  summaryJsonPath,
  platform,
  arch,
  expectedVersion,
] = process.argv.slice(2);

const artifactSummary = JSON.parse(fs.readFileSync(artifactSummaryPath, 'utf8'));
const manifestAudit = JSON.parse(fs.readFileSync(manifestAuditPath, 'utf8'));
const rollbackReadiness = JSON.parse(fs.readFileSync(rollbackReadinessPath, 'utf8'));
const channelParity = fs.existsSync(channelParityPath)
  ? JSON.parse(fs.readFileSync(channelParityPath, 'utf8'))
  : null;

const installers = (artifactSummary.artifacts || [])
  .filter((artifact) => artifact.kind === 'installer')
  .map((artifact) => artifact.file);
const manifests = (manifestAudit.manifests || []).map((manifest) => ({
  file: manifest.file,
  targetPath: manifest.path,
  version: manifest.version,
}));

const channels = ['github-releases'];
if (channelParity?.status === 'passed') {
  channels.push('s3-or-r2');
}

const checks = {
  versionMatchesExpected: artifactSummary.version === expectedVersion,
  rollbackReadinessPassed: rollbackReadiness.status === 'passed',
  installersPresent: installers.length > 0,
  manifestsPresent: manifests.length > 0,
  channelParityPassedOrSkipped: channelParity ? channelParity.status === 'passed' : true,
};

const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const githubSteps = [
  `Identify the last known-good tag before \`v${expectedVersion}\` for \`${platform}/${arch}\`.`,
  `Download the matching installer set: ${installers.map((installer) => `\`${installer}\``).join(', ')}.`,
  `Download the updater manifests: ${manifests.map((manifest) => `\`${manifest.file}\``).join(', ')}.`,
  'Replace the current GitHub release assets or mark the previous good tag as the rollback target for auto-update clients.',
  'Re-run manifest and artifact audits against the recovered asset set before re-announcing the channel.',
];

const s3Steps = channelParity
  ? [
      `Copy the previous good installers back into \`releases/<good-tag>/\` for \`${platform}/${arch}\`.`,
      `Refresh the \`releases/latest/\` manifests: ${manifests.map((manifest) => `\`${manifest.file}\``).join(', ')}.`,
      'Re-run the channel parity audit to confirm GitHub and S3 publish surfaces point at the same installer names.',
    ]
  : [];

const verifySteps = [
  `Confirm installer filenames still include \`${expectedVersion}\` metadata or the chosen rollback target version.`,
  `Confirm every updater manifest still points at the expected installer path: ${manifests.map((manifest) => `\`${manifest.targetPath}\``).join(', ')}.`,
  'Confirm publish artifact, manifest, and rollback-readiness audits all pass on the recovered files.',
];

const markdown = [
  '# Rollback Execution Playbook',
  '',
  `- Platform: \`${platform}\``,
  `- Arch: \`${arch}\``,
  `- Tagged version: \`${expectedVersion}\``,
  `- Status: \`${status}\``,
  `- Channels covered: ${channels.map((channel) => `\`${channel}\``).join(', ')}`,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Artifact summary version matches expected | ${checks.versionMatchesExpected} |`,
  `| Rollback readiness audit passed | ${checks.rollbackReadinessPassed} |`,
  `| Installer artifacts present | ${checks.installersPresent} |`,
  `| Updater manifests present | ${checks.manifestsPresent} |`,
  `| Channel parity passed or was skipped | ${checks.channelParityPassedOrSkipped} |`,
  '',
  '## Required Assets',
  '',
  ...installers.map((installer) => `- Installer: \`${installer}\``),
  ...manifests.map((manifest) => `- Manifest: \`${manifest.file}\` -> \`${manifest.targetPath}\``),
  '',
  '## GitHub Release Rollback',
  '',
  ...githubSteps.map((step, index) => `${index + 1}. ${step}`),
  '',
  ...(s3Steps.length > 0
    ? [
        '## S3 or R2 Channel Rollback',
        '',
        ...s3Steps.map((step, index) => `${index + 1}. ${step}`),
        '',
      ]
    : []),
  '## Post-Rollback Verification',
  '',
  ...verifySteps.map((step, index) => `${index + 1}. ${step}`),
  '',
].join('\n');

const payload = {
  platform,
  arch,
  expectedVersion,
  status,
  checks,
  channels,
  installers,
  manifests,
  rollbackReadinessStatus: rollbackReadiness.status,
  channelParityStatus: channelParity?.status ?? 'not-run',
  recommendedActions: {
    github: githubSteps,
    s3: s3Steps,
    verify: verifySteps,
  },
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Rollback playbook generation failed for ${platform}/${arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Rollback playbook written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
