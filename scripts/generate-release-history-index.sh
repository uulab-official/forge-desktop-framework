#!/bin/bash
set -euo pipefail

HISTORY_ROOT="${1:-}"
OUTPUT_DIR="${2:-}"

if [[ -z "$HISTORY_ROOT" ]]; then
  echo "Usage: bash scripts/generate-release-history-index.sh <history-root> [output-dir]"
  exit 1
fi

if [[ ! -d "$HISTORY_ROOT" ]]; then
  echo "History root not found: $HISTORY_ROOT"
  exit 1
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$HISTORY_ROOT"
fi

mkdir -p "$OUTPUT_DIR"

INDEX_MD="$OUTPUT_DIR/release-history-index.md"
INDEX_JSON="$OUTPUT_DIR/release-history-index.json"

node - "$HISTORY_ROOT" "$INDEX_MD" "$INDEX_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [historyRoot, indexMdPath, indexJsonPath] = process.argv.slice(2);

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
};

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

const releaseIndexPaths = walk(historyRoot)
  .filter((file) => path.basename(file) === 'release-bundle-index.json')
  .sort();

if (releaseIndexPaths.length === 0) {
  console.error(`No release-bundle-index.json files found under ${historyRoot}`);
  process.exit(1);
}

const releases = releaseIndexPaths.map((releaseIndexPath) => {
  const releaseRoot = path.dirname(releaseIndexPath);
  const provenancePath = path.join(releaseRoot, 'release-provenance.json');
  const matrixSummaryPath = path.join(releaseRoot, 'release-matrix-summary.json');
  const releaseIndex = JSON.parse(fs.readFileSync(releaseIndexPath, 'utf8'));
  const provenance = fs.existsSync(provenancePath)
    ? JSON.parse(fs.readFileSync(provenancePath, 'utf8'))
    : null;
  const matrixSummary = fs.existsSync(matrixSummaryPath)
    ? JSON.parse(fs.readFileSync(matrixSummaryPath, 'utf8'))
    : null;

  const tag = provenance?.tag || path.basename(releaseRoot);
  const normalizedTag = String(tag).startsWith('v') ? String(tag) : `v${tag}`;
  const version = provenance?.version || releaseIndex.bundles?.[0]?.version || normalizedTag.replace(/^v/, '');
  const bundles = (releaseIndex.bundles || []).map((bundle) => ({
    ...bundle,
    tag: normalizedTag,
    releaseVersion: version,
    releaseRoot: path.relative(historyRoot, releaseRoot) || '.',
  }));

  return {
    tag: normalizedTag,
    version,
    commitSha: provenance?.commitSha || null,
    releaseRoot: path.relative(historyRoot, releaseRoot) || '.',
    sourceIndex: path.relative(historyRoot, releaseIndexPath),
    matrixSummaryPresent: Boolean(matrixSummary),
    bundleCount: bundles.length,
    bundles,
  };
});

const flattenedBundles = releases.flatMap((release) => release.bundles);
if (flattenedBundles.length === 0) {
  console.error(`No bundles were found in release indexes under ${historyRoot}`);
  process.exit(1);
}

const latestPerTargetMap = new Map();
const versionsPerTargetMap = new Map();
for (const bundle of flattenedBundles) {
  const key = `${bundle.platform}:${bundle.arch}`;
  const currentLatest = latestPerTargetMap.get(key);
  if (!currentLatest || compareSemver(bundle.version, currentLatest.version) > 0) {
    latestPerTargetMap.set(key, bundle);
  }

  const currentVersions = versionsPerTargetMap.get(key) || [];
  currentVersions.push({
    tag: bundle.tag,
    version: bundle.version,
    status: bundle.status,
    recoveryMode: bundle.recoveryMode,
    rollbackChannels: bundle.rollbackChannels || [],
    releaseRoot: bundle.releaseRoot,
  });
  versionsPerTargetMap.set(key, currentVersions);
}

const latestPerTarget = [...latestPerTargetMap.values()]
  .sort((left, right) => `${left.platform}:${left.arch}`.localeCompare(`${right.platform}:${right.arch}`))
  .map((bundle) => ({
    tag: bundle.tag,
    version: bundle.version,
    platform: bundle.platform,
    arch: bundle.arch,
    status: bundle.status,
    recoveryMode: bundle.recoveryMode,
    releaseRoot: bundle.releaseRoot,
  }));

const versionsPerTarget = [...versionsPerTargetMap.entries()]
  .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  .map(([key, bundles]) => {
    const [platform, arch] = key.split(':');
    return {
      platform,
      arch,
      versions: bundles.sort((left, right) => compareSemver(right.version, left.version)),
    };
  });

const markdown = [
  '# Release History Index',
  '',
  `- History root: \`${historyRoot}\``,
  `- Release roots indexed: \`${releases.length}\``,
  `- Bundles indexed: \`${flattenedBundles.length}\``,
  '',
  '## Releases',
  '',
  '| Tag | Version | Bundles | Matrix Summary | Root |',
  '| --- | --- | --- | --- | --- |',
  ...releases
    .sort((left, right) => compareSemver(right.version, left.version))
    .map((release) =>
      `| \`${release.tag}\` | \`${release.version}\` | ${release.bundleCount} | ${release.matrixSummaryPresent} | \`${release.releaseRoot}\` |`,
    ),
  '',
  '## Latest Per Target',
  '',
  ...latestPerTarget.map((bundle) =>
    `- \`${bundle.platform}/${bundle.arch}\` -> \`${bundle.version}\` from \`${bundle.tag}\` (${bundle.recoveryMode})`,
  ),
  '',
  '## Versions Per Target',
  '',
  ...versionsPerTarget.flatMap((target) => [
    `### ${target.platform}/${target.arch}`,
    '',
    ...target.versions.map((bundle) =>
      `- \`${bundle.version}\` from \`${bundle.tag}\` | status=${bundle.status} | recovery=${bundle.recoveryMode} | channels=${bundle.rollbackChannels.join(', ') || 'none'}`,
    ),
    '',
  ]),
].join('\n');

const payload = {
  historyRoot,
  generatedAt: new Date().toISOString(),
  releases,
  bundles: flattenedBundles,
  latestPerTarget,
  versionsPerTarget,
};

fs.writeFileSync(indexMdPath, `${markdown}\n`);
fs.writeFileSync(indexJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$INDEX_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release history index written to:"
echo "  $INDEX_MD"
echo "  $INDEX_JSON"
