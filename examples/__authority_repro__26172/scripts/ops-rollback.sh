#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_ROLLBACK_DIR:-ops/rollbacks}"
KEEP="${OPS_ROLLBACK_KEEP:-10}"
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
      echo "Unsupported ops rollback argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Rollback keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

recover_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  recover_args+=(--require-release-output)
fi
pnpm ops:recover "${recover_args[@]}"
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
const recoverSurface = readLatest(path.join(rootDir, 'ops', 'recoveries'), 'ops-recover.json');

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });
addCheck('index-present', Boolean(index), index ? index.relativeDir : 'index missing');
addCheck('gate-present', Boolean(gateSurface), gateSurface ? gateSurface.relativeDir : 'gate missing');
addCheck('gate-pass', gateSurface?.payload?.ok === true, gateSurface ? `gate verdict=${gateSurface.payload?.ok ? 'pass' : 'fail'}` : 'gate missing');
addCheck('export-present', Boolean(exportSurface), exportSurface ? exportSurface.relativeDir : 'export missing');
addCheck('export-pass', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? 'pass' : 'fail'}` : 'export missing');
addCheck('restore-present', Boolean(restoreSurface), restoreSurface ? restoreSurface.relativeDir : 'restore missing');
addCheck('restore-pass', restoreSurface?.payload?.ok === true, restoreSurface ? `restore verdict=${restoreSurface.payload?.ok ? 'pass' : 'fail'}` : 'restore missing');
addCheck('recover-present', Boolean(recoverSurface), recoverSurface ? recoverSurface.relativeDir : 'recover missing');
addCheck('recover-pass', recoverSurface?.payload?.ok === true, recoverSurface ? `recover verdict=${recoverSurface.payload?.ok ? 'pass' : 'fail'}` : 'recover missing');

if (index?.payload?.latest?.recover?.relativeDir && recoverSurface) {
  addCheck('index-latest-recover-aligned', index.payload.latest.recover.relativeDir === recoverSurface.relativeDir, `index recover=${index.payload.latest.recover.relativeDir}`);
}

const proofDir = recoverSurface?.payload?.proofDir ? path.join(rootDir, recoverSurface.payload.proofDir) : null;
const restoredPayloadDir = recoverSurface?.payload?.restored?.payloadDir ? path.join(rootDir, recoverSurface.payload.restored.payloadDir) : null;
addCheck('recover-proof-dir', Boolean(proofDir && fs.existsSync(proofDir)), proofDir ? (fs.existsSync(proofDir) ? path.relative(rootDir, proofDir) : `missing ${path.relative(rootDir, proofDir)}`) : 'recover proof missing');
addCheck('recover-restored-payload', Boolean(restoredPayloadDir && fs.existsSync(restoredPayloadDir)), restoredPayloadDir ? (fs.existsSync(restoredPayloadDir) ? path.relative(rootDir, restoredPayloadDir) : `missing ${path.relative(rootDir, restoredPayloadDir)}`) : 'recover restored payload missing');

const requiredProofFiles = proofDir ? [
  ['recover-json', path.join(recoverSurface.absoluteDir, 'ops-recover.json')],
  ['recover-markdown', path.join(recoverSurface.absoluteDir, 'ops-recover.md')],
  ['proof-restore', path.join(proofDir, 'restore', 'ops-restore.json')],
  ['proof-gate', path.join(proofDir, 'gate', 'ops-gate.json')],
  ['proof-export', path.join(proofDir, 'export', 'ops-export.json')],
  ['proof-releasepack', path.join(proofDir, 'restored-payload', 'releasepack.json')],
  ['proof-ready', path.join(proofDir, 'restored-payload', 'ready.json')],
  ['proof-index', path.join(proofDir, 'restored-payload', 'index.json')],
] : [];

for (const [id, filePath] of requiredProofFiles) {
  addCheck(`proof-${id}`, fs.existsSync(filePath), fs.existsSync(filePath) ? path.relative(rootDir, filePath) : `missing ${path.relative(rootDir, filePath)}`);
}

const restoredReleaseDir = restoredPayloadDir ? path.join(restoredPayloadDir, 'release') : null;
const restoredReleaseFiles = restoredReleaseDir && fs.existsSync(restoredReleaseDir) ? fs.readdirSync(restoredReleaseDir).sort() : [];
const restoredManifestFiles = restoredReleaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const restoredInstallerFiles = restoredReleaseFiles.filter((file) => !restoredManifestFiles.includes(file));

if (requireReleaseOutput) {
  addCheck('rollback-manifests', restoredManifestFiles.length > 0, restoredManifestFiles.length > 0 ? restoredManifestFiles.join(', ') : 'no rollback manifests');
  addCheck('rollback-installers', restoredInstallerFiles.length > 0, restoredInstallerFiles.length > 0 ? restoredInstallerFiles.join(', ') : 'no rollback installers');
} else {
  addCheck('rollback-release-optional', true, restoredReleaseFiles.length > 0 ? `rollback release files: ${restoredReleaseFiles.length}` : 'release output not required');
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const rollbackDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const proofOutputDir = path.join(rollbackDir, 'proof');
fs.mkdirSync(proofOutputDir, { recursive: true });

const copyIfExists = (source, destination) => {
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
};

const copied = { recover: [], restore: [], gate: [], export: [], restoredPayload: [] };
if (recoverSurface) {
  if (copyIfExists(path.join(recoverSurface.absoluteDir, 'ops-recover.json'), path.join(proofOutputDir, 'recover', 'ops-recover.json'))) copied.recover.push(path.join('proof', 'recover', 'ops-recover.json'));
  if (copyIfExists(path.join(recoverSurface.absoluteDir, 'ops-recover.md'), path.join(proofOutputDir, 'recover', 'ops-recover.md'))) copied.recover.push(path.join('proof', 'recover', 'ops-recover.md'));
}
if (proofDir) {
  for (const [surface, fileName] of [
    ['restore', 'ops-restore.json'],
    ['restore', 'ops-restore.md'],
    ['gate', 'ops-gate.json'],
    ['gate', 'ops-gate.md'],
    ['export', 'ops-export.json'],
    ['export', 'ops-export.md'],
  ]) {
    const source = path.join(proofDir, surface, fileName);
    const destination = path.join(proofOutputDir, surface, fileName);
    if (copyIfExists(source, destination)) copied[surface].push(path.join('proof', surface, fileName));
  }
  for (const fileName of ['releasepack.json', 'gate.json', 'handoff.json', 'attestation.json', 'ready.json', 'index.json']) {
    const source = path.join(proofDir, 'restored-payload', fileName);
    const destination = path.join(proofOutputDir, 'restored-payload', fileName);
    if (copyIfExists(source, destination)) copied.restoredPayload.push(path.join('proof', 'restored-payload', fileName));
  }
}

const rerunCommand = `pnpm ops:rollback -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''}`;
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  rollbackDir: path.relative(rootDir, rollbackDir),
  proofDir: path.relative(rootDir, proofOutputDir),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    gate: gateSurface ? { dir: gateSurface.relativeDir, modifiedAt: gateSurface.modifiedAt, ok: gateSurface.payload?.ok === true } : null,
    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,
    restore: restoreSurface ? { dir: restoreSurface.relativeDir, modifiedAt: restoreSurface.modifiedAt, ok: restoreSurface.payload?.ok === true } : null,
    recover: recoverSurface ? { dir: recoverSurface.relativeDir, modifiedAt: recoverSurface.modifiedAt, ok: recoverSurface.payload?.ok === true } : null,
  },
  restored: {
    payloadDir: restoredPayloadDir ? path.relative(rootDir, restoredPayloadDir) : null,
    manifests: restoredManifestFiles,
    installers: restoredInstallerFiles,
  },
  copied,
  checks,
};

fs.writeFileSync(path.join(rollbackDir, 'ops-rollback.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Rollback',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Rollback Dir: ${summary.rollbackDir}`,
  `- Proof Dir: ${summary.proofDir}`,
  `- Restored Payload Dir: ${summary.restored.payloadDir ?? 'missing'}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Gate: ${summary.latest.gate?.dir ?? 'missing'}`,
  `- Export: ${summary.latest.export?.dir ?? 'missing'}`,
  `- Restore: ${summary.latest.restore?.dir ?? 'missing'}`,
  `- Recover: ${summary.latest.recover?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Restored Release Inventory',
  '',
  `- Restored manifests: ${summary.restored.manifests.length > 0 ? summary.restored.manifests.join(', ') : 'none'}`,
  `- Restored installers: ${summary.restored.installers.length > 0 ? summary.restored.installers.join(', ') : 'none'}`,
  '',
  '## Proof Copies',
  '',
  `- Recover proof files: ${summary.copied.recover.length}`,
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
  '- Use this rollback directory as the final operator-facing rollback decision record after the latest recovery rehearsal passes.',
  '- Re-run `pnpm ops:rollback -- --label <name> --require-release-output` after any recovery, export, or packaged release change.',
  '- Attach `ops-rollback.json` and `ops-rollback.md` when release approval requires a rollback-specific go or no-go packet.',
  '',
];
fs.writeFileSync(path.join(rollbackDir, 'ops-rollback.md'), lines.join('\n') + '\n');
console.log(`Operations rollback written to: ${rollbackDir}`);
if (!ok) process.exit(1);
NODE

pnpm ops:index -- --label "$LABEL"
