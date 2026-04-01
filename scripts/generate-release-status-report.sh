#!/bin/bash
set -euo pipefail

ONE_POINT_ZERO_JSON="${1:-}"
MATRIX_SUMMARY_JSON="${2:-}"
PROVENANCE_JSON="${3:-}"
OUTPUT_DIR="${4:-.release-matrix}"

if [[ -z "$ONE_POINT_ZERO_JSON" || -z "$MATRIX_SUMMARY_JSON" || -z "$PROVENANCE_JSON" ]]; then
  echo "Usage: bash scripts/generate-release-status-report.sh <one-point-zero-readiness.json> <release-matrix-summary.json> <release-provenance.json> [output-dir]"
  exit 1
fi

for path in "$ONE_POINT_ZERO_JSON" "$MATRIX_SUMMARY_JSON" "$PROVENANCE_JSON"; do
  if [[ ! -f "$path" ]]; then
    echo "Required input not found: $path"
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

OUTPUT_MD="$OUTPUT_DIR/release-status.md"
OUTPUT_JSON="$OUTPUT_DIR/release-status.json"

node - "$ONE_POINT_ZERO_JSON" "$MATRIX_SUMMARY_JSON" "$PROVENANCE_JSON" "$OUTPUT_MD" "$OUTPUT_JSON" <<'NODE'
const fs = require('node:fs');

const [onePointZeroPath, matrixSummaryPath, provenancePath, outputMdPath, outputJsonPath] = process.argv.slice(2);
const readiness = JSON.parse(fs.readFileSync(onePointZeroPath, 'utf8'));
const matrixSummary = JSON.parse(fs.readFileSync(matrixSummaryPath, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));

if (readiness.status !== 'passed') {
  console.error(`Expected one-point-zero readiness to pass, found ${readiness.status}`);
  process.exit(1);
}

if (provenance.version !== matrixSummary.version) {
  console.error(`Release provenance version mismatch: ${provenance.version} !== ${matrixSummary.version}`);
  process.exit(1);
}

const entries = matrixSummary.entries || [];
if (entries.length === 0) {
  console.error('No release matrix entries found.');
  process.exit(1);
}

const officialPresets = (readiness.officialPresets || []).map((entry) => ({
  preset: entry.preset,
  passed: entry.passed,
}));

const failingPresets = officialPresets.filter((entry) => !entry.passed);
if (failingPresets.length > 0) {
  console.error(`Official preset readiness failed: ${failingPresets.map((entry) => entry.preset).join(', ')}`);
  process.exit(1);
}

const totalInstallers = entries.reduce((sum, entry) => sum + Number(entry.installers || 0), 0);
const totalManifests = entries.reduce((sum, entry) => sum + Number(entry.manifests || 0), 0);
const targets = entries.map((entry) => `${entry.platform}/${entry.arch}`);

const gateChecks = [
  {
    name: 'one-point-zero readiness',
    passed: readiness.status === 'passed',
  },
  {
    name: 'matrix summary targets present',
    passed: entries.length > 0,
  },
  {
    name: 'provenance matches matrix version',
    passed: provenance.version === matrixSummary.version,
  },
  {
    name: 'all matrix entries signing-ready',
    passed: entries.every((entry) => entry.signingStatus === 'passed'),
  },
  {
    name: 'all matrix entries rollback-ready',
    passed: entries.every((entry) => entry.rollbackStatus === 'passed'),
  },
];

const status = gateChecks.every((entry) => entry.passed) ? 'passed' : 'failed';

const recommendedActions = [
  `Review \`${onePointZeroPath}\` if any public 1.0 contract needs to change before shipping.`,
  `Review \`${matrixSummaryPath}\` when a platform target, manifest, or installer count changes.`,
  `Review \`${provenancePath}\` before publishing a final operator-facing release note.`,
];

const markdown = [
  '# Release Status',
  '',
  `- Status: \`${status}\``,
  `- Version: \`${matrixSummary.version}\``,
  `- Tag: \`${provenance.tag}\``,
  `- Commit: \`${provenance.commit}\``,
  `- Targets: ${targets.map((target) => `\`${target}\``).join(', ')}`,
  `- Installers: \`${totalInstallers}\``,
  `- Manifests: \`${totalManifests}\``,
  '',
  '## Official Presets',
  '',
  '| Preset | Ready |',
  '| --- | --- |',
  ...officialPresets.map((entry) => `| \`${entry.preset}\` | ${entry.passed} |`),
  '',
  '## Release Gates',
  '',
  '| Gate | Ready |',
  '| --- | --- |',
  ...gateChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Targets',
  '',
  '| Target | Signing | Rollback | Installers | Manifests |',
  '| --- | --- | --- | ---: | ---: |',
  ...entries.map((entry) => `| \`${entry.platform}/${entry.arch}\` | ${entry.signingStatus} | ${entry.rollbackStatus} | ${entry.installers} | ${entry.manifests} |`),
  '',
  '## Follow-Up',
  '',
  ...recommendedActions.map((action, index) => `${index + 1}. ${action}`),
  '',
].join('\n');

const payload = {
  status,
  version: matrixSummary.version,
  tag: provenance.tag,
  commit: provenance.commit,
  targets,
  totals: {
    installers: totalInstallers,
    manifests: totalManifests,
  },
  officialPresets,
  gateChecks,
  recommendedActions,
  sources: {
    onePointZeroReadiness: onePointZeroPath,
    matrixSummary: matrixSummaryPath,
    provenance: provenancePath,
  },
};

fs.writeFileSync(outputMdPath, `${markdown}\n`);
fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error('Release status report failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$OUTPUT_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release status report written to:"
echo "  $OUTPUT_MD"
echo "  $OUTPUT_JSON"
