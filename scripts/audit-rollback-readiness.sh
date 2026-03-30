#!/bin/bash
set -euo pipefail

RELEASE_DIR="${1:-apps/app/release}"
PLATFORM_LABEL="${2:-unknown}"
ARCH_LABEL="${3:-default}"
EXPECTED_VERSION="${4:-}"

if [[ -z "$EXPECTED_VERSION" ]]; then
  echo "Usage: bash scripts/audit-rollback-readiness.sh <release-dir> <platform> <arch> <expected-version>"
  exit 1
fi

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Release directory not found: $RELEASE_DIR"
  exit 1
fi

if [[ "$EXPECTED_VERSION" == v* ]]; then
  EXPECTED_VERSION="${EXPECTED_VERSION#v}"
fi

SUMMARY_MD="$RELEASE_DIR/rollback-readiness.md"
SUMMARY_JSON="$RELEASE_DIR/rollback-readiness.json"
ARTIFACT_SUMMARY_JSON="$RELEASE_DIR/artifact-summary.json"
PUBLISH_AUDIT_JSON="$RELEASE_DIR/publish-audit.json"
MANIFEST_AUDIT_JSON="$RELEASE_DIR/manifest-audit.json"

for required_file in "$ARTIFACT_SUMMARY_JSON" "$PUBLISH_AUDIT_JSON" "$MANIFEST_AUDIT_JSON"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required audit file not found: $required_file"
    exit 1
  fi
done

node - "$ARTIFACT_SUMMARY_JSON" "$PUBLISH_AUDIT_JSON" "$MANIFEST_AUDIT_JSON" "$SUMMARY_MD" "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" <<'NODE'
const fs = require('node:fs');

const [
  artifactSummaryPath,
  publishAuditPath,
  manifestAuditPath,
  summaryMdPath,
  summaryJsonPath,
  platform,
  arch,
  expectedVersion,
] = process.argv.slice(2);

const artifactSummary = JSON.parse(fs.readFileSync(artifactSummaryPath, 'utf8'));
const publishAudit = JSON.parse(fs.readFileSync(publishAuditPath, 'utf8'));
const manifestAudit = JSON.parse(fs.readFileSync(manifestAuditPath, 'utf8'));

const installers = (artifactSummary.artifacts || []).filter((artifact) => artifact.kind === 'installer');
const manifests = manifestAudit.manifests || [];

const checks = {
  versionMatchesRelease: artifactSummary.version === expectedVersion,
  installersPresent: installers.length > 0,
  manifestsPresent: manifests.length > 0,
  installerNamesVersioned: installers.length > 0 && installers.every((artifact) => artifact.file.includes(expectedVersion)),
  publishAuditPassed: Boolean(
    publishAudit.checks?.hasExpectedInstaller && publishAudit.checks?.hasManifest,
  ),
  manifestAuditPassed: Boolean(
    manifestAudit.checks?.allVersionsMatch &&
      manifestAudit.checks?.allPathsExist &&
      manifestAudit.checks?.allShaPresent,
  ),
  metadataPresent: true,
};

const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';
const rollbackTargets = manifests.map((manifest) => ({
  manifest: manifest.file,
  targetPath: manifest.path,
  version: manifest.version,
}));

const markdown = [
  '# Rollback Readiness Audit',
  '',
  `- Platform: \`${platform}\``,
  `- Arch: \`${arch}\``,
  `- Expected version: \`${expectedVersion}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Artifact summary version matches release | ${checks.versionMatchesRelease} |`,
  `| Installer artifacts present | ${checks.installersPresent} |`,
  `| Updater manifests present | ${checks.manifestsPresent} |`,
  `| Installer filenames include release version | ${checks.installerNamesVersioned} |`,
  `| Publish audit passed | ${checks.publishAuditPassed} |`,
  `| Manifest audit passed | ${checks.manifestAuditPassed} |`,
  `| Required audit metadata present | ${checks.metadataPresent} |`,
  '',
  '## Rollback Targets',
  '',
  ...rollbackTargets.map((target) => `- \`${target.manifest}\` -> \`${target.targetPath}\` (${target.version})`),
  '',
].join('\n');

const payload = {
  platform,
  arch,
  expectedVersion,
  status,
  checks,
  installers: installers.map((artifact) => artifact.file),
  rollbackTargets,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Rollback readiness failed for ${platform}/${arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Rollback readiness audit written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
