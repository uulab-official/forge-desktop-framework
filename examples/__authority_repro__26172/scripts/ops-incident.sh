#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_INCIDENT_DIR:-ops/incidents}"
KEEP="${OPS_INCIDENT_KEEP:-10}"
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
      echo "Unsupported ops incident argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Incident keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

rollback_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  rollback_args+=(--require-release-output)
fi
pnpm ops:rollback "${rollback_args[@]}"
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
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
};

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const report = readLatest(path.join(rootDir, 'ops', 'reports'), 'ops-report.json');
const handoff = readLatest(path.join(rootDir, 'ops', 'handoffs'), 'ops-handoff.json');
const gate = readLatest(path.join(rootDir, 'ops', 'gates'), 'ops-gate.json');
const exportSurface = readLatest(path.join(rootDir, 'ops', 'exports'), 'ops-export.json');
const recovery = readLatest(path.join(rootDir, 'ops', 'recoveries'), 'ops-recover.json');
const rollback = readLatest(path.join(rootDir, 'ops', 'rollbacks'), 'ops-rollback.json');
const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });
for (const [id, surface] of [
  ['index-present', index],
  ['report-present', report],
  ['handoff-present', handoff],
  ['gate-present', gate],
  ['export-present', exportSurface],
  ['recovery-present', recovery],
  ['rollback-present', rollback],
]) {
  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);
}
addCheck('handoff-pass', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? 'pass' : 'fail'}` : 'handoff missing');
addCheck('gate-go', gate?.payload?.ok === true, gate ? `gate verdict=${gate.payload?.ok ? 'go' : 'no-go'}` : 'gate missing');
addCheck('export-pass', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? 'pass' : 'fail'}` : 'export missing');
addCheck('recovery-pass', recovery?.payload?.ok === true, recovery ? `recovery verdict=${recovery.payload?.ok ? 'pass' : 'fail'}` : 'recovery missing');
addCheck('rollback-pass', rollback?.payload?.ok === true, rollback ? `rollback verdict=${rollback.payload?.ok ? 'pass' : 'fail'}` : 'rollback missing');
if (index?.payload?.latest?.rollback?.relativeDir && rollback) {
  addCheck('index-latest-rollback-aligned', index.payload.latest.rollback.relativeDir === rollback.relativeDir, `index rollback=${index.payload.latest.rollback.relativeDir}`);
}

const rollbackProofDir = rollback?.payload?.proofDir ? path.join(rootDir, rollback.payload.proofDir) : null;
addCheck('rollback-proof-dir', Boolean(rollbackProofDir && fs.existsSync(rollbackProofDir)), rollbackProofDir ? (fs.existsSync(rollbackProofDir) ? path.relative(rootDir, rollbackProofDir) : `missing ${path.relative(rootDir, rollbackProofDir)}`) : 'rollback proof missing');

