#!/bin/bash
set -euo pipefail

MATRIX_SUMMARY_JSON="${1:-.release-matrix/release-matrix-summary.json}"
OUTPUT_DIR="${2:-.release-matrix}"
GIT_TAG="${3:-}"
GIT_SHA="${4:-}"

if [[ -z "$GIT_TAG" || -z "$GIT_SHA" ]]; then
  echo "Usage: bash scripts/generate-release-provenance.sh <matrix-summary-json> [output-dir] <git-tag> <git-sha>"
  exit 1
fi

if [[ ! -f "$MATRIX_SUMMARY_JSON" ]]; then
  echo "Release matrix summary JSON not found: $MATRIX_SUMMARY_JSON"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/release-provenance.md"
OUTPUT_JSON="$OUTPUT_DIR/release-provenance.json"

node - "$MATRIX_SUMMARY_JSON" "$OUTPUT_MD" "$OUTPUT_JSON" "$GIT_TAG" "$GIT_SHA" <<'NODE'
const fs = require('node:fs');

const [matrixSummaryPath, outputMdPath, outputJsonPath, gitTag, gitSha] = process.argv.slice(2);
const matrixSummary = JSON.parse(fs.readFileSync(matrixSummaryPath, 'utf8'));

if (!gitTag.startsWith('v')) {
  console.error(`Expected tag to start with v, got: ${gitTag}`);
  process.exit(1);
}

const expectedTag = `v${matrixSummary.version}`;
if (gitTag !== expectedTag) {
  console.error(`Tag/version mismatch. Expected ${expectedTag}, got ${gitTag}`);
  process.exit(1);
}

const entries = matrixSummary.entries || [];
if (entries.length === 0) {
  console.error('No matrix entries found in release summary');
  process.exit(1);
}

const targets = entries.map((entry) => `${entry.platform}/${entry.arch}`);
const generatedAt = new Date().toISOString();

const markdown = [
  '# Release Provenance',
  '',
  `- Tag: \`${gitTag}\``,
  `- Commit: \`${gitSha}\``,
  `- Version: \`${matrixSummary.version}\``,
  `- Generated At: \`${generatedAt}\``,
  `- Targets: ${targets.map((target) => `\`${target}\``).join(', ')}`,
  '',
  '| Target | Artifact Dir | Signing | Publish Audit | Manifest Audit | Installers | Manifests |',
  '| --- | --- | --- | --- | --- | ---: | ---: |',
  ...entries.map((entry) => {
    const publishState = entry.publishChecks.hasExpectedInstaller && entry.publishChecks.hasManifest ? 'passed' : 'failed';
    const manifestState = entry.manifestChecks.allVersionsMatch && entry.manifestChecks.allPathsExist && entry.manifestChecks.allShaPresent ? 'passed' : 'failed';
    return `| \`${entry.platform}/${entry.arch}\` | \`${entry.artifactDir}\` | ${entry.signingStatus} | ${publishState} | ${manifestState} | ${entry.installers} | ${entry.manifests} |`;
  }),
  '',
].join('\n');

const payload = {
  tag: gitTag,
  commit: gitSha,
  version: matrixSummary.version,
  generatedAt,
  targets,
  entries,
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release provenance written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
