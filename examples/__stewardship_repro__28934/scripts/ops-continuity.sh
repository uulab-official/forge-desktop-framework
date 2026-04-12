#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="${OPS_CONTINUITY_LABEL:-continuity}"
OUTPUT_ROOT="${OPS_CONTINUITY_DIR:-ops/continuity}"
KEEP="${OPS_RETENTION_KEEP:-10}"
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
      echo "Unsupported ops continuity argument: $1"
      echo "Use --label <name>, --output-dir <path>, --keep <count>, --require-release-output, and --skip-retention."
      exit 1
      ;;
  esac
  shift
done

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

escalate_args=(-- --label "$LABEL" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  escalate_args+=(--require-release-output)
fi
pnpm ops:escalate "${escalate_args[@]}"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, outputRoot, label, requireReleaseOutputRaw, skipRetentionRaw, keepRaw] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputRaw === '1';
const skipRetention = skipRetentionRaw === '1';
const keep = Number(keepRaw);
const releaseDir = path.join(rootDir, 'release');

const loadLatestSurface = (root, fileName) => {
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root)
    .map((entry) => path.join(root, entry))
    .filter((entry) => fs.existsSync(path.join(entry, fileName)))
    .map((entry) => ({
      absoluteDir: entry,
      relativeDir: path.relative(rootDir, entry),
      file: path.join(entry, fileName),
      modifiedAt: fs.statSync(path.join(entry, fileName)).mtimeMs,
    }))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
  if (dirs.length === 0) return null;
  const latest = dirs[0];
  return {
    ...latest,
    modifiedAt: new Date(latest.modifiedAt).toISOString(),
    payload: JSON.parse(fs.readFileSync(latest.file, 'utf8')),
  };
};

const copyIfExists = (source, destination) => {
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
};

const copyDirIfExists = (source, destination) => {
  if (!source || !fs.existsSync(source)) return false;
  fs.cpSync(source, destination, { recursive: true });
  return true;
};

const addCheck = (id, ok, detail, checks) => checks.push({ id, ok: Boolean(ok), detail });
const manifestFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).filter((file) => /^latest.*\.yml$/i.test(file)).sort() : [];
const installerFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).filter((file) => /\.(dmg|exe|appimage|zip|blockmap|pkg)$/i.test(file)).sort() : [];
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const index = loadLatestSurface(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const escalate = loadLatestSurface(path.join(rootDir, 'ops', 'escalations'), 'ops-escalate.json');
const incident = loadLatestSurface(path.join(rootDir, 'ops', 'incidents'), 'ops-incident.json');
const rollback = loadLatestSurface(path.join(rootDir, 'ops', 'rollbacks'), 'ops-rollback.json');
const recover = loadLatestSurface(path.join(rootDir, 'ops', 'recoveries'), 'ops-recover.json');
const restore = loadLatestSurface(path.join(rootDir, 'ops', 'restores'), 'ops-restore.json');
const exportSurface = loadLatestSurface(path.join(rootDir, 'ops', 'exports'), 'ops-export.json');
const releasePack = loadLatestSurface(path.join(rootDir, 'ops', 'releasepacks'), 'ops-releasepack.json');
const gate = loadLatestSurface(path.join(rootDir, 'ops', 'gates'), 'ops-gate.json');
const attestation = loadLatestSurface(path.join(rootDir, 'ops', 'attestations'), 'ops-attestation.json');

const checks = [];
addCheck('escalation-pass', escalate?.payload?.ok === true, escalate ? `escalation verdict=${escalate.payload?.ok ? 'pass' : 'fail'}` : 'escalation missing', checks);
addCheck('incident-pass', incident?.payload?.ok === true, incident ? `incident verdict=${incident.payload?.ok ? 'pass' : 'fail'}` : 'incident missing', checks);
addCheck('rollback-pass', rollback?.payload?.ok === true, rollback ? `rollback verdict=${rollback.payload?.ok ? 'pass' : 'fail'}` : 'rollback missing', checks);
addCheck('recover-pass', recover?.payload?.ok === true, recover ? `recover verdict=${recover.payload?.ok ? 'pass' : 'fail'}` : 'recover missing', checks);
addCheck('restore-pass', restore?.payload?.ok === true, restore ? `restore verdict=${restore.payload?.ok ? 'pass' : 'fail'}` : 'restore missing', checks);
addCheck('export-pass', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? 'pass' : 'fail'}` : 'export missing', checks);
addCheck('releasepack-pass', releasePack?.payload?.ok === true, releasePack ? `releasepack verdict=${releasePack.payload?.ok ? 'pass' : 'fail'}` : 'releasepack missing', checks);
addCheck('gate-go', gate?.payload?.ok === true, gate ? `gate verdict=${gate.payload?.ok ? 'go' : 'no-go'}` : 'gate missing', checks);
addCheck('attestation-pass', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? 'pass' : 'fail'}` : 'attestation missing', checks);
if (index?.payload?.latest?.escalation?.relativeDir && escalate) {
  addCheck('index-latest-escalation-aligned', index.payload.latest.escalation.relativeDir === escalate.relativeDir, `index escalation=${index.payload.latest.escalation.relativeDir}`, checks);
}

