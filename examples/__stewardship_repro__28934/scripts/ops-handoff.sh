#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_HANDOFF_DIR:-ops/handoffs}"
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
      echo "Unsupported ops handoff argument: $1"
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

const copyIfExists = (source, destination) => {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
};

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const snapshot = readLatest(path.join(rootDir, 'ops', 'snapshots'), 'ops-snapshot.json');
const evidence = readLatest(path.join(rootDir, 'ops', 'evidence'), 'ops-evidence-summary.json');
const report = readLatest(path.join(rootDir, 'ops', 'reports'), 'ops-report.json');
const bundle = readLatest(path.join(rootDir, 'ops', 'bundles'), 'ops-bundle-summary.json');
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const doctor = readLatest(path.join(rootDir, 'ops', 'doctors'), 'ops-doctor.json');
const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const checks = [];
const addCheck = (id, ok, detail) => {
  checks.push({ id, ok, detail });
};

for (const [id, surface] of [
  ['snapshot-present', snapshot],
  ['evidence-present', evidence],
  ['report-present', report],
  ['bundle-present', bundle],
  ['index-present', index],
  ['doctor-present', doctor],
]) {
  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);
}

const packageVersion = `${pkg.name}@${pkg.version}`;
for (const [id, surface] of [
  ['snapshot-package-match', snapshot],
  ['evidence-package-match', evidence],
  ['report-package-match', report],
  ['bundle-package-match', bundle],
  ['index-package-match', index],
  ['doctor-package-match', doctor],
]) {
  if (!surface) continue;
  const surfacePkg = surface.payload?.package;
  const surfaceVersion = surfacePkg ? `${surfacePkg.name}@${surfacePkg.version}` : null;
  addCheck(id, surfaceVersion === packageVersion, surfaceVersion ? `${surface.relativeDir} -> ${surfaceVersion}` : `${surface.relativeDir} -> missing package metadata`);
}

addCheck('doctor-verdict-pass', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? 'pass' : 'fail'}` : 'doctor missing');
addCheck('bundle-archive-present', bundle ? fs.existsSync(path.join(bundle.absoluteDir, 'ops-bundle.tgz')) : false, bundle ? path.join(bundle.relativeDir, 'ops-bundle.tgz') : 'bundle missing');

if (index?.payload?.latest) {
  addCheck('index-latest-doctor-aligned', index.payload.latest.doctor?.relativeDir === doctor?.relativeDir, index.payload.latest.doctor?.relativeDir ? `index doctor=${index.payload.latest.doctor.relativeDir}` : 'index missing latest doctor reference');
  addCheck('index-latest-bundle-aligned', index.payload.latest.bundle?.relativeDir === bundle?.relativeDir, index.payload.latest.bundle?.relativeDir ? `index bundle=${index.payload.latest.bundle.relativeDir}` : 'index missing latest bundle reference');
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
const handoffDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const payloadDir = path.join(handoffDir, 'payload');
fs.mkdirSync(payloadDir, { recursive: true });

const copySurface = (surface, key, names) => {
  if (!surface) return [];
  const copied = [];
  for (const name of names) {
    const source = path.join(surface.absoluteDir, name);
    const destination = path.join(payloadDir, key, name);
    if (copyIfExists(source, destination)) {
      copied.push(path.join('payload', key, name));
    }
  }
  return copied;
};

const copied = {
  snapshot: copySurface(snapshot, 'snapshot', ['ops-snapshot.json', 'ops-snapshot.md']),
  evidence: copySurface(evidence, 'evidence', ['ops-evidence-summary.json', 'ops-evidence-summary.md']),
  report: copySurface(report, 'report', ['ops-report.json', 'ops-report.md']),
  bundle: copySurface(bundle, 'bundle', ['ops-bundle-summary.json', 'ops-bundle-summary.md', 'ops-bundle.tgz']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  doctor: copySurface(doctor, 'doctor', ['ops-doctor.json', 'ops-doctor.md']),
  docs: [],
  env: [],
  manifests: [],
};

for (const relativeDoc of [
  path.join('docs', 'release-playbook.md'),
  path.join('docs', 'production-readiness.md'),
]) {
  const source = path.join(rootDir, relativeDoc);
  const destination = path.join(payloadDir, 'docs', path.basename(relativeDoc));
  if (copyIfExists(source, destination)) copied.docs.push(relativeDoc);
}

const envExample = path.join(rootDir, '.env.example');
if (copyIfExists(envExample, path.join(payloadDir, 'env', '.env.example'))) {
  copied.env.push('.env.example');
}

for (const manifestFile of manifestFiles) {
  const source = path.join(releaseDir, manifestFile);
  const destination = path.join(payloadDir, 'release', manifestFile);
  if (copyIfExists(source, destination)) copied.manifests.push(path.join('payload', 'release', manifestFile));
}

const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  handoffDir: path.relative(rootDir, handoffDir),
  archivePath: path.join(path.relative(rootDir, handoffDir), 'ops-handoff.tgz'),
  requireReleaseOutput,
  latest: {
    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,
    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,
    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,
    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(handoffDir, 'ops-handoff.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Handoff',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Handoff Dir: ${summary.handoffDir}`,
  `- Archive Path: ${summary.archivePath}`,
  '',
  '## Latest Surfaces',
  '',
  `- Snapshot: ${summary.latest.snapshot?.dir ?? 'missing'}`,
  `- Evidence: ${summary.latest.evidence?.dir ?? 'missing'}`,
  `- Report: ${summary.latest.report?.dir ?? 'missing'}`,
  `- Bundle: ${summary.latest.bundle?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  `- Doctor: ${summary.latest.doctor?.dir ?? 'missing'}`,
  '',
  '## Copied Payload',
  '',
  `- Snapshot files: ${summary.copied.snapshot.length}`,
  `- Evidence files: ${summary.copied.evidence.length}`,
  `- Report files: ${summary.copied.report.length}`,
  `- Bundle files: ${summary.copied.bundle.length}`,
  `- Index files: ${summary.copied.index.length}`,
  `- Doctor files: ${summary.copied.doctor.length}`,
  `- Docs copied: ${summary.copied.docs.length > 0 ? summary.copied.docs.join(', ') : 'none'}`,
  `- Env copied: ${summary.copied.env.length > 0 ? summary.copied.env.join(', ') : 'none'}`,
  `- Release manifests copied: ${summary.copied.manifests.length > 0 ? summary.copied.manifests.join(', ') : 'none'}`,
  '',
  '## Checks',
  '',
  ...summary.checks.map((check) => `- [${check.ok ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## Operator Next Steps',
  '',
  '- Attach `ops-handoff.tgz` to the operator handoff or release ticket.',
  '- Use the embedded doctor, bundle, and report files as the primary evidence set.',
  '- If release output is required, confirm the copied updater manifests and installer names match the target release channel.',
  '',
];

fs.writeFileSync(path.join(handoffDir, 'ops-handoff.md'), lines.join('\n') + '\n');
console.log(`Operations handoff written to: ${handoffDir}`);
if (!ok) process.exit(1);
NODE

handoff_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$handoff_dir" ]; then
  echo "Failed to locate generated ops handoff directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$handoff_dir/ops-handoff.tgz" -C "$handoff_dir" payload
echo "Operations handoff archive written to: $handoff_dir/ops-handoff.tgz"
