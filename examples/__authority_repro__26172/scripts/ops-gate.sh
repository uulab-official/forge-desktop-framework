#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_GATE_DIR:-ops/gates}"
KEEP="${OPS_GATE_KEEP:-10}"
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
      echo "Unsupported ops gate argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Gate keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

ready_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  ready_args+=(--require-release-output)
fi
pnpm ops:ready "${ready_args[@]}"
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

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const doctor = readLatest(path.join(rootDir, 'ops', 'doctors'), 'ops-doctor.json');
const handoff = readLatest(path.join(rootDir, 'ops', 'handoffs'), 'ops-handoff.json');
const attestation = readLatest(path.join(rootDir, 'ops', 'attestations'), 'ops-attestation.json');
const ready = readLatest(path.join(rootDir, 'ops', 'ready'), 'ops-ready.json');
const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });
const packageVersion = `${pkg.name}@${pkg.version}`;

for (const [id, surface] of [
  ['index-present', index],
  ['doctor-present', doctor],
  ['handoff-present', handoff],
  ['attestation-present', attestation],
  ['ready-present', ready],
]) {
  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);
}

for (const [id, surface] of [
  ['doctor-package-match', doctor],
  ['handoff-package-match', handoff],
  ['attestation-package-match', attestation],
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
addCheck('attestation-verdict-pass', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? 'pass' : 'fail'}` : 'attestation missing');
addCheck('handoff-archive-present', handoff ? fs.existsSync(path.join(handoff.absoluteDir, 'ops-handoff.tgz')) : false, handoff ? path.join(handoff.relativeDir, 'ops-handoff.tgz') : 'handoff missing');
addCheck('attestation-artifacts-present', (attestation?.payload?.artifactCount ?? 0) > 0, attestation ? `artifact count=${attestation.payload?.artifactCount ?? 0}` : 'attestation missing');

if (index?.payload?.latest) {
  addCheck('index-latest-doctor-aligned', index.payload.latest.doctor?.relativeDir === doctor?.relativeDir, index.payload.latest.doctor?.relativeDir ? `index doctor=${index.payload.latest.doctor.relativeDir}` : 'index missing doctor reference');
  addCheck('index-latest-handoff-aligned', index.payload.latest.handoff?.relativeDir === handoff?.relativeDir, index.payload.latest.handoff?.relativeDir ? `index handoff=${index.payload.latest.handoff.relativeDir}` : 'index missing handoff reference');
  addCheck('index-latest-attestation-aligned', index.payload.latest.attestation?.relativeDir === attestation?.relativeDir, index.payload.latest.attestation?.relativeDir ? `index attestation=${index.payload.latest.attestation.relativeDir}` : 'index missing attestation reference');
  addCheck('index-latest-ready-aligned', index.payload.latest.ready?.relativeDir === ready?.relativeDir, index.payload.latest.ready?.relativeDir ? `index ready=${index.payload.latest.ready.relativeDir}` : 'index missing ready reference');
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
const gateDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
fs.mkdirSync(gateDir, { recursive: true });

const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  gateDir: path.relative(rootDir, gateDir),
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,
    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,
    attestation: attestation ? { dir: attestation.relativeDir, modifiedAt: attestation.modifiedAt, ok: attestation.payload?.ok === true, artifactCount: attestation.payload?.artifactCount ?? 0 } : null,
    ready: ready ? { dir: ready.relativeDir, modifiedAt: ready.modifiedAt, ok: ready.payload?.ok === true } : null,
  },
  release: { manifestCount: manifestFiles.length, installerCount: installerFiles.length, manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(gateDir, 'ops-gate.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Gate',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'go' : 'no-go'}`,
  `- Gate Dir: ${summary.gateDir}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  '',
  '## Latest Surfaces',
  '',
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  `- Doctor: ${summary.latest.doctor?.dir ?? 'missing'}`,
  `- Handoff: ${summary.latest.handoff?.dir ?? 'missing'}`,
  `- Attestation: ${summary.latest.attestation?.dir ?? 'missing'}`,
  `- Ready: ${summary.latest.ready?.dir ?? 'missing'}`,
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
  '## Operator Next Steps',
  '',
  '- Review `ops-gate.json` as the machine-readable go/no-go verdict for this production run.',
  '- Attach the latest `ops-handoff.tgz` and `ops-attestation.json` when escalating or handing off the release.',
  '- Re-run `pnpm ops:gate -- --label <name> --require-release-output` after any packaging or release-surface change.',
  '',
];

fs.writeFileSync(path.join(gateDir, 'ops-gate.md'), lines.join('\n') + '\n');
console.log(`Operations gate written to: ${gateDir}`);
if (!ok) process.exit(1);
NODE

pnpm ops:index -- --label "$LABEL"
