#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_RESTORE_DIR:-ops/restores}"
KEEP="${OPS_RESTORE_KEEP:-10}"
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
      echo "Unsupported ops restore argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Restore keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

export_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  export_args+=(--require-release-output)
fi
pnpm ops:export "${export_args[@]}"
pnpm ops:index -- --label "$LABEL"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
const exportSurface = readLatest(path.join(rootDir, 'ops', 'exports'), 'ops-export.json');

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });
addCheck('index-present', Boolean(index), index ? index.relativeDir : 'index missing');
addCheck('export-present', Boolean(exportSurface), exportSurface ? exportSurface.relativeDir : 'export missing');
addCheck('export-pass', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? 'pass' : 'fail'}` : 'export missing');

let exportArchive = null;
if (exportSurface) {
  exportArchive = path.join(exportSurface.absoluteDir, 'ops-export.tgz');
  addCheck('export-archive-present', fs.existsSync(exportArchive), fs.existsSync(exportArchive) ? path.relative(rootDir, exportArchive) : `missing ${path.relative(rootDir, exportArchive)}`);
  if (index?.payload?.latest?.export?.relativeDir) {
    addCheck('index-latest-export-aligned', index.payload.latest.export.relativeDir === exportSurface.relativeDir, `index export=${index.payload.latest.export.relativeDir}`);
  }
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const restoreDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const restoredRoot = path.join(restoreDir, 'restored');
fs.mkdirSync(restoredRoot, { recursive: true });

if (exportArchive && fs.existsSync(exportArchive)) {
  const tarResult = spawnSync('tar', ['-xzf', exportArchive, '-C', restoredRoot], { stdio: 'pipe' });
  addCheck('export-archive-extracted', tarResult.status === 0, tarResult.status === 0 ? `extracted ${path.relative(rootDir, exportArchive)}` : (tarResult.stderr?.toString().trim() || tarResult.stdout?.toString().trim() || `tar exited with ${tarResult.status}`));
} else {
  addCheck('export-archive-extracted', false, 'export archive missing');
}

const requiredPayloadFiles = [
  ['releasepack-json', path.join(restoredRoot, 'payload', 'releasepack', 'ops-releasepack.json')],
  ['gate-json', path.join(restoredRoot, 'payload', 'gate', 'ops-gate.json')],
  ['handoff-json', path.join(restoredRoot, 'payload', 'handoff', 'ops-handoff.json')],
  ['attestation-json', path.join(restoredRoot, 'payload', 'attestation', 'ops-attestation.json')],
  ['ready-json', path.join(restoredRoot, 'payload', 'ready', 'ops-ready.json')],
  ['index-json', path.join(restoredRoot, 'payload', 'index', 'ops-index.json')],
  ['release-playbook', path.join(restoredRoot, 'payload', 'docs', 'release-playbook.md')],
  ['production-readiness', path.join(restoredRoot, 'payload', 'docs', 'production-readiness.md')],
  ['env-example', path.join(restoredRoot, 'payload', 'env', '.env.example')],
];

for (const [id, filePath] of requiredPayloadFiles) {
  addCheck(`payload-${id}`, fs.existsSync(filePath), fs.existsSync(filePath) ? path.relative(rootDir, filePath) : `missing ${path.relative(rootDir, filePath)}`);
}

const restoredReleaseDir = path.join(restoredRoot, 'payload', 'release');
const restoredReleaseFiles = fs.existsSync(restoredReleaseDir) ? fs.readdirSync(restoredReleaseDir).sort() : [];
const restoredManifestFiles = restoredReleaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const restoredInstallerFiles = restoredReleaseFiles.filter((file) => !restoredManifestFiles.includes(file));

if (requireReleaseOutput) {
  addCheck('restored-release-dir', fs.existsSync(restoredReleaseDir), fs.existsSync(restoredReleaseDir) ? path.relative(rootDir, restoredReleaseDir) : 'restored release directory missing');
  addCheck('restored-manifests', restoredManifestFiles.length > 0, restoredManifestFiles.length > 0 ? restoredManifestFiles.join(', ') : 'no restored manifests');
  addCheck('restored-installers', restoredInstallerFiles.length > 0, restoredInstallerFiles.length > 0 ? restoredInstallerFiles.join(', ') : 'no restored installers');
} else {
  addCheck('restored-release-optional', true, restoredReleaseFiles.length > 0 ? `restored release files: ${restoredReleaseFiles.length}` : 'release output not required');
}

let restoredIndex = null;
const restoredIndexPath = path.join(restoredRoot, 'payload', 'index', 'ops-index.json');
if (fs.existsSync(restoredIndexPath)) {
  restoredIndex = JSON.parse(fs.readFileSync(restoredIndexPath, 'utf8'));
  addCheck('restored-index-loaded', true, `restored exports=${restoredIndex.counts?.exports ?? 0}`);
}

const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  restoreDir: path.relative(rootDir, restoreDir),
  restoredPayloadDir: path.relative(rootDir, path.join(restoredRoot, 'payload')),
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,
  },
  restored: {
    manifests: restoredManifestFiles,
    installers: restoredInstallerFiles,
  },
  checks,
};

fs.writeFileSync(path.join(restoreDir, 'ops-restore.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Restore',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Restore Dir: ${summary.restoreDir}`,
  `- Restored Payload Dir: ${summary.restoredPayloadDir}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  `- Export: ${summary.latest.export?.dir ?? 'missing'}`,
  '',
  '## Restored Release Inventory',
  '',
  `- Restored manifests: ${summary.restored.manifests.length > 0 ? summary.restored.manifests.join(', ') : 'none'}`,
  `- Restored installers: ${summary.restored.installers.length > 0 ? summary.restored.installers.join(', ') : 'none'}`,
  '',
  '## Checks',
  '',
  ...summary.checks.map((check) => `- [${check.ok ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## Operator Next Steps',
  '',
  '- Use this restore directory as proof that the latest offline export can be rehydrated outside CI artifacts.',
  '- Re-run `pnpm ops:restore -- --label <name> --require-release-output` after any packaging or release-surface change.',
  '- Attach `ops-restore.json` and `ops-restore.md` when handoff requires a final restore rehearsal record.',
  '',
];
fs.writeFileSync(path.join(restoreDir, 'ops-restore.md'), lines.join('\n') + '\n');
console.log(`Operations restore written to: ${restoreDir}`);
if (!ok) process.exit(1);
NODE

pnpm ops:index -- --label "$LABEL"
