#!/bin/bash
set -euo pipefail

INPUT_DIR="${1:-.release-matrix-artifacts}"
OUTPUT_DIR="${2:-.release-matrix}"

if [[ ! -d "$INPUT_DIR" ]]; then
  echo "Release matrix input directory not found: $INPUT_DIR"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

SUMMARY_MD="$OUTPUT_DIR/release-matrix-summary.md"
SUMMARY_JSON="$OUTPUT_DIR/release-matrix-summary.json"

node - "$INPUT_DIR" "$SUMMARY_MD" "$SUMMARY_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [inputDir, summaryMdPath, summaryJsonPath] = process.argv.slice(2);
const expectedTargets = [
  { platform: 'mac', arch: 'arm64' },
  { platform: 'mac', arch: 'x64' },
  { platform: 'win', arch: 'default' },
  { platform: 'linux', arch: 'default' },
];

const artifactDirs = fs
  .readdirSync(inputDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(inputDir, entry.name))
  .sort();

if (artifactDirs.length === 0) {
  console.error(`No release inventory artifacts found in ${inputDir}`);
  process.exit(1);
}

const entries = artifactDirs.map((artifactDir) => {
  const signing = JSON.parse(fs.readFileSync(path.join(artifactDir, 'signing-readiness.json'), 'utf8'));
  const summary = JSON.parse(fs.readFileSync(path.join(artifactDir, 'artifact-summary.json'), 'utf8'));
  const publish = JSON.parse(fs.readFileSync(path.join(artifactDir, 'publish-audit.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(artifactDir, 'manifest-audit.json'), 'utf8'));

  return {
    artifactDir: path.basename(artifactDir),
    platform: signing.platform,
    arch: signing.arch,
    version: summary.version,
    signingStatus: signing.status,
    signingMissingEnv: signing.missingEnv,
    installers: summary.totals.installers,
    manifests: summary.totals.manifests,
    publishChecks: publish.checks,
    manifestChecks: manifest.checks,
  };
});

entries.sort((a, b) => `${a.platform}-${a.arch}`.localeCompare(`${b.platform}-${b.arch}`));

const foundTargets = new Set(entries.map((entry) => `${entry.platform}:${entry.arch}`));
const missingTargets = expectedTargets.filter((target) => !foundTargets.has(`${target.platform}:${target.arch}`));
if (missingTargets.length > 0) {
  console.error(`Missing release matrix targets: ${missingTargets.map((target) => `${target.platform}/${target.arch}`).join(', ')}`);
  process.exit(1);
}

const versions = [...new Set(entries.map((entry) => entry.version))];
if (versions.length !== 1) {
  console.error(`Expected one release version across matrix, found: ${versions.join(', ')}`);
  process.exit(1);
}

for (const entry of entries) {
  if (entry.signingStatus !== 'passed') {
    console.error(`Signing readiness failed for ${entry.platform}/${entry.arch}`);
    process.exit(1);
  }
  if (!entry.publishChecks.hasExpectedInstaller || !entry.publishChecks.hasManifest) {
    console.error(`Publish audit failed for ${entry.platform}/${entry.arch}`);
    process.exit(1);
  }
  if (!entry.manifestChecks.allVersionsMatch || !entry.manifestChecks.allPathsExist || !entry.manifestChecks.allShaPresent) {
    console.error(`Manifest audit failed for ${entry.platform}/${entry.arch}`);
    process.exit(1);
  }
}

const markdown = [
  '# Release Matrix Summary',
  '',
  `- Version: \`${versions[0]}\``,
  `- Source: \`${inputDir}\``,
  '',
  '| Target | Signing | Installers | Manifests | Publish Audit | Manifest Audit | Missing Env |',
  '| --- | --- | ---: | ---: | --- | --- | --- |',
  ...entries.map((entry) => {
    const target = `\`${entry.platform}/${entry.arch}\``;
    const publishState = entry.publishChecks.hasExpectedInstaller && entry.publishChecks.hasManifest ? 'passed' : 'failed';
    const manifestState = entry.manifestChecks.allVersionsMatch && entry.manifestChecks.allPathsExist && entry.manifestChecks.allShaPresent ? 'passed' : 'failed';
    const missingEnv = entry.signingMissingEnv.length === 0 ? 'none' : entry.signingMissingEnv.join(', ');
    return `| ${target} | ${entry.signingStatus} | ${entry.installers} | ${entry.manifests} | ${publishState} | ${manifestState} | ${missingEnv} |`;
  }),
  '',
  '## Artifacts',
  '',
  ...entries.map((entry) => `- \`${entry.artifactDir}\``),
  '',
].join('\n');

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(
  summaryJsonPath,
  `${JSON.stringify(
    {
      version: versions[0],
      expectedTargets,
      entries,
    },
    null,
    2,
  )}\n`,
);
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release matrix summary written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
