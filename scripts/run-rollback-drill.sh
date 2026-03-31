#!/bin/bash
set -euo pipefail

CURRENT_RELEASE_DIR="${1:-apps/app/release}"
ARCHIVED_RELEASE_DIR="${2:-}"
PLATFORM_LABEL="${3:-unknown}"
ARCH_LABEL="${4:-default}"
CURRENT_VERSION="${5:-}"
ROLLBACK_VERSION="${6:-}"
RECOVERY_MODE="${7:-github-only}"

if [[ -z "$ARCHIVED_RELEASE_DIR" || -z "$CURRENT_VERSION" || -z "$ROLLBACK_VERSION" ]]; then
  echo "Usage: bash scripts/run-rollback-drill.sh <current-release-dir> <archived-release-dir> <platform> <arch> <current-version> <rollback-version> [github-only|dual-channel]"
  exit 1
fi

if [[ "$RECOVERY_MODE" != "github-only" && "$RECOVERY_MODE" != "dual-channel" ]]; then
  echo "Recovery mode must be one of: github-only, dual-channel"
  exit 1
fi

for dir in "$CURRENT_RELEASE_DIR" "$ARCHIVED_RELEASE_DIR"; do
  if [[ ! -d "$dir" ]]; then
    echo "Release directory not found: $dir"
    exit 1
  fi
done

if [[ "$CURRENT_VERSION" == v* ]]; then
  CURRENT_VERSION="${CURRENT_VERSION#v}"
fi

if [[ "$ROLLBACK_VERSION" == v* ]]; then
  ROLLBACK_VERSION="${ROLLBACK_VERSION#v}"
fi

CURRENT_PLAYBOOK_JSON="$CURRENT_RELEASE_DIR/rollback-playbook.json"
CURRENT_RECOVERY_JSON="$CURRENT_RELEASE_DIR/channel-recovery.json"
ARCHIVED_ARTIFACT_JSON="$ARCHIVED_RELEASE_DIR/artifact-summary.json"
ARCHIVED_MANIFEST_JSON="$ARCHIVED_RELEASE_DIR/manifest-audit.json"
ARCHIVED_PARITY_JSON="$ARCHIVED_RELEASE_DIR/channel-parity.json"
SUMMARY_MD="$CURRENT_RELEASE_DIR/rollback-drill.md"
SUMMARY_JSON="$CURRENT_RELEASE_DIR/rollback-drill.json"

for required_file in "$CURRENT_PLAYBOOK_JSON" "$CURRENT_RECOVERY_JSON" "$ARCHIVED_ARTIFACT_JSON" "$ARCHIVED_MANIFEST_JSON"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required rollback drill input not found: $required_file"
    exit 1
  fi
done

node - "$CURRENT_PLAYBOOK_JSON" "$CURRENT_RECOVERY_JSON" "$ARCHIVED_ARTIFACT_JSON" "$ARCHIVED_MANIFEST_JSON" "$ARCHIVED_PARITY_JSON" "$SUMMARY_MD" "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$ROLLBACK_VERSION" "$RECOVERY_MODE" <<'NODE'
const fs = require('node:fs');

const [
  currentPlaybookPath,
  currentRecoveryPath,
  archivedArtifactPath,
  archivedManifestPath,
  archivedParityPath,
  summaryMdPath,
  summaryJsonPath,
  platform,
  arch,
  currentVersion,
  rollbackVersion,
  recoveryMode,
] = process.argv.slice(2);

const currentPlaybook = JSON.parse(fs.readFileSync(currentPlaybookPath, 'utf8'));
const currentRecovery = JSON.parse(fs.readFileSync(currentRecoveryPath, 'utf8'));
const archivedArtifact = JSON.parse(fs.readFileSync(archivedArtifactPath, 'utf8'));
const archivedManifest = JSON.parse(fs.readFileSync(archivedManifestPath, 'utf8'));
const archivedParity = fs.existsSync(archivedParityPath)
  ? JSON.parse(fs.readFileSync(archivedParityPath, 'utf8'))
  : null;

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

const archivedInstallers = (archivedArtifact.artifacts || [])
  .filter((artifact) => artifact.kind === 'installer')
  .map((artifact) => artifact.file)
  .sort();
const currentManifestNames = (currentPlaybook.manifests || [])
  .map((manifest) => manifest.file)
  .sort();
const archivedManifestNames = (archivedManifest.manifests || [])
  .map((manifest) => manifest.file)
  .sort();

const checks = {
  currentPlaybookPassed: currentPlaybook.status === 'passed',
  currentRecoveryPassed:
    currentRecovery.status === 'passed' &&
    currentRecovery.recoveryMode === recoveryMode &&
    currentRecovery.expectedVersion === currentVersion,
  archivedVersionMatchesRollback:
    archivedArtifact.version === rollbackVersion &&
    archivedManifest.expectedVersion === rollbackVersion,
  rollbackVersionIsOlder: compareSemver(rollbackVersion, currentVersion) < 0,
  archivedInstallersPresent: archivedInstallers.length > 0,
  archivedManifestNamesMatchCurrent:
    JSON.stringify(currentManifestNames) === JSON.stringify(archivedManifestNames),
  archivedManifestTargetsExist: (archivedManifest.manifests || []).every((manifest) =>
    archivedInstallers.includes(manifest.path),
  ),
  archivedDualChannelReady:
    recoveryMode === 'dual-channel'
      ? Boolean(archivedParity && archivedParity.status === 'passed')
      : true,
};

const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# Rollback Drill',
  '',
  `- Platform: \`${platform}\``,
  `- Arch: \`${arch}\``,
  `- Current version: \`${currentVersion}\``,
  `- Rollback target version: \`${rollbackVersion}\``,
  `- Recovery mode: \`${recoveryMode}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Current rollback playbook passed | ${checks.currentPlaybookPassed} |`,
  `| Current channel recovery audit passed | ${checks.currentRecoveryPassed} |`,
  `| Archived release matches rollback target | ${checks.archivedVersionMatchesRollback} |`,
  `| Rollback target is older than current version | ${checks.rollbackVersionIsOlder} |`,
  `| Archived installers present | ${checks.archivedInstallersPresent} |`,
  `| Archived manifest names match current playbook | ${checks.archivedManifestNamesMatchCurrent} |`,
  `| Archived manifest targets point at archived installers | ${checks.archivedManifestTargetsExist} |`,
  `| Archived dual-channel metadata is ready | ${checks.archivedDualChannelReady} |`,
  '',
  '## Rollback Target Assets',
  '',
  ...archivedInstallers.map((installer) => `- Installer: \`${installer}\``),
  ...(archivedManifest.manifests || []).map((manifest) => `- Manifest: \`${manifest.file}\` -> \`${manifest.path}\``),
  '',
  '## Drill Outcome',
  '',
  `- The archived \`${rollbackVersion}\` inventory ${(status === 'passed') ? 'can' : 'cannot'} satisfy the generated rollback playbook for \`${currentVersion}\`.`,
  '',
].join('\n');

const payload = {
  platform,
  arch,
  currentVersion,
  rollbackVersion,
  recoveryMode,
  status,
  checks,
  archivedInstallers,
  archivedManifests: archivedManifest.manifests || [],
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Rollback drill failed for ${platform}/${arch} (${recoveryMode})`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Rollback drill written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