if (requireReleaseOutput) {
  addCheck('release-manifests', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(', ') : 'no release manifests');
  addCheck('release-installers', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(', ') : 'no release installers');
} else {
  addCheck('release-output-optional', true, releaseFiles.length > 0 ? `release files present: ${releaseFiles.length}` : 'release output not required');
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const incidentDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(incidentDir, 'packet');
fs.mkdirSync(packetDir, { recursive: true });

const copySurface = (surface, key, names) => {
  if (!surface) return [];
  const copied = [];
  for (const name of names) {
    const source = path.join(surface.absoluteDir, name);
    const destination = path.join(packetDir, key, name);
    if (copyIfExists(source, destination)) copied.push(path.join('packet', key, name));
  }
  return copied;
};

const copied = {
  rollback: copySurface(rollback, 'rollback', ['ops-rollback.json', 'ops-rollback.md']),
  recovery: copySurface(recovery, 'recovery', ['ops-recover.json', 'ops-recover.md']),
  handoff: copySurface(handoff, 'handoff', ['ops-handoff.json', 'ops-handoff.md', 'ops-handoff.tgz']),
  gate: copySurface(gate, 'gate', ['ops-gate.json', 'ops-gate.md']),
  export: copySurface(exportSurface, 'export', ['ops-export.json', 'ops-export.md', 'ops-export.tgz']),
  report: copySurface(report, 'report', ['ops-report.json', 'ops-report.md']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  proof: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

if (rollbackProofDir) {
  for (const [surface, fileName] of [
    ['recover', 'ops-recover.json'],
    ['recover', 'ops-recover.md'],
    ['restore', 'ops-restore.json'],
    ['restore', 'ops-restore.md'],
    ['gate', 'ops-gate.json'],
    ['gate', 'ops-gate.md'],
    ['export', 'ops-export.json'],
    ['export', 'ops-export.md'],
  ]) {
    const source = path.join(rollbackProofDir, surface, fileName);
    const destination = path.join(packetDir, 'proof', surface, fileName);
    if (copyIfExists(source, destination)) copied.proof.push(path.join('packet', 'proof', surface, fileName));
  }
}
for (const relativeDoc of [path.join('docs', 'release-playbook.md'), path.join('docs', 'production-readiness.md')]) {
  const source = path.join(rootDir, relativeDoc);
  const destination = path.join(packetDir, 'docs', path.basename(relativeDoc));
  if (copyIfExists(source, destination)) copied.docs.push(relativeDoc);
}
if (copyIfExists(path.join(rootDir, '.env.example'), path.join(packetDir, 'env', '.env.example'))) copied.env.push('.env.example');
for (const file of manifestFiles) {
  if (copyIfExists(path.join(releaseDir, file), path.join(packetDir, 'release', file))) copied.manifests.push(path.join('packet', 'release', file));
}
for (const file of installerFiles) {
  if (copyIfExists(path.join(releaseDir, file), path.join(packetDir, 'release', file))) copied.installers.push(path.join('packet', 'release', file));
}

const rerunCommand = `pnpm ops:incident -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''}`;
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  incidentDir: path.relative(rootDir, incidentDir),
  archivePath: path.join(path.relative(rootDir, incidentDir), 'ops-incident.tgz'),
  packetDir: path.join(path.relative(rootDir, incidentDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,
    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,
    gate: gate ? { dir: gate.relativeDir, modifiedAt: gate.modifiedAt, ok: gate.payload?.ok === true } : null,
    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,
    recovery: recovery ? { dir: recovery.relativeDir, modifiedAt: recovery.modifiedAt, ok: recovery.payload?.ok === true } : null,
    rollback: rollback ? { dir: rollback.relativeDir, modifiedAt: rollback.modifiedAt, ok: rollback.payload?.ok === true } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(incidentDir, 'ops-incident.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Incident Packet',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Incident Dir: ${summary.incidentDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Report: ${summary.latest.report?.dir ?? 'missing'}`,
  `- Handoff: ${summary.latest.handoff?.dir ?? 'missing'}`,
  `- Gate: ${summary.latest.gate?.dir ?? 'missing'}`,
  `- Export: ${summary.latest.export?.dir ?? 'missing'}`,
  `- Recovery: ${summary.latest.recovery?.dir ?? 'missing'}`,
  `- Rollback: ${summary.latest.rollback?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Packet Counts',
  '',
  `- Rollback files: ${summary.copied.rollback.length}`,
  `- Recovery files: ${summary.copied.recovery.length}`,
  `- Handoff files: ${summary.copied.handoff.length}`,
  `- Gate files: ${summary.copied.gate.length}`,
  `- Export files: ${summary.copied.export.length}`,
  `- Report files: ${summary.copied.report.length}`,
  `- Index files: ${summary.copied.index.length}`,
  `- Proof files: ${summary.copied.proof.length}`,
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
  '- Attach `ops-incident.tgz` when handing the packaged release to support, SRE, or incident response operators.',
  '- Use `ops-incident.json` as the machine-readable incident packet for escalations that need the latest rollback, gate, handoff, and export proof in one place.',
  '- Re-run `pnpm ops:incident -- --label <name> --require-release-output` after any rollback, export, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(incidentDir, 'ops-incident.md'), lines.join('\n') + '\n');
console.log(`Operations incident packet written to: ${incidentDir}`);
if (!ok) process.exit(1);
NODE

incident_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$incident_dir" ]; then
  echo "Failed to locate generated ops incident directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$incident_dir/ops-incident.tgz" -C "$incident_dir" packet
echo "Operations incident archive written to: $incident_dir/ops-incident.tgz"
pnpm ops:index -- --label "$LABEL"
