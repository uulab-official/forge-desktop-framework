#!/bin/bash
set -euo pipefail

PRIMARY_RELEASE_DIR="${1:-}"
SECONDARY_RELEASE_DIR="${2:-}"
PLATFORM_LABEL="${3:-unknown}"
ARCH_LABEL="${4:-default}"
EXPECTED_VERSION="${5:-}"

if [[ -z "$PRIMARY_RELEASE_DIR" || -z "$SECONDARY_RELEASE_DIR" || -z "$EXPECTED_VERSION" ]]; then
  echo "Usage: bash scripts/audit-publish-channel-parity.sh <primary-release-dir> <secondary-release-dir> <platform> <arch> <expected-version>"
  exit 1
fi

if [[ "$EXPECTED_VERSION" == v* ]]; then
  EXPECTED_VERSION="${EXPECTED_VERSION#v}"
fi

for dir in "$PRIMARY_RELEASE_DIR" "$SECONDARY_RELEASE_DIR"; do
  if [[ ! -d "$dir" ]]; then
    echo "Release directory not found: $dir"
    exit 1
  fi
done

OUTPUT_DIR="$SECONDARY_RELEASE_DIR"
SUMMARY_MD="$OUTPUT_DIR/channel-parity.md"
SUMMARY_JSON="$OUTPUT_DIR/channel-parity.json"

node - "$PRIMARY_RELEASE_DIR" "$SECONDARY_RELEASE_DIR" "$SUMMARY_MD" "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [
  primaryReleaseDir,
  secondaryReleaseDir,
  summaryMdPath,
  summaryJsonPath,
  platform,
  arch,
  expectedVersion,
] = process.argv.slice(2);

const loadArtifacts = (releaseDir) => {
  const summary = JSON.parse(fs.readFileSync(path.join(releaseDir, 'artifact-summary.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest-audit.json'), 'utf8'));
  return {
    version: summary.version,
    installers: summary.artifacts.filter((artifact) => artifact.kind === 'installer').map((artifact) => artifact.file).sort(),
    manifests: manifest.manifests.map((item) => ({ file: item.file, version: item.version, path: item.path })).sort((a, b) => a.file.localeCompare(b.file)),
  };
};

const primary = loadArtifacts(primaryReleaseDir);
const secondary = loadArtifacts(secondaryReleaseDir);

const manifestFilesEqual =
  JSON.stringify(primary.manifests.map((item) => item.file)) === JSON.stringify(secondary.manifests.map((item) => item.file));
const manifestPathsEqual =
  JSON.stringify(primary.manifests.map((item) => item.path)) === JSON.stringify(secondary.manifests.map((item) => item.path));
const installerSetEqual = JSON.stringify(primary.installers) === JSON.stringify(secondary.installers);

const checks = {
  primaryVersionMatchesExpected: primary.version === expectedVersion,
  secondaryVersionMatchesExpected: secondary.version === expectedVersion,
  installerSetEqual,
  manifestFilesEqual,
  manifestPathsEqual,
};

const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# Publish Channel Parity Audit',
  '',
  `- Platform: \`${platform}\``,
  `- Arch: \`${arch}\``,
  `- Expected version: \`${expectedVersion}\``,
  `- Primary release dir: \`${primaryReleaseDir}\``,
  `- Secondary release dir: \`${secondaryReleaseDir}\``,
  `- Status: \`${status}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Primary version matches expected | ${checks.primaryVersionMatchesExpected} |`,
  `| Secondary version matches expected | ${checks.secondaryVersionMatchesExpected} |`,
  `| Installer filenames match | ${checks.installerSetEqual} |`,
  `| Manifest filenames match | ${checks.manifestFilesEqual} |`,
  `| Manifest target paths match | ${checks.manifestPathsEqual} |`,
  '',
].join('\n');

const payload = {
  platform,
  arch,
  expectedVersion,
  status,
  checks,
  primary,
  secondary,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Publish channel parity failed for ${platform}/${arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Publish channel parity audit written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
