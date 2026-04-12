#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_ESCALATE_DIR:-ops/escalations}"
KEEP="${OPS_ESCALATE_KEEP:-10}"
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
      echo "Unsupported ops escalate argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Escalation keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

incident_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  incident_args+=(--require-release-output)
fi
pnpm ops:incident "${incident_args[@]}"
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

const copyDirIfExists = (source, destination) => {
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
  return true;
};
const copyDirWithoutArchives = (source, destination) => {
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (entry) => !entry.endsWith('.tgz'),
  });
  return true;
};

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const incident = readLatest(path.join(rootDir, 'ops', 'incidents'), 'ops-incident.json');
const handoff = readLatest(path.join(rootDir, 'ops', 'handoffs'), 'ops-handoff.json');
const attestation = readLatest(path.join(rootDir, 'ops', 'attestations'), 'ops-attestation.json');
const gate = readLatest(path.join(rootDir, 'ops', 'gates'), 'ops-gate.json');
const releasePack = readLatest(path.join(rootDir, 'ops', 'releasepacks'), 'ops-releasepack.json');
const exportSurface = readLatest(path.join(rootDir, 'ops', 'exports'), 'ops-export.json');
const rollback = readLatest(path.join(rootDir, 'ops', 'rollbacks'), 'ops-rollback.json');
const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });
for (const [id, surface] of [
  ['index-present', index],
  ['incident-present', incident],
  ['handoff-present', handoff],
  ['attestation-present', attestation],
  ['gate-present', gate],
  ['releasepack-present', releasePack],
  ['export-present', exportSurface],
  ['rollback-present', rollback],
]) {
  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);
}
addCheck('incident-pass', incident?.payload?.ok === true, incident ? `incident verdict=${incident.payload?.ok ? 'pass' : 'fail'}` : 'incident missing');
addCheck('handoff-pass', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? 'pass' : 'fail'}` : 'handoff missing');
addCheck('attestation-pass', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? 'pass' : 'fail'}` : 'attestation missing');
addCheck('gate-go', gate?.payload?.ok === true, gate ? `gate verdict=${gate.payload?.ok ? 'go' : 'no-go'}` : 'gate missing');
addCheck('releasepack-pass', releasePack?.payload?.ok === true, releasePack ? `releasepack verdict=${releasePack.payload?.ok ? 'pass' : 'fail'}` : 'releasepack missing');
addCheck('export-pass', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? 'pass' : 'fail'}` : 'export missing');
addCheck('rollback-pass', rollback?.payload?.ok === true, rollback ? `rollback verdict=${rollback.payload?.ok ? 'pass' : 'fail'}` : 'rollback missing');
if (index?.payload?.latest?.incident?.relativeDir && incident) {
  addCheck('index-latest-incident-aligned', index.payload.latest.incident.relativeDir === incident.relativeDir, `index incident=${index.payload.latest.incident.relativeDir}`);
}

if (requireReleaseOutput) {
  addCheck('release-manifests', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(', ') : 'no release manifests');
  addCheck('release-installers', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(', ') : 'no release installers');
} else {
  addCheck('release-output-optional', true, releaseFiles.length > 0 ? `release files present: ${releaseFiles.length}` : 'release output not required');
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const escalationDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(escalationDir, 'packet');
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
  incident: copySurface(incident, 'incident', ['ops-incident.json', 'ops-incident.md', 'ops-incident.tgz']),
  handoff: copySurface(handoff, 'handoff', ['ops-handoff.json', 'ops-handoff.md', 'ops-handoff.tgz']),
  attestation: copySurface(attestation, 'attestation', ['ops-attestation.json', 'ops-attestation.md']),
  gate: copySurface(gate, 'gate', ['ops-gate.json', 'ops-gate.md']),
  releasePack: copySurface(releasePack, 'releasepack', ['ops-releasepack.json', 'ops-releasepack.md', 'ops-releasepack.tgz']),
  export: copySurface(exportSurface, 'export', ['ops-export.json', 'ops-export.md', 'ops-export.tgz']),
  rollback: copySurface(rollback, 'rollback', ['ops-rollback.json', 'ops-rollback.md']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  incidentPacket: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

const incidentPacketDir = incident ? path.join(incident.absoluteDir, 'packet') : null;
if (copyDirIfExists(incidentPacketDir, path.join(packetDir, 'incident', 'packet'))) {
  copied.incidentPacket.push(path.join('packet', 'incident', 'packet'));
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

const rerunCommand = `pnpm ops:escalate -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim();
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  escalationDir: path.relative(rootDir, escalationDir),
  archivePath: path.join(path.relative(rootDir, escalationDir), 'ops-escalate.tgz'),
  packetDir: path.join(path.relative(rootDir, escalationDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    incident: incident ? { dir: incident.relativeDir, modifiedAt: incident.modifiedAt, ok: incident.payload?.ok === true } : null,
    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,
    attestation: attestation ? { dir: attestation.relativeDir, modifiedAt: attestation.modifiedAt, ok: attestation.payload?.ok === true } : null,
    gate: gate ? { dir: gate.relativeDir, modifiedAt: gate.modifiedAt, ok: gate.payload?.ok === true } : null,
    releasePack: releasePack ? { dir: releasePack.relativeDir, modifiedAt: releasePack.modifiedAt, ok: releasePack.payload?.ok === true } : null,
    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,
    rollback: rollback ? { dir: rollback.relativeDir, modifiedAt: rollback.modifiedAt, ok: rollback.payload?.ok === true } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(escalationDir, 'ops-escalate.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Escalation Handoff',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Escalation Dir: ${summary.escalationDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Incident: ${summary.latest.incident?.dir ?? 'missing'}`,
  `- Handoff: ${summary.latest.handoff?.dir ?? 'missing'}`,
  `- Attestation: ${summary.latest.attestation?.dir ?? 'missing'}`,
  `- Gate: ${summary.latest.gate?.dir ?? 'missing'}`,
  `- Release Pack: ${summary.latest.releasePack?.dir ?? 'missing'}`,
  `- Export: ${summary.latest.export?.dir ?? 'missing'}`,
  `- Rollback: ${summary.latest.rollback?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Packet Counts',
  '',
  `- Incident files: ${summary.copied.incident.length}`,
  `- Incident packet trees: ${summary.copied.incidentPacket.length}`,
  `- Handoff files: ${summary.copied.handoff.length}`,
  `- Attestation files: ${summary.copied.attestation.length}`,
  `- Gate files: ${summary.copied.gate.length}`,
  `- Release pack files: ${summary.copied.releasePack.length}`,
  `- Export files: ${summary.copied.export.length}`,
  `- Rollback files: ${summary.copied.rollback.length}`,
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
  '- Attach `ops-escalate.tgz` when the latest incident packet needs to move across teams with rollback, attestation, handoff, and release evidence preserved together.',
  '- Use `ops-escalate.json` as the machine-readable escalation record for incident command, support escalation, or release rollback review.',
  '- Re-run `pnpm ops:escalate -- --label <name> --require-release-output` after any incident, attestation, release pack, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(escalationDir, 'ops-escalate.md'), lines.join('\n') + '\n');
console.log(`Operations escalation written to: ${escalationDir}`);
if (!ok) process.exit(1);
NODE

escalation_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$escalation_dir" ]; then
  echo "Failed to locate generated ops escalation directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$escalation_dir/ops-escalate.tgz" -C "$escalation_dir" packet
echo "Operations escalation archive written to: $escalation_dir/ops-escalate.tgz"
pnpm ops:index -- --label "$LABEL"
