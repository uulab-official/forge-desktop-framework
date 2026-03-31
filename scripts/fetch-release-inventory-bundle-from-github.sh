#!/bin/bash
set -euo pipefail

REPO="${1:-}"
TAG_NAME="${2:-}"
PLATFORM_LABEL="${3:-}"
ARCH_LABEL="${4:-}"
OUTPUT_DIR="${5:-}"
ARCHIVE_ROOT="${6:-}"

if [[ -z "$REPO" || -z "$TAG_NAME" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" ]]; then
  echo "Usage: bash scripts/fetch-release-inventory-bundle-from-github.sh <owner/repo> <tag> <platform> <arch> [output-dir] [archive-root]"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required: gh"
  exit 1
fi

NORMALIZED_TAG="$TAG_NAME"
if [[ "$NORMALIZED_TAG" != v* ]]; then
  NORMALIZED_TAG="v$NORMALIZED_TAG"
fi
EXPECTED_VERSION="${NORMALIZED_TAG#v}"

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR=".retrieved-release-bundles/${PLATFORM_LABEL}-${ARCH_LABEL}-v${EXPECTED_VERSION}"
fi

if [[ -z "$ARCHIVE_ROOT" ]]; then
  ARCHIVE_ROOT=".fetched-release-artifacts/${NORMALIZED_TAG}"
fi

COMMIT_SHA="${FORGE_RELEASE_COMMIT_SHA:-$(
  COMMIT_JSON="$(gh api "repos/$REPO/commits/$NORMALIZED_TAG")"
  node - "$COMMIT_JSON" "$NORMALIZED_TAG" <<'NODE'
const [commitJson, tagName] = process.argv.slice(2);
const payload = JSON.parse(commitJson);
if (!payload.sha) {
  console.error(`Unable to resolve commit SHA for ${tagName}`);
  process.exit(1);
}
process.stdout.write(String(payload.sha));
NODE
)}"

RUN_ID="${FORGE_RELEASE_RUN_ID:-$(
  RUNS_JSON="$(gh api "repos/$REPO/actions/workflows/release.yml/runs?event=push&status=completed&per_page=100")"
  node - "$COMMIT_SHA" "$NORMALIZED_TAG" "$RUNS_JSON" <<'NODE'
const [commitSha, tagName, runsJson] = process.argv.slice(2);
const payload = JSON.parse(runsJson);
const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
const matches = runs
  .filter((run) =>
    run &&
    run.conclusion === 'success' &&
    (run.head_sha === commitSha || run.head_branch === tagName || run.display_title === tagName),
  )
  .sort((left, right) => {
    const leftTime = Date.parse(left.created_at || 0);
    const rightTime = Date.parse(right.created_at || 0);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return (right.run_attempt || 0) - (left.run_attempt || 0);
  });

if (matches.length === 0) {
  console.error(`No successful Release workflow run found for ${tagName} (${commitSha})`);
  process.exit(1);
}

process.stdout.write(String(matches[0].id));
NODE
)}"

rm -rf "$ARCHIVE_ROOT"
mkdir -p "$ARCHIVE_ROOT"
gh run download "$RUN_ID" --repo "$REPO" --dir "$ARCHIVE_ROOT"

MATRIX_DIR="$ARCHIVE_ROOT/release-matrix-summary"
for carried_file in \
  release-matrix-summary.md \
  release-matrix-summary.json \
  release-bundle-index.md \
  release-bundle-index.json \
  release-provenance.md \
  release-provenance.json
do
  if [[ -f "$MATRIX_DIR/$carried_file" ]]; then
    cp "$MATRIX_DIR/$carried_file" "$ARCHIVE_ROOT/$carried_file"
  fi
done

INVENTORY_COUNT="$(find "$ARCHIVE_ROOT" -maxdepth 1 -type d -name 'release-inventory-*' | wc -l | tr -d ' ')"
if [[ "$INVENTORY_COUNT" == "0" ]]; then
  echo "No release-inventory-* artifacts were downloaded into $ARCHIVE_ROOT"
  exit 1
fi

bash scripts/retrieve-release-inventory-bundle.sh "$ARCHIVE_ROOT" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" "$OUTPUT_DIR"

FETCH_MD="$OUTPUT_DIR/fetch-summary.md"
FETCH_JSON="$OUTPUT_DIR/fetch-summary.json"

node - "$FETCH_MD" "$FETCH_JSON" "$REPO" "$NORMALIZED_TAG" "$COMMIT_SHA" "$RUN_ID" "$ARCHIVE_ROOT" "$OUTPUT_DIR" "$INVENTORY_COUNT" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [
  fetchMdPath,
  fetchJsonPath,
  repo,
  tagName,
  commitSha,
  runId,
  archiveRoot,
  outputDir,
  inventoryCount,
] = process.argv.slice(2);

const retrievalSummaryPath = path.join(outputDir, 'retrieval-summary.json');
const retrieval = JSON.parse(fs.readFileSync(retrievalSummaryPath, 'utf8'));
const checks = {
  runResolved: Boolean(runId),
  releaseMatrixSummaryPresent: fs.existsSync(path.join(archiveRoot, 'release-matrix-summary.json')),
  releaseBundleIndexPresent: fs.existsSync(path.join(archiveRoot, 'release-bundle-index.json')),
  inventoryArtifactsDownloaded: Number.parseInt(inventoryCount, 10) > 0,
  retrievedBundlePassed: retrieval.status === 'passed',
};
const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# GitHub Release Bundle Fetch',
  '',
  `- Repo: \`${repo}\``,
  `- Tag: \`${tagName}\``,
  `- Commit: \`${commitSha}\``,
  `- Run ID: \`${runId}\``,
  `- Status: \`${status}\``,
  `- Download root: \`${archiveRoot}\``,
  `- Retrieved bundle: \`${outputDir}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Workflow run resolved | ${checks.runResolved} |`,
  `| Matrix summary artifact available | ${checks.releaseMatrixSummaryPresent} |`,
  `| Bundle index available | ${checks.releaseBundleIndexPresent} |`,
  `| Release inventory artifacts downloaded | ${checks.inventoryArtifactsDownloaded} |`,
  `| Retrieved bundle passed | ${checks.retrievedBundlePassed} |`,
  '',
].join('\n');

const payload = {
  repo,
  tag: tagName,
  commitSha,
  runId,
  status,
  checks,
  archiveRoot,
  outputDir,
  retrievalSummaryPath,
};

fs.writeFileSync(fetchMdPath, `${markdown}\n`);
fs.writeFileSync(fetchJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`GitHub release bundle fetch failed for ${repo} ${tagName}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$FETCH_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Fetched release inventory bundle from GitHub:"
echo "  $OUTPUT_DIR"
echo "  $FETCH_MD"
echo "  $FETCH_JSON"
