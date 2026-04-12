#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_ATTESTATION_DIR:-ops/attestations}"
REQUIRE_RELEASE_OUTPUT=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --label)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --label"
        exit 1
      fi
      LABEL="$1"
      ;;
    --output-dir)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --output-dir"
        exit 1
      fi
      OUTPUT_ROOT="$1"
      ;;
    --require-release-output)
      REQUIRE_RELEASE_OUTPUT=1
      ;;
    --)
      ;;
    *)
      echo "Unsupported ops attest argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, outputRoot, label, requireReleaseOutputFlag] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputFlag === '1';

const readLatest = (root, fileName) => {
  if (!fs.existsSync(root)) return null;
  const candidates = fs.readdirSync(root)
    .map((entry) => path.join(root, entry))
    .filter((entry) => fs.existsSync(path.join(entry, fileName)))
    .map((entry) => ({ entry, stat: fs.statSync(entry) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  if (candidates.length === 0) return null;
  const latestDir = candidates[0].entry;
  return {
    absoluteDir: latestDir,
    relativeDir: path.relative(rootDir, latestDir),
    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),
    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), 'utf8')),
  };
};

const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const collectArtifacts = (surface, key, names) => {
  if (!surface) return [];
  return names
    .map((name) => {
      const filePath = path.join(surface.absoluteDir, name);
      if (!fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      return {
        surface: key,
        file: name,
        relativePath: path.join(surface.relativeDir, name),
        sizeBytes: stat.size,
        sha256: hashFile(filePath),
      };
    })
    .filter(Boolean);
};

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const doctor = readLatest(path.join(rootDir, 'ops', 'doctors'), 'ops-doctor.json');
const bundle = readLatest(path.join(rootDir, 'ops', 'bundles'), 'ops-bundle-summary.json');
const handoff = readLatest(path.join(rootDir, 'ops', 'handoffs'), 'ops-handoff.json');
const ready = readLatest(path.join(rootDir, 'ops', 'ready'), 'ops-ready.json');
const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });

for (const [id, surface] of [
  ['index-present', index],
  ['doctor-present', doctor],
  ['bundle-present', bundle],
  ['handoff-present', handoff],
  ['ready-present', ready],
]) {
  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);
}

const packageVersion = `${pkg.name}@${pkg.version}`;
for (const [id, surface] of [
  ['index-package-match', index],
  ['doctor-package-match', doctor],
  ['bundle-package-match', bundle],
  ['handoff-package-match', handoff],
  ['ready-package-match', ready],
]) {
  if (!surface) continue;
  const surfacePkg = surface.payload?.package;
  const surfaceVersion = surfacePkg ? `${surfacePkg.name}@${surfacePkg.version}` : null;
  addCheck(id, surfaceVersion === packageVersion, surfaceVersion ? `${surface.relativeDir} -> ${surfaceVersion}` : `${surface.relativeDir} -> missing package metadata`);
}

addCheck('doctor-verdict-pass', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? 'pass' : 'fail'}` : 'doctor missing');
addCheck('handoff-verdict-pass', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? 'pass' : 'fail'}` : 'handoff missing');
addCheck('ready-verdict-pass', ready?.payload?.ok === true, ready ? `ready verdict=${ready.payload?.ok ? 'pass' : 'fail'}` : 'ready missing');
addCheck('bundle-archive-present', bundle ? fs.existsSync(path.join(bundle.absoluteDir, 'ops-bundle.tgz')) : false, bundle ? path.join(bundle.relativeDir, 'ops-bundle.tgz') : 'bundle missing');
addCheck('handoff-archive-present', handoff ? fs.existsSync(path.join(handoff.absoluteDir, 'ops-handoff.tgz')) : false, handoff ? path.join(handoff.relativeDir, 'ops-handoff.tgz') : 'handoff missing');

if (requireReleaseOutput) {
  addCheck('release-dir-present', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : 'release directory missing');
  addCheck('release-manifest-present', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(', ') : 'No updater manifests found');
  addCheck('release-installer-present', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(', ') : 'No installer artifacts found');
} else {
  addCheck('release-output-optional', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : 'release output not required');
}

const artifacts = [
  ...collectArtifacts(index, 'index', ['ops-index.json', 'ops-index.md']),
  ...collectArtifacts(doctor, 'doctor', ['ops-doctor.json', 'ops-doctor.md']),
  ...collectArtifacts(bundle, 'bundle', ['ops-bundle-summary.json', 'ops-bundle-summary.md', 'ops-bundle.tgz']),
  ...collectArtifacts(handoff, 'handoff', ['ops-handoff.json', 'ops-handoff.md', 'ops-handoff.tgz']),
  ...collectArtifacts(ready, 'ready', ['ops-ready.json', 'ops-ready.md']),
  ...manifestFiles.map((file) => ({
    surface: 'release-manifest',
    file,
    relativePath: path.join('release', file),
    sizeBytes: fs.statSync(path.join(releaseDir, file)).size,
    sha256: hashFile(path.join(releaseDir, file)),
  })),
  ...installerFiles.map((file) => ({
    surface: 'release-installer',
    file,
    relativePath: path.join('release', file),
    sizeBytes: fs.statSync(path.join(releaseDir, file)).size,
    sha256: hashFile(path.join(releaseDir, file)),
  })),
];

const ok = checks.every((check) => check.ok);
const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const attestationDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
fs.mkdirSync(attestationDir, { recursive: true });

const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  attestationDir: path.relative(rootDir, attestationDir),
  requireReleaseOutput,
  latest: {
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,
    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,
    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,
    ready: ready ? { dir: ready.relativeDir, modifiedAt: ready.modifiedAt, ok: ready.payload?.ok === true } : null,
  },
  artifactCount: artifacts.length,
  artifacts,
  checks,
};

fs.writeFileSync(path.join(attestationDir, 'ops-attestation.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Attestation',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Attestation Dir: ${summary.attestationDir}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Artifact count: ${summary.artifactCount}`,
  '',
  '## Latest Surfaces',
  '',
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  `- Doctor: ${summary.latest.doctor?.dir ?? 'missing'}`,
  `- Bundle: ${summary.latest.bundle?.dir ?? 'missing'}`,
  `- Handoff: ${summary.latest.handoff?.dir ?? 'missing'}`,
  `- Ready: ${summary.latest.ready?.dir ?? 'missing'}`,
  '',
  '## Checks',
  '',
  ...summary.checks.map((check) => `- [${check.ok ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## SHA-256 Inventory',
  '',
  ...(summary.artifacts.length > 0
    ? summary.artifacts.map((artifact) => `- ${artifact.surface}: ${artifact.relativePath} (${artifact.sizeBytes} bytes, sha256=${artifact.sha256})`)
    : ['- none']),
  '',
];

fs.writeFileSync(path.join(attestationDir, 'ops-attestation.md'), lines.join('\n') + '\n');
console.log(`Operations attestation written to: ${attestationDir}`);
if (!ok) process.exit(1);
NODE
