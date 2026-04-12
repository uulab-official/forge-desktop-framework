#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_EXPORT_DIR:-ops/exports}"
KEEP="${OPS_EXPORT_KEEP:-10}"
REQUIRE_RELEASE_OUTPUT=0
SKIP_RETENTION=0

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
    --keep)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --keep"
        exit 1
      fi
      KEEP="$1"
      ;;
    --require-release-output)
      REQUIRE_RELEASE_OUTPUT=1
      ;;
    --skip-retention)
      SKIP_RETENTION=1
      ;;
    --)
      ;;
    *)
      echo "Unsupported ops export argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Export keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

releasepack_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  releasepack_args+=(--require-release-output)
fi
pnpm ops:releasepack "${releasepack_args[@]}"
pnpm ops:index -- --label "$LABEL"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputFlag === '1';
const skipRetention = skipRetentionFlag === '1';

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
const handoff = readLatest(path.join(rootDir, 'ops', 'handoffs'), 'ops-handoff.json');
const attestation = readLatest(path.join(rootDir, 'ops', 'attestations'), 'ops-attestation.json');
const ready = readLatest(path.join(rootDir, 'ops', 'ready'), 'ops-ready.json');
const gate = readLatest(path.join(rootDir, 'ops', 'gates'), 'ops-gate.json');
const releasePack = readLatest(path.join(rootDir, 'ops', 'releasepacks'), 'ops-releasepack.json');
const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });
for (const [id, surface] of [
  ['snapshot-present', snapshot],
  ['evidence-present', evidence],
  ['report-present', report],
  ['bundle-present', bundle],
  ['index-present', index],
  ['doctor-present', doctor],
  ['handoff-present', handoff],
  ['attestation-present', attestation],
  ['ready-present', ready],
  ['gate-present', gate],
  ['releasepack-present', releasePack],
]) {
  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);
}
addCheck('doctor-pass', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? 'pass' : 'fail'}` : 'doctor missing');
addCheck('handoff-pass', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? 'pass' : 'fail'}` : 'handoff missing');
addCheck('attestation-pass', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? 'pass' : 'fail'}` : 'attestation missing');
addCheck('ready-pass', ready?.payload?.ok === true, ready ? `ready verdict=${ready.payload?.ok ? 'pass' : 'fail'}` : 'ready missing');
addCheck('gate-go', gate?.payload?.ok === true, gate ? `gate verdict=${gate.payload?.ok ? 'go' : 'no-go'}` : 'gate missing');
addCheck('releasepack-pass', releasePack?.payload?.ok === true, releasePack ? `releasepack verdict=${releasePack.payload?.ok ? 'pass' : 'fail'}` : 'releasepack missing');
addCheck('releasepack-archive-present', releasePack ? fs.existsSync(path.join(releasePack.absoluteDir, 'ops-releasepack.tgz')) : false, releasePack ? path.join(releasePack.relativeDir, 'ops-releasepack.tgz') : 'releasepack missing');
if (index?.payload?.latest) {
  addCheck('index-latest-releasepack-aligned', index.payload.latest.releasePack?.relativeDir === releasePack?.relativeDir, index.payload.latest.releasePack?.relativeDir ? `index releasepack=${index.payload.latest.releasePack.relativeDir}` : 'index missing latest release pack reference');
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
const exportDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const payloadDir = path.join(exportDir, 'payload');
fs.mkdirSync(payloadDir, { recursive: true });

const copySurface = (surface, key, names) => {
  if (!surface) return [];
  const copied = [];
  for (const name of names) {
    const source = path.join(surface.absoluteDir, name);
    const destination = path.join(payloadDir, key, name);
    if (copyIfExists(source, destination)) copied.push(path.join('payload', key, name));
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
  handoff: copySurface(handoff, 'handoff', ['ops-handoff.json', 'ops-handoff.md', 'ops-handoff.tgz']),
  attestation: copySurface(attestation, 'attestation', ['ops-attestation.json', 'ops-attestation.md']),
  ready: copySurface(ready, 'ready', ['ops-ready.json', 'ops-ready.md']),
  gate: copySurface(gate, 'gate', ['ops-gate.json', 'ops-gate.md']),
  releasePack: copySurface(releasePack, 'releasepack', ['ops-releasepack.json', 'ops-releasepack.md', 'ops-releasepack.tgz']),
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

for (const relativeDoc of [path.join('docs', 'release-playbook.md'), path.join('docs', 'production-readiness.md')]) {
  const source = path.join(rootDir, relativeDoc);
  const destination = path.join(payloadDir, 'docs', path.basename(relativeDoc));
  if (copyIfExists(source, destination)) copied.docs.push(relativeDoc);
}
const envExample = path.join(rootDir, '.env.example');
if (copyIfExists(envExample, path.join(payloadDir, 'env', '.env.example'))) copied.env.push('.env.example');
for (const file of manifestFiles) {
  if (copyIfExists(path.join(releaseDir, file), path.join(payloadDir, 'release', file))) copied.manifests.push(path.join('payload', 'release', file));
}
for (const file of installerFiles) {
  if (copyIfExists(path.join(releaseDir, file), path.join(payloadDir, 'release', file))) copied.installers.push(path.join('payload', 'release', file));
}

const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  exportDir: path.relative(rootDir, exportDir),
  archivePath: path.join(path.relative(rootDir, exportDir), 'ops-export.tgz'),
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,
    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,
    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,
    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,
    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,
    attestation: attestation ? { dir: attestation.relativeDir, modifiedAt: attestation.modifiedAt, ok: attestation.payload?.ok === true } : null,
    ready: ready ? { dir: ready.relativeDir, modifiedAt: ready.modifiedAt, ok: ready.payload?.ok === true } : null,
    gate: gate ? { dir: gate.relativeDir, modifiedAt: gate.modifiedAt, ok: gate.payload?.ok === true } : null,
    releasePack: releasePack ? { dir: releasePack.relativeDir, modifiedAt: releasePack.modifiedAt, ok: releasePack.payload?.ok === true } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(exportDir, 'ops-export.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Export',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Export Dir: ${summary.exportDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Release Pack: ${summary.latest.releasePack?.dir ?? 'missing'}`,
  `- Gate: ${summary.latest.gate?.dir ?? 'missing'}`,
  `- Handoff: ${summary.latest.handoff?.dir ?? 'missing'}`,
  `- Attestation: ${summary.latest.attestation?.dir ?? 'missing'}`,
  `- Ready: ${summary.latest.ready?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Payload Counts',
  '',
  `- Release pack files: ${summary.copied.releasePack.length}`,
  `- Gate files: ${summary.copied.gate.length}`,
  `- Handoff files: ${summary.copied.handoff.length}`,
  `- Attestation files: ${summary.copied.attestation.length}`,
  `- Ready files: ${summary.copied.ready.length}`,
  `- Docs copied: ${summary.copied.docs.length > 0 ? summary.copied.docs.join(', ') : 'none'}`,
  `- Env copied: ${summary.copied.env.length > 0 ? summary.copied.env.join(', ') : 'none'}`,
  `- Release manifests copied: ${summary.copied.manifests.length}`,
  `- Release installers copied: ${summary.copied.installers.length}`,
  '',
  '## Checks',
  '',
  ...summary.checks.map((check) => `- [${check.ok ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## Operator Next Steps',
  '',
  '- Attach `ops-export.tgz` when handing the release to offline reviewers or operations outside CI artifacts.',
  '- Use `ops-export.json` as the machine-readable final portable handoff manifest.',
  '- Re-run `pnpm ops:export -- --label <name> --require-release-output` after any packaging or release-surface change.',
  '',
];
fs.writeFileSync(path.join(exportDir, 'ops-export.md'), lines.join('\n') + '\n');
console.log(`Operations export written to: ${exportDir}`);
if (!ok) process.exit(1);
NODE

export_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$export_dir" ]; then
  echo "Failed to locate generated ops export directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$export_dir/ops-export.tgz" -C "$export_dir" payload
echo "Operations export archive written to: $export_dir/ops-export.tgz"
pnpm ops:index -- --label "$LABEL"
