#!/bin/bash
set -euo pipefail

ARCHIVE_ROOT="${1:-}"
OUTPUT_DIR="${2:-}"

if [[ -z "$ARCHIVE_ROOT" ]]; then
  echo "Usage: bash scripts/generate-release-bundle-index.sh <archive-root> [output-dir]"
  exit 1
fi

if [[ ! -d "$ARCHIVE_ROOT" ]]; then
  echo "Archive root not found: $ARCHIVE_ROOT"
  exit 1
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$ARCHIVE_ROOT"
fi

mkdir -p "$OUTPUT_DIR"

INDEX_MD="$OUTPUT_DIR/release-bundle-index.md"
INDEX_JSON="$OUTPUT_DIR/release-bundle-index.json"

node - "$ARCHIVE_ROOT" "$INDEX_MD" "$INDEX_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [archiveRoot, indexMdPath, indexJsonPath] = process.argv.slice(2);

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

const summaryPaths = walk(archiveRoot)
  .filter((file) => path.basename(file) === 'bundle-summary.json')
  .sort();

if (summaryPaths.length === 0) {
  console.error(`No bundle-summary.json files found under ${archiveRoot}`);
  process.exit(1);
}

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

const bundles = summaryPaths.map((summaryPath) => {
  const bundleDir = path.dirname(summaryPath);
  const filesDir = path.join(bundleDir, 'files');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const retrievalSummaryPath = path.join(bundleDir, 'retrieval-summary.json');
  const retrieval = fs.existsSync(retrievalSummaryPath)
    ? JSON.parse(fs.readFileSync(retrievalSummaryPath, 'utf8'))
    : null;
  return {
    platform: summary.platform,
    arch: summary.arch,
    version: summary.version,
    status: summary.status,
    recoveryMode: summary.recoveryMode || 'github-only',
    rollbackChannels: summary.rollbackChannels || [],
    bundledFiles: summary.bundledFiles || [],
    bundleDir: path.relative(archiveRoot, bundleDir) || '.',
    filesDir: path.relative(archiveRoot, filesDir),
    hasChannelParity: (summary.bundledFiles || []).includes('channel-parity.json'),
    retrievedAtLeastOnce: Boolean(retrieval),
  };
});

const passedBundles = bundles.filter((bundle) => bundle.status === 'passed');
if (passedBundles.length === 0) {
  console.error(`No passed bundles found under ${archiveRoot}`);
  process.exit(1);
}

const targetMap = new Map();
for (const bundle of bundles) {
  const key = `${bundle.platform}:${bundle.arch}`;
  const current = targetMap.get(key);
  if (!current || compareSemver(bundle.version, current.version) > 0) {
    targetMap.set(key, bundle);
  }
}

const latestPerTarget = [...targetMap.values()].sort((a, b) =>
  `${a.platform}:${a.arch}`.localeCompare(`${b.platform}:${b.arch}`),
);

const markdown = [
  '# Release Bundle Index',
  '',
  `- Archive root: \`${archiveRoot}\``,
  `- Total bundles: \`${bundles.length}\``,
  `- Passed bundles: \`${passedBundles.length}\``,
  '',
  '| Target | Version | Status | Recovery | Files Dir | Channel Parity | Retrieved |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...bundles
    .sort((a, b) => {
      const targetCompare = `${a.platform}:${a.arch}`.localeCompare(`${b.platform}:${b.arch}`);
      if (targetCompare !== 0) return targetCompare;
      return compareSemver(b.version, a.version);
    })
    .map((bundle) =>
      `| \`${bundle.platform}/${bundle.arch}\` | \`${bundle.version}\` | ${bundle.status} | \`${bundle.recoveryMode}\` | \`${bundle.filesDir}\` | ${bundle.hasChannelParity} | ${bundle.retrievedAtLeastOnce} |`,
    ),
  '',
  '## Latest Per Target',
  '',
  ...latestPerTarget.map((bundle) => `- \`${bundle.platform}/${bundle.arch}\` -> \`${bundle.version}\` (${bundle.filesDir})`),
  '',
].join('\n');

const payload = {
  archiveRoot,
  generatedAt: new Date().toISOString(),
  bundles,
  latestPerTarget,
};

fs.writeFileSync(indexMdPath, `${markdown}\n`);
fs.writeFileSync(indexJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$INDEX_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release bundle index written to:"
echo "  $INDEX_MD"
echo "  $INDEX_JSON"
