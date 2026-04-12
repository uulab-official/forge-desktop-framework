#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_DOCTOR_DIR:-ops/doctors}"
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
      echo "Unsupported ops doctor argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" <<'NODE'
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

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const snapshot = readLatest(path.join(rootDir, 'ops', 'snapshots'), 'ops-snapshot.json');
const evidence = readLatest(path.join(rootDir, 'ops', 'evidence'), 'ops-evidence-summary.json');
const report = readLatest(path.join(rootDir, 'ops', 'reports'), 'ops-report.json');
const bundle = readLatest(path.join(rootDir, 'ops', 'bundles'), 'ops-bundle-summary.json');
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const checks = [];
const addCheck = (id, ok, detail) => {
  checks.push({ id, ok, detail });
};

addCheck('snapshot-present', Boolean(snapshot), snapshot ? snapshot.relativeDir : 'Latest ops snapshot is missing');
addCheck('evidence-present', Boolean(evidence), evidence ? evidence.relativeDir : 'Latest ops evidence bundle is missing');
addCheck('report-present', Boolean(report), report ? report.relativeDir : 'Latest ops report is missing');
addCheck('bundle-present', Boolean(bundle), bundle ? bundle.relativeDir : 'Latest ops bundle is missing');
addCheck('index-present', Boolean(index), index ? index.relativeDir : 'Latest ops index is missing');

const packageVersion = `${pkg.name}@${pkg.version}`;
for (const [id, surface] of [
  ['snapshot-package-match', snapshot],
  ['evidence-package-match', evidence],
  ['report-package-match', report],
  ['bundle-package-match', bundle],
  ['index-package-match', index],
]) {
  if (!surface) continue;
  const surfacePkg = surface.payload?.package;
  const surfaceVersion = surfacePkg ? `${surfacePkg.name}@${surfacePkg.version}` : null;
  addCheck(id, surfaceVersion === packageVersion, surfaceVersion ? `${surface.relativeDir} -> ${surfaceVersion}` : `${surface.relativeDir} -> missing package metadata`);
}

if (index?.payload?.latest) {
  addCheck(
    'index-latest-bundle-aligned',
    index.payload.latest.bundle?.relativeDir === bundle?.relativeDir,
    index.payload.latest.bundle?.relativeDir ? `index bundle=${index.payload.latest.bundle.relativeDir}` : 'index missing latest bundle reference',
  );
  addCheck(
    'index-latest-report-aligned',
    index.payload.latest.report?.relativeDir === report?.relativeDir,
    index.payload.latest.report?.relativeDir ? `index report=${index.payload.latest.report.relativeDir}` : 'index missing latest report reference',
  );
}

if (requireReleaseOutput) {
  addCheck('release-dir-present', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : 'release directory missing');
  addCheck('release-manifest-present', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(', ') : 'No updater manifests found');
  addCheck('release-installer-present', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(', ') : 'No installer artifacts found');
} else {
  addCheck('release-output-optional', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : 'release output not required');
}

const ok = checks.every((check) => check.ok);
const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const doctorDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
fs.mkdirSync(doctorDir, { recursive: true });

const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  doctorDir: path.relative(rootDir, doctorDir),
  requireReleaseOutput,
  latest: {
    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,
    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,
    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,
    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
  },
  release: {
    manifestCount: manifestFiles.length,
    installerCount: installerFiles.length,
    manifests: manifestFiles,
    installers: installerFiles,
  },
  checks,
};

fs.writeFileSync(path.join(doctorDir, 'ops-doctor.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Doctor',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  '',
  '## Latest Surfaces',
  '',
  `- Snapshot: ${summary.latest.snapshot?.dir ?? 'missing'}`,
  `- Evidence: ${summary.latest.evidence?.dir ?? 'missing'}`,
  `- Report: ${summary.latest.report?.dir ?? 'missing'}`,
  `- Bundle: ${summary.latest.bundle?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Release Output',
  '',
  `- Manifest count: ${summary.release.manifestCount}`,
  `- Installer count: ${summary.release.installerCount}`,
  summary.release.manifests.length > 0 ? `- Manifests: ${summary.release.manifests.join(', ')}` : '- Manifests: none',
  summary.release.installers.length > 0 ? `- Installers: ${summary.release.installers.join(', ')}` : '- Installers: none',
  '',
  '## Checks',
  '',
  ...summary.checks.map((check) => `- [${check.ok ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
];

fs.writeFileSync(path.join(doctorDir, 'ops-doctor.md'), lines.join('\n') + '\n');
console.log(`Operations doctor written to: ${doctorDir}`);
if (!ok) process.exit(1);
NODE
