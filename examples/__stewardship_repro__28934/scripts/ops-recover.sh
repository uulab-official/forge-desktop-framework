#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_RECOVER_DIR:-ops/recoveries}"
KEEP="${OPS_RECOVER_KEEP:-10}"
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
      echo "Unsupported ops recover argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Recover keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

restore_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  restore_args+=(--require-release-output)
fi
pnpm ops:restore "${restore_args[@]}"
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
const gateSurface = readLatest(path.join(rootDir, 'ops', 'gates'), 'ops-gate.json');
const exportSurface = readLatest(path.join(rootDir, 'ops', 'exports'), 'ops-export.json');
const restoreSurface = readLatest(path.join(rootDir, 'ops', 'restores'), 'ops-restore.json');

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });
addCheck('index-present', Boolean(index), index ? index.relativeDir : 'index missing');
addCheck('gate-present', Boolean(gateSurface), gateSurface ? gateSurface.relativeDir : 'gate missing');
addCheck('gate-pass', gateSurface?.payload?.ok === true, gateSurface ? `gate verdict=${gateSurface.payload?.ok ? 'pass' : 'fail'}` : 'gate missing');
addCheck('export-present', Boolean(exportSurface), exportSurface ? exportSurface.relativeDir : 'export missing');
addCheck('export-pass', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? 'pass' : 'fail'}` : 'export missing');
addCheck('restore-present', Boolean(restoreSurface), restoreSurface ? restoreSurface.relativeDir : 'restore missing');
addCheck('restore-pass', restoreSurface?.payload?.ok === true, restoreSurface ? `restore verdict=${restoreSurface.payload?.ok ? 'pass' : 'fail'}` : 'restore missing');

if (index?.payload?.latest?.restore?.relativeDir && restoreSurface) {
  addCheck('index-latest-restore-aligned', index.payload.latest.restore.relativeDir === restoreSurface.relativeDir, `index restore=${index.payload.latest.restore.relativeDir}`);
}

const restoredPayloadDir = restoreSurface?.payload?.restoredPayloadDir ? path.join(rootDir, restoreSurface.payload.restoredPayloadDir) : null;
addCheck('restored-payload-dir', Boolean(restoredPayloadDir && fs.existsSync(restoredPayloadDir)), restoredPayloadDir ? (fs.existsSync(restoredPayloadDir) ? path.relative(rootDir, restoredPayloadDir) : `missing ${path.relative(rootDir, restoredPayloadDir)}`) : 'restore payload missing');

const requiredRecoveredFiles = restoredPayloadDir ? [
  ['releasepack-json', path.join(restoredPayloadDir, 'releasepack', 'ops-releasepack.json')],
  ['gate-json', path.join(restoredPayloadDir, 'gate', 'ops-gate.json')],
  ['handoff-json', path.join(restoredPayloadDir, 'handoff', 'ops-handoff.json')],
  ['attestation-json', path.join(restoredPayloadDir, 'attestation', 'ops-attestation.json')],
  ['ready-json', path.join(restoredPayloadDir, 'ready', 'ops-ready.json')],
  ['index-json', path.join(restoredPayloadDir, 'index', 'ops-index.json')],
] : [];

for (const [id, filePath] of requiredRecoveredFiles) {
  addCheck(`recovered-${id}`, fs.existsSync(filePath), fs.existsSync(filePath) ? path.relative(rootDir, filePath) : `missing ${path.relative(rootDir, filePath)}`);
}

const restoredReleaseDir = restoredPayloadDir ? path.join(restoredPayloadDir, 'release') : null;
const restoredReleaseFiles = restoredReleaseDir && fs.existsSync(restoredReleaseDir) ? fs.readdirSync(restoredReleaseDir).sort() : [];
const restoredManifestFiles = restoredReleaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const restoredInstallerFiles = restoredReleaseFiles.filter((file) => !restoredManifestFiles.includes(file));

if (requireReleaseOutput) {
  addCheck('recovered-manifests', restoredManifestFiles.length > 0, restoredManifestFiles.length > 0 ? restoredManifestFiles.join(', ') : 'no recovered manifests');
  addCheck('recovered-installers', restoredInstallerFiles.length > 0, restoredInstallerFiles.length > 0 ? restoredInstallerFiles.join(', ') : 'no recovered installers');
} else {
  addCheck('recovered-release-optional', true, restoredReleaseFiles.length > 0 ? `recovered release files: ${restoredReleaseFiles.length}` : 'release output not required');
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const recoveryDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const proofDir = path.join(recoveryDir, 'proof');
fs.mkdirSync(proofDir, { recursive: true });

const copyIfExists = (source, destination) => {
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
};

const copied = { restore: [], gate: [], export: [], restoredPayload: [] };
if (restoreSurface) {
  if (copyIfExists(path.join(restoreSurface.absoluteDir, 'ops-restore.json'), path.join(proofDir, 'restore', 'ops-restore.json'))) copied.restore.push(path.join('proof', 'restore', 'ops-restore.json'));
  if (copyIfExists(path.join(restoreSurface.absoluteDir, 'ops-restore.md'), path.join(proofDir, 'restore', 'ops-restore.md'))) copied.restore.push(path.join('proof', 'restore', 'ops-restore.md'));
}
if (gateSurface) {
  if (copyIfExists(path.join(gateSurface.absoluteDir, 'ops-gate.json'), path.join(proofDir, 'gate', 'ops-gate.json'))) copied.gate.push(path.join('proof', 'gate', 'ops-gate.json'));
  if (copyIfExists(path.join(gateSurface.absoluteDir, 'ops-gate.md'), path.join(proofDir, 'gate', 'ops-gate.md'))) copied.gate.push(path.join('proof', 'gate', 'ops-gate.md'));
}
if (exportSurface) {
  if (copyIfExists(path.join(exportSurface.absoluteDir, 'ops-export.json'), path.join(proofDir, 'export', 'ops-export.json'))) copied.export.push(path.join('proof', 'export', 'ops-export.json'));
  if (copyIfExists(path.join(exportSurface.absoluteDir, 'ops-export.md'), path.join(proofDir, 'export', 'ops-export.md'))) copied.export.push(path.join('proof', 'export', 'ops-export.md'));
}
if (restoredPayloadDir) {
  for (const [name, source] of [
    ['releasepack', path.join(restoredPayloadDir, 'releasepack', 'ops-releasepack.json')],
    ['gate', path.join(restoredPayloadDir, 'gate', 'ops-gate.json')],
    ['handoff', path.join(restoredPayloadDir, 'handoff', 'ops-handoff.json')],
    ['attestation', path.join(restoredPayloadDir, 'attestation', 'ops-attestation.json')],
    ['ready', path.join(restoredPayloadDir, 'ready', 'ops-ready.json')],
    ['index', path.join(restoredPayloadDir, 'index', 'ops-index.json')],
  ]) {
    const destination = path.join(proofDir, 'restored-payload', `${name}.json`);
    if (copyIfExists(source, destination)) copied.restoredPayload.push(path.join('proof', 'restored-payload', `${name}.json`));
  }
}

const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  recoveryDir: path.relative(rootDir, recoveryDir),
  proofDir: path.relative(rootDir, proofDir),
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    gate: gateSurface ? { dir: gateSurface.relativeDir, modifiedAt: gateSurface.modifiedAt, ok: gateSurface.payload?.ok === true } : null,
    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,
    restore: restoreSurface ? { dir: restoreSurface.relativeDir, modifiedAt: restoreSurface.modifiedAt, ok: restoreSurface.payload?.ok === true } : null,
  },
  restored: {
    payloadDir: restoredPayloadDir ? path.relative(rootDir, restoredPayloadDir) : null,
    manifests: restoredManifestFiles,
    installers: restoredInstallerFiles,
  },
  copied,
  checks,
};

fs.writeFileSync(path.join(recoveryDir, 'ops-recover.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Recover',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Recovery Dir: ${summary.recoveryDir}`,
  `- Proof Dir: ${summary.proofDir}`,
  `- Restored Payload Dir: ${summary.restored.payloadDir ?? 'missing'}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Gate: ${summary.latest.gate?.dir ?? 'missing'}`,
  `- Export: ${summary.latest.export?.dir ?? 'missing'}`,
  `- Restore: ${summary.latest.restore?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Restored Release Inventory',
  '',
  `- Restored manifests: ${summary.restored.manifests.length > 0 ? summary.restored.manifests.join(', ') : 'none'}`,
  `- Restored installers: ${summary.restored.installers.length > 0 ? summary.restored.installers.join(', ') : 'none'}`,
  '',
  '## Proof Copies',
  '',
  `- Restore proof files: ${summary.copied.restore.length}`,
  `- Gate proof files: ${summary.copied.gate.length}`,
  `- Export proof files: ${summary.copied.export.length}`,
  `- Restored payload proof files: ${summary.copied.restoredPayload.length}`,
  '',
  '## Checks',
  '',
  ...summary.checks.map((check) => `- [${check.ok ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## Operator Next Steps',
  '',
  '- Use this recovery directory as the final operator-facing proof that the latest restore record can drive a coherent recovery handoff.',
  '- Re-run `pnpm ops:recover -- --label <name> --require-release-output` after any release-pack, export, or restore surface change.',
  '- Attach `ops-recover.json` and `ops-recover.md` when release approval requires a recovery-specific go or no-go record.',
  '',
];
fs.writeFileSync(path.join(recoveryDir, 'ops-recover.md'), lines.join('\n') + '\n');
console.log(`Operations recover written to: ${recoveryDir}`);
if (!ok) process.exit(1);
NODE

pnpm ops:index -- --label "$LABEL"