if (requireReleaseOutput) {
  addCheck('release-manifests', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(', ') : 'no release manifests', checks);
  addCheck('release-installers', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(', ') : 'no release installers', checks);
} else {
  addCheck('release-output-optional', true, manifestFiles.length + installerFiles.length > 0 ? `release files present: ${manifestFiles.length + installerFiles.length}` : 'release output not required', checks);
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const continuityDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(continuityDir, 'packet');
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
  escalation: copySurface(escalate, 'escalation', ['ops-escalate.json', 'ops-escalate.md', 'ops-escalate.tgz']),
  incident: copySurface(incident, 'incident', ['ops-incident.json', 'ops-incident.md', 'ops-incident.tgz']),
  rollback: copySurface(rollback, 'rollback', ['ops-rollback.json', 'ops-rollback.md']),
  recover: copySurface(recover, 'recover', ['ops-recover.json', 'ops-recover.md']),
  restore: copySurface(restore, 'restore', ['ops-restore.json', 'ops-restore.md']),
  export: copySurface(exportSurface, 'export', ['ops-export.json', 'ops-export.md', 'ops-export.tgz']),
  releasePack: copySurface(releasePack, 'releasepack', ['ops-releasepack.json', 'ops-releasepack.md', 'ops-releasepack.tgz']),
  gate: copySurface(gate, 'gate', ['ops-gate.json', 'ops-gate.md']),
  attestation: copySurface(attestation, 'attestation', ['ops-attestation.json', 'ops-attestation.md']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  escalationPacket: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

const escalationPacketDir = escalate ? path.join(escalate.absoluteDir, 'packet') : null;
if (copyDirIfExists(escalationPacketDir, path.join(packetDir, 'escalation', 'packet'))) {
  copied.escalationPacket.push(path.join('packet', 'escalation', 'packet'));
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

const rerunCommand = `pnpm ops:continuity -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim();
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  continuityDir: path.relative(rootDir, continuityDir),
  archivePath: path.join(path.relative(rootDir, continuityDir), 'ops-continuity.tgz'),
  packetDir: path.join(path.relative(rootDir, continuityDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    escalation: escalate ? { dir: escalate.relativeDir, modifiedAt: escalate.modifiedAt, ok: escalate.payload?.ok === true } : null,
    incident: incident ? { dir: incident.relativeDir, modifiedAt: incident.modifiedAt, ok: incident.payload?.ok === true } : null,
    rollback: rollback ? { dir: rollback.relativeDir, modifiedAt: rollback.modifiedAt, ok: rollback.payload?.ok === true } : null,
    recover: recover ? { dir: recover.relativeDir, modifiedAt: recover.modifiedAt, ok: recover.payload?.ok === true } : null,
    restore: restore ? { dir: restore.relativeDir, modifiedAt: restore.modifiedAt, ok: restore.payload?.ok === true } : null,
    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,
    releasePack: releasePack ? { dir: releasePack.relativeDir, modifiedAt: releasePack.modifiedAt, ok: releasePack.payload?.ok === true } : null,
    gate: gate ? { dir: gate.relativeDir, modifiedAt: gate.modifiedAt, ok: gate.payload?.ok === true } : null,
    attestation: attestation ? { dir: attestation.relativeDir, modifiedAt: attestation.modifiedAt, ok: attestation.payload?.ok === true } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(continuityDir, 'ops-continuity.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Continuity Handoff',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Continuity Dir: ${summary.continuityDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Escalation: ${summary.latest.escalation?.dir ?? 'missing'}`,
  `- Incident: ${summary.latest.incident?.dir ?? 'missing'}`,
  `- Rollback: ${summary.latest.rollback?.dir ?? 'missing'}`,
  `- Recover: ${summary.latest.recover?.dir ?? 'missing'}`,
  `- Restore: ${summary.latest.restore?.dir ?? 'missing'}`,
  `- Export: ${summary.latest.export?.dir ?? 'missing'}`,
  `- Release Pack: ${summary.latest.releasePack?.dir ?? 'missing'}`,
  `- Gate: ${summary.latest.gate?.dir ?? 'missing'}`,
  `- Attestation: ${summary.latest.attestation?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Packet Counts',
  '',
  `- Escalation files: ${summary.copied.escalation.length}`,
  `- Escalation packet trees: ${summary.copied.escalationPacket.length}`,
  `- Incident files: ${summary.copied.incident.length}`,
  `- Rollback files: ${summary.copied.rollback.length}`,
  `- Recover files: ${summary.copied.recover.length}`,
  `- Restore files: ${summary.copied.restore.length}`,
  `- Export files: ${summary.copied.export.length}`,
  `- Release pack files: ${summary.copied.releasePack.length}`,
  `- Gate files: ${summary.copied.gate.length}`,
  `- Attestation files: ${summary.copied.attestation.length}`,
  `- Index files: ${summary.copied.index.length}`,
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
  '- Attach `ops-continuity.tgz` when the latest escalation packet must travel across release, support, and recovery stakeholders as one continuity handoff.',
  '- Use `ops-continuity.json` as the machine-readable continuity record for war-room, rollback, or disaster-recovery review.',
  '- Re-run `pnpm ops:continuity -- --label <name> --require-release-output` after any escalation, rollback, export, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(continuityDir, 'ops-continuity.md'), lines.join('\n') + '\n');
console.log(`Operations continuity written to: ${continuityDir}`);
if (!ok) process.exit(1);
NODE

continuity_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$continuity_dir" ]; then
  echo "Failed to locate generated ops continuity directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$continuity_dir/ops-continuity.tgz" -C "$continuity_dir" packet
echo "Operations continuity archive written to: $continuity_dir/ops-continuity.tgz"
pnpm ops:index -- --label "$LABEL"
