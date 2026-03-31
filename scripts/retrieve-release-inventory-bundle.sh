#!/bin/bash
set -euo pipefail

ARCHIVE_ROOT="${1:-}"
PLATFORM_LABEL="${2:-}"
ARCH_LABEL="${3:-}"
EXPECTED_VERSION="${4:-}"
OUTPUT_DIR="${5:-}"

if [[ -z "$ARCHIVE_ROOT" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" || -z "$EXPECTED_VERSION" ]]; then
  echo "Usage: bash scripts/retrieve-release-inventory-bundle.sh <archive-root> <platform> <arch> <version> [output-dir]"
  exit 1
fi

if [[ ! -d "$ARCHIVE_ROOT" ]]; then
  echo "Archive root not found: $ARCHIVE_ROOT"
  exit 1
fi

if [[ "$EXPECTED_VERSION" == v* ]]; then
  EXPECTED_VERSION="${EXPECTED_VERSION#v}"
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR=".retrieved-release-bundles/${PLATFORM_LABEL}-${ARCH_LABEL}-v${EXPECTED_VERSION}"
fi

MATCHES=()
INDEX_JSON="$ARCHIVE_ROOT/release-bundle-index.json"
if [[ -f "$INDEX_JSON" ]]; then
  INDEX_MATCHES="$(
    node - "$INDEX_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" "$ARCHIVE_ROOT" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [indexPath, platform, arch, version, archiveRoot] = process.argv.slice(2);
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
for (const bundle of index.bundles || []) {
  if (
    bundle.platform === platform &&
    bundle.arch === arch &&
    bundle.version === version &&
    bundle.status === 'passed'
  ) {
    process.stdout.write(`${path.join(archiveRoot, bundle.bundleDir)}\n`);
  }
}
NODE
  )"
  while IFS= read -r match_path; do
    [[ -n "$match_path" ]] && MATCHES+=("$match_path")
  done <<< "$INDEX_MATCHES"
fi

if [[ "${#MATCHES[@]}" -eq 0 ]]; then
  MATCH_FILE="$(mktemp)"
  while IFS= read -r summary_json; do
    node - "$summary_json" "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION" >> "$MATCH_FILE" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [summaryPath, platform, arch, expectedVersion] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

if (
  payload.platform === platform &&
  payload.arch === arch &&
  payload.version === expectedVersion &&
  payload.status === 'passed'
) {
  process.stdout.write(`${path.dirname(summaryPath)}\n`);
}
NODE
  done < <(find "$ARCHIVE_ROOT" -type f -name 'bundle-summary.json' | sort)
  while IFS= read -r match_path; do
    [[ -n "$match_path" ]] && MATCHES+=("$match_path")
  done < "$MATCH_FILE"
  rm -f "$MATCH_FILE"
fi

if [[ "${#MATCHES[@]}" -eq 0 ]]; then
  echo "No matching release inventory bundle found for ${PLATFORM_LABEL}/${ARCH_LABEL} v${EXPECTED_VERSION} under $ARCHIVE_ROOT"
  exit 1
fi

if [[ "${#MATCHES[@]}" -gt 1 ]]; then
  printf 'Ambiguous release inventory bundles found for %s/%s v%s:\n' "$PLATFORM_LABEL" "$ARCH_LABEL" "$EXPECTED_VERSION"
  printf '  %s\n' "${MATCHES[@]}"
  exit 1
fi

SOURCE_BUNDLE_DIR="${MATCHES[0]}"
SOURCE_FILES_DIR="$SOURCE_BUNDLE_DIR/files"

if [[ ! -d "$SOURCE_FILES_DIR" ]]; then
  echo "Matched bundle is missing files directory: $SOURCE_FILES_DIR"
  exit 1
fi

for required_file in \
  "$SOURCE_BUNDLE_DIR/bundle-summary.json" \
  "$SOURCE_FILES_DIR/artifact-summary.json" \
  "$SOURCE_FILES_DIR/manifest-audit.json" \
  "$SOURCE_FILES_DIR/publish-audit.json" \
  "$SOURCE_FILES_DIR/rollback-readiness.json" \
  "$SOURCE_FILES_DIR/rollback-playbook.json" \
  "$SOURCE_FILES_DIR/channel-recovery.json"
do
  if [[ ! -f "$required_file" ]]; then
    echo "Required bundle file missing: $required_file"
    exit 1
  fi
done

rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
cp -R "$SOURCE_BUNDLE_DIR" "$OUTPUT_DIR"

RETRIEVAL_MD="$OUTPUT_DIR/retrieval-summary.md"
RETRIEVAL_JSON="$OUTPUT_DIR/retrieval-summary.json"

node - "$SOURCE_BUNDLE_DIR/bundle-summary.json" "$RETRIEVAL_MD" "$RETRIEVAL_JSON" "$ARCHIVE_ROOT" "$OUTPUT_DIR" <<'NODE'
const fs = require('node:fs');

const [bundleSummaryPath, retrievalMdPath, retrievalJsonPath, archiveRoot, outputDir] = process.argv.slice(2);
const bundleSummary = JSON.parse(fs.readFileSync(bundleSummaryPath, 'utf8'));
const checks = {
  bundlePassed: bundleSummary.status === 'passed',
  filesDirPresent: bundleSummary.bundledFiles.includes('artifact-summary.json'),
};
const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# Release Inventory Retrieval',
  '',
  `- Platform: \`${bundleSummary.platform}\``,
  `- Arch: \`${bundleSummary.arch}\``,
  `- Version: \`${bundleSummary.version}\``,
  `- Status: \`${status}\``,
  `- Archive root: \`${archiveRoot}\``,
  `- Retrieved bundle: \`${outputDir}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Matched bundle passed | ${checks.bundlePassed} |`,
  `| Core inventory files are bundled | ${checks.filesDirPresent} |`,
  '',
].join('\n');

const payload = {
  platform: bundleSummary.platform,
  arch: bundleSummary.arch,
  version: bundleSummary.version,
  status,
  checks,
  archiveRoot,
  outputDir,
};

fs.writeFileSync(retrievalMdPath, `${markdown}\n`);
fs.writeFileSync(retrievalJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`Release inventory retrieval failed for ${bundleSummary.platform}/${bundleSummary.arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$RETRIEVAL_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Retrieved release inventory bundle:"
echo "  $OUTPUT_DIR"
echo "  $RETRIEVAL_MD"
echo "  $RETRIEVAL_JSON"
