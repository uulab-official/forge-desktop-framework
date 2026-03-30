#!/bin/bash
set -euo pipefail

RELEASE_DIR="${1:-apps/app/release}"
PLATFORM_LABEL="${2:-unknown}"
ARCH_LABEL="${3:-default}"
EXPECTED_VERSION="${4:-}"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Release directory not found: $RELEASE_DIR"
  exit 1
fi

if [[ -z "$EXPECTED_VERSION" ]]; then
  APP_DIR="$(cd "$RELEASE_DIR/.." && pwd)"
  EXPECTED_VERSION="$(node -p "require('$APP_DIR/package.json').version")"
fi

SUMMARY_MD="$RELEASE_DIR/manifest-audit.md"
SUMMARY_JSON="$RELEASE_DIR/manifest-audit.json"

node - "$RELEASE_DIR" "$SUMMARY_MD" "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [releaseDir, summaryMdPath, summaryJsonPath, platform, arch, expectedVersion] = process.argv.slice(2);
const normalizedExpectedVersion = expectedVersion.startsWith('v') ? expectedVersion.slice(1) : expectedVersion;
const manifestFiles = fs
  .readdirSync(releaseDir)
  .filter((file) => /^latest.*\.yml$/.test(file))
  .sort();

if (manifestFiles.length === 0) {
  console.error(`No latest*.yml manifest files found in ${releaseDir}`);
  process.exit(1);
}

const manifests = manifestFiles.map((file) => {
  const raw = fs.readFileSync(path.join(releaseDir, file), 'utf8');
  const version = raw.match(/^version:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const targetPath = raw.match(/^path:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const sha512 = raw.match(/^sha512:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const pathExists = targetPath !== '' && fs.existsSync(path.join(releaseDir, targetPath));
  return {
    file,
    version,
    path: targetPath,
    sha512Present: sha512 !== '',
    versionMatches: version === normalizedExpectedVersion,
    pathExists,
  };
});

const checks = {
  allVersionsMatch: manifests.every((manifest) => manifest.versionMatches),
  allPathsExist: manifests.every((manifest) => manifest.pathExists),
  allShaPresent: manifests.every((manifest) => manifest.sha512Present),
};

const markdown = [
  '# Release Manifest Audit',
  '',
  `- Platform: \`${platform}\``,
  `- Arch: \`${arch}\``,
  `- Expected version: \`${normalizedExpectedVersion}\``,
  `- Release dir: \`${releaseDir}\``,
  '',
  '| Manifest | Version | Version Match | Path | Path Exists | sha512 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...manifests.map((manifest) => `| \`${manifest.file}\` | \`${manifest.version || 'missing'}\` | ${manifest.versionMatches} | \`${manifest.path || 'missing'}\` | ${manifest.pathExists} | ${manifest.sha512Present} |`),
  '',
  '## Checks',
  '',
  `- All versions match: ${checks.allVersionsMatch}`,
  `- All paths exist: ${checks.allPathsExist}`,
  `- All sha512 fields exist: ${checks.allShaPresent}`,
  '',
].join('\n');

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(
  summaryJsonPath,
  `${JSON.stringify(
    {
      platform,
      arch,
      expectedVersion: normalizedExpectedVersion,
      manifests,
      checks,
    },
    null,
    2,
  )}\n`,
);

if (!checks.allVersionsMatch || !checks.allPathsExist || !checks.allShaPresent) {
  console.error(`Release manifest audit failed for ${platform}/${arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release manifest audit written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
