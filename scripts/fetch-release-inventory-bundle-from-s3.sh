#!/bin/bash
set -euo pipefail

S3_BUCKET="${1:-}"
TAG_NAME="${2:-}"
PLATFORM_LABEL="${3:-}"
ARCH_LABEL="${4:-}"
CHANNEL_LABEL="${5:-s3}"
OUTPUT_DIR="${6:-}"
ARCHIVE_ROOT="${7:-}"

if [[ -z "$S3_BUCKET" || -z "$TAG_NAME" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" ]]; then
  echo "Usage: bash scripts/fetch-release-inventory-bundle-from-s3.sh <bucket> <tag> <platform> <arch> [channel] [output-dir] [archive-root]"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required: aws"
  exit 1
fi

if [[ "$CHANNEL_LABEL" != "s3" && "$CHANNEL_LABEL" != "github" ]]; then
  echo "Channel must be one of: s3, github"
  exit 1
fi

NORMALIZED_TAG="$TAG_NAME"
if [[ "$NORMALIZED_TAG" != v* ]]; then
  NORMALIZED_TAG="v$NORMALIZED_TAG"
fi
EXPECTED_VERSION="${NORMALIZED_TAG#v}"

MATCH_PLATFORM_LABEL="$PLATFORM_LABEL"
if [[ "$CHANNEL_LABEL" == "s3" ]]; then
  MATCH_PLATFORM_LABEL="${PLATFORM_LABEL}-s3"
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR=".retrieved-release-bundles/${PLATFORM_LABEL}-${CHANNEL_LABEL}-${ARCH_LABEL}-v${EXPECTED_VERSION}"
fi

if [[ -z "$ARCHIVE_ROOT" ]]; then
  ARCHIVE_ROOT=".fetched-release-artifacts/s3-${NORMALIZED_TAG}"
fi

rm -rf "$ARCHIVE_ROOT"
mkdir -p "$ARCHIVE_ROOT"
HISTORY_ROOT="$(dirname "$ARCHIVE_ROOT")"

AWS_SYNC_ARGS=(
  s3
  sync
  "s3://$S3_BUCKET/release-bundles/$NORMALIZED_TAG/"
  "$ARCHIVE_ROOT"
)

if [[ -n "${S3_ENDPOINT:-}" ]]; then
  AWS_SYNC_ARGS+=(--endpoint-url "$S3_ENDPOINT")
fi

aws "${AWS_SYNC_ARGS[@]}"

BUNDLE_COUNT="$(find "$ARCHIVE_ROOT" -type f -name 'bundle-summary.json' | wc -l | tr -d ' ')"
if [[ "$BUNDLE_COUNT" == "0" ]]; then
  echo "No archived release bundles were downloaded into $ARCHIVE_ROOT from s3://$S3_BUCKET/release-bundles/$NORMALIZED_TAG/"
  exit 1
fi

if [[ ! -f "$ARCHIVE_ROOT/release-bundle-index.json" ]]; then
  bash scripts/generate-release-bundle-index.sh "$ARCHIVE_ROOT" "$ARCHIVE_ROOT"
fi

bash scripts/generate-release-history-index.sh "$HISTORY_ROOT" "$HISTORY_ROOT"

bash scripts/retrieve-release-inventory-bundle.sh "$ARCHIVE_ROOT" "$MATCH_PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" "$OUTPUT_DIR"

FETCH_MD="$OUTPUT_DIR/s3-fetch-summary.md"
FETCH_JSON="$OUTPUT_DIR/s3-fetch-summary.json"

node - "$FETCH_MD" "$FETCH_JSON" "$S3_BUCKET" "$NORMALIZED_TAG" "$PLATFORM_LABEL" "$MATCH_PLATFORM_LABEL" "$ARCH_LABEL" "$CHANNEL_LABEL" "$ARCHIVE_ROOT" "$OUTPUT_DIR" "$BUNDLE_COUNT" "${S3_ENDPOINT:-}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [
  fetchMdPath,
  fetchJsonPath,
  bucket,
  tagName,
  requestedPlatform,
  matchedPlatform,
  arch,
  channel,
  archiveRoot,
  outputDir,
  bundleCount,
  endpoint,
] = process.argv.slice(2);

const retrievalSummaryPath = path.join(outputDir, 'retrieval-summary.json');
const retrieval = JSON.parse(fs.readFileSync(retrievalSummaryPath, 'utf8'));
const checks = {
  bundlesDownloaded: Number.parseInt(bundleCount, 10) > 0,
  releaseBundleIndexPresent: fs.existsSync(path.join(archiveRoot, 'release-bundle-index.json')),
  releaseMatrixSummaryPresent: fs.existsSync(path.join(archiveRoot, 'release-matrix-summary.json')),
  releaseHistoryIndexPresent: fs.existsSync(path.join(path.dirname(archiveRoot), 'release-history-index.json')),
  retrievedBundlePassed: retrieval.status === 'passed',
};
const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# S3 Release Bundle Fetch',
  '',
  `- Bucket: \`${bucket}\``,
  `- Tag: \`${tagName}\``,
  `- Channel: \`${channel}\``,
  `- Requested target: \`${requestedPlatform}/${arch}\``,
  `- Matched bundle platform: \`${matchedPlatform}/${arch}\``,
  `- Status: \`${status}\``,
  `- Download root: \`${archiveRoot}\``,
  `- Retrieved bundle: \`${outputDir}\``,
  endpoint ? `- Endpoint: \`${endpoint}\`` : '- Endpoint: `default AWS endpoint`',
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Archived bundles downloaded | ${checks.bundlesDownloaded} |`,
  `| Bundle index available | ${checks.releaseBundleIndexPresent} |`,
  `| Matrix summary mirrored | ${checks.releaseMatrixSummaryPresent} |`,
  `| History index available | ${checks.releaseHistoryIndexPresent} |`,
  `| Retrieved bundle passed | ${checks.retrievedBundlePassed} |`,
  '',
].join('\n');

const payload = {
  bucket,
  tag: tagName,
  channel,
  requestedPlatform,
  matchedPlatform,
  arch,
  status,
  checks,
  archiveRoot,
  outputDir,
  endpoint: endpoint || null,
  retrievalSummaryPath,
};

fs.writeFileSync(fetchMdPath, `${markdown}\n`);
fs.writeFileSync(fetchJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`S3 release bundle fetch failed for ${bucket} ${tagName} ${matchedPlatform}/${arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$FETCH_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Fetched release inventory bundle from S3:"
echo "  $OUTPUT_DIR"
echo "  $FETCH_MD"
echo "  $FETCH_JSON"
