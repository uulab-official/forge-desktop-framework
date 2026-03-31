#!/bin/bash
set -euo pipefail

RELEASE_DIR="${1:-apps/app/release}"
OUTPUT_ROOT="${2:-.release-bundles}"
PLATFORM_LABEL="${3:-unknown}"
ARCH_LABEL="${4:-default}"
EXPECTED_VERSION="${5:-}"

if [[ -z "$EXPECTED_VERSION" ]]; then
  echo "Usage: bash scripts/bundle-release-inventory.sh <release-dir> <output-root> <platform> <arch> <expected-version>"
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
PUBLISH_AUDIT_JSON="$RELEASE_DIR/publish-audit.json"
ROLLBACK_READINESS_JSON="$RELEASE_DIR/rollback-readiness.json"
ROLLBACK_PLAYBOOK_JSON="$RELEASE_DIR/rollback-playbook.json"
CHANNEL_RECOVERY_JSON="$RELEASE_DIR/channel-recovery.json"

for required_file in \
  "$ARTIFACT_SUMMARY_JSON" \
  "$MANIFEST_AUDIT_JSON" \
  "$PUBLISH_AUDIT_JSON" \
  "$ROLLBACK_READINESS_JSON" \
  "$ROLLBACK_PLAYBOOK_JSON" \
  "$CHANNEL_RECOVERY_JSON"
do
  if [[ ! -f "$required_file" ]]; then
    echo "Required inventory bundle input not found: $required_file"
    exit 1
  fi
done

BUNDLE_DIR="$OUTPUT_ROOT/${PLATFORM_LABEL}-${ARCH_LABEL}-v${EXPECTED_VERSION}"
FILES_DIR="$BUNDLE_DIR/files"
SUMMARY_MD="$BUNDLE_DIR/bundle-summary.md"
SUMMARY_JSON="$BUNDLE_DIR/bundle-summary.json"

rm -rf "$BUNDLE_DIR"
mkdir -p "$FILES_DIR"

cp "$RELEASE_DIR"/artifact-summary.md "$FILES_DIR"/
cp "$RELEASE_DIR"/artifact-summary.json "$FILES_DIR"/
cp "$RELEASE_DIR"/manifest-audit.md "$FILES_DIR"/
cp "$RELEASE_DIR"/manifest-audit.json "$FILES_DIR"/
cp "$RELEASE_DIR"/publish-audit.md "$FILES_DIR"/
cp "$RELEASE_DIR"/publish-audit.json "$FILES_DIR"/
cp "$RELEASE_DIR"/rollback-readiness.md "$FILES_DIR"/
cp "$RELEASE_DIR"/rollback-readiness.json "$FILES_DIR"/
cp "$RELEASE_DIR"/rollback-playbook.md "$FILES_DIR"/
cp "$RELEASE_DIR"/rollback-playbook.json "$FILES_DIR"/
cp "$RELEASE_DIR"/channel-recovery.md "$FILES_DIR"/
cp "$RELEASE_DIR"/channel-recovery.json "$FILES_DIR"/

if [[ -f "$RELEASE_DIR/channel-parity.md" && -f "$RELEASE_DIR/channel-parity.json" ]]; then
  cp "$RELEASE_DIR"/channel-parity.md "$FILES_DIR"/
  cp "$RELEASE_DIR"/channel-parity.json "$FILES_DIR"/
fi

find "$RELEASE_DIR" -maxdepth 1 -type f -name 'latest*.yml' -exec cp {} "$FILES_DIR"/ \;

node - "$ARTIFACT_SUMMARY_JSON" "$MANIFEST_AUDIT_JSON" "$ROLLBACK_PLAYBOOK_JSON" "$CHANNEL_RECOVERY_JSON" "$SUMMARY_MD" "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" "$FILES_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [
  artifactSummaryPath,
  manifestAuditPath,
  rollbackPlaybookPath,
  channelRecoveryPath,
  summaryMdPath,
  summaryJsonPath,
  platform,
  arch,
  expectedVersion,
  filesDir,
] = process.argv.slice(2);

const artifactSummary = JSON.parse(fs.readFileSync(artifactSummaryPath, 'utf8'));
const manifestAudit = JSON.parse(fs.readFileSync(manifestAuditPath, 'utf8'));
const rollbackPlaybook = JSON.parse(fs.readFileSync(rollbackPlaybookPath, 'utf8'));
const channelRecovery = JSON.parse(fs.readFileSync(channelRecoveryPath, 'utf8'));

const bundledFiles = fs.readdirSync(filesDir).sort();
const checks = {
  versionMatchesExpected: artifactSummary.version === expectedVersion,
  manifestVersionMatchesExpected: manifestAudit.expectedVersion === expectedVersion,
  rollbackPlaybookPassed: rollbackPlaybook.status === 'passed',
  channelRecoveryPassed: channelRecovery.status === 'passed',
  manifestsBundled: bundledFiles.some((file) => file.startsWith('latest') && file.endsWith('.yml')),
  auditPayloadBundled: bundledFiles.includes('artifact-summary.json') && bundledFiles.includes('channel-recovery.json'),
};
const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# Release Inventory Bundle',
  '',
  `- Platform: \`${platform}\``,
  `- Arch: \`${arch}\``,
  `- Version: \`${expectedVersion}\``,
  `- Status: \`${status}\``,
  `- Files dir: \`${filesDir}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Artifact summary version matches expected | ${checks.versionMatchesExpected} |`,
  `| Manifest audit version matches expected | ${checks.manifestVersionMatchesExpected} |`,
  `| Rollback playbook passed | ${checks.rollbackPlaybookPassed} |`,
  `| Channel recovery passed | ${checks.channelRecoveryPassed} |`,
  `| Updater manifests bundled | ${checks.manifestsBundled} |`,
  `| Core audit payloads bundled | ${checks.auditPayloadBundled} |`,
  '',
  '## Bundled Files',
  '',
  ...bundledFiles.map((file) => `- \`${file}\``),
  '',
].join('\n');

const payload = {
  platform,
  arch,
  version: expectedVersion,
  status,
  checks,
  bundledFiles,
  rollbackChannels: rollbackPlaybook.channels || [],
  recoveryMode: channelRecovery.recoveryMode,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Release inventory bundle failed for ${platform}/${arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release inventory bundle written to:"
echo "  $BUNDLE_DIR"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
