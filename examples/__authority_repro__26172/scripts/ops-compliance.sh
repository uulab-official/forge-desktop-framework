#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_COMPLIANCE_DIR:-ops/compliance}"
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
      echo "Unsupported ops compliance argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, --keep <count>, --require-release-output, and --skip-retention."
      exit 1
      ;;
  esac
  shift
done

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

integrity_args=(-- --label "$LABEL" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  integrity_args+=(--require-release-output)
fi
pnpm ops:integrity "${integrity_args[@]}"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputFlag === '1';
const skipRetention = skipRetentionFlag === '1';
const packageJsonPath = path.join(rootDir, 'package.json');
const releaseDir = path.join(rootDir, 'release');
const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) : { name: path.basename(rootDir), version: '0.0.0' };

const loadLatestSurface = (root, fileName) => {
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root)
    .map((entry) => path.join(root, entry))
    .filter((entry) => fs.existsSync(path.join(entry, fileName)))
    .map((entry) => ({
      absoluteDir: entry,
      relativeDir: path.relative(rootDir, entry),
      modifiedAt: new Date(fs.statSync(entry).mtimeMs).toISOString(),
      payload: JSON.parse(fs.readFileSync(path.join(entry, fileName), 'utf8')),
    }))
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  return dirs[0] ?? null;
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

const addCheck = (id, ok, detail, checks) => {
  checks.push({ id, ok: Boolean(ok), detail });
};

const manifestFiles = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((file) => /^latest([.-].+)?\.ya?ml$/i.test(file)).sort()
  : [];
const installerFiles = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((file) => !/^latest([.-].+)?\.ya?ml$/i.test(file)).sort()
  : [];

const index = loadLatestSurface(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const integrity = loadLatestSurface(path.join(rootDir, 'ops', 'integrity'), 'ops-integrity.json');
const runbook = loadLatestSurface(path.join(rootDir, 'ops', 'runbooks'), 'ops-runbook.json');
const resilience = loadLatestSurface(path.join(rootDir, 'ops', 'resilience'), 'ops-resilience.json');
const continuity = loadLatestSurface(path.join(rootDir, 'ops', 'continuity'), 'ops-continuity.json');
const escalation = loadLatestSurface(path.join(rootDir, 'ops', 'escalations'), 'ops-escalate.json');
const incident = loadLatestSurface(path.join(rootDir, 'ops', 'incidents'), 'ops-incident.json');
const rollback = loadLatestSurface(path.join(rootDir, 'ops', 'rollbacks'), 'ops-rollback.json');
const recover = loadLatestSurface(path.join(rootDir, 'ops', 'recoveries'), 'ops-recover.json');
const restore = loadLatestSurface(path.join(rootDir, 'ops', 'restores'), 'ops-restore.json');
const exportSurface = loadLatestSurface(path.join(rootDir, 'ops', 'exports'), 'ops-export.json');
const releasePack = loadLatestSurface(path.join(rootDir, 'ops', 'releasepacks'), 'ops-releasepack.json');
const gate = loadLatestSurface(path.join(rootDir, 'ops', 'gates'), 'ops-gate.json');
const attestation = loadLatestSurface(path.join(rootDir, 'ops', 'attestations'), 'ops-attestation.json');

const checks = [];
addCheck('integrity-pass', integrity?.payload?.ok === true, integrity ? `integrity verdict=${integrity.payload?.ok ? 'pass' : 'fail'}` : 'integrity missing', checks);
addCheck('integrity-archive', integrity ? fs.existsSync(path.join(integrity.absoluteDir, 'ops-integrity.tgz')) : false, integrity ? 'ops-integrity.tgz present' : 'integrity missing', checks);
addCheck('integrity-packet-runbook', integrity ? fs.existsSync(path.join(integrity.absoluteDir, 'packet', 'runbook', 'ops-runbook.json')) : false, integrity ? 'integrity packet contains runbook record' : 'integrity missing', checks);
addCheck('runbook-pass', runbook?.payload?.ok === true, runbook ? `runbook verdict=${runbook.payload?.ok ? 'pass' : 'fail'}` : 'runbook missing', checks);
addCheck('resilience-pass', resilience?.payload?.ok === true, resilience ? `resilience verdict=${resilience.payload?.ok ? 'pass' : 'fail'}` : 'resilience missing', checks);
addCheck('continuity-pass', continuity?.payload?.ok === true, continuity ? `continuity verdict=${continuity.payload?.ok ? 'pass' : 'fail'}` : 'continuity missing', checks);
addCheck('escalation-pass', escalation?.payload?.ok === true, escalation ? `escalation verdict=${escalation.payload?.ok ? 'pass' : 'fail'}` : 'escalation missing', checks);
addCheck('incident-pass', incident?.payload?.ok === true, incident ? `incident verdict=${incident.payload?.ok ? 'pass' : 'fail'}` : 'incident missing', checks);
addCheck('rollback-pass', rollback?.payload?.ok === true, rollback ? `rollback verdict=${rollback.payload?.ok ? 'pass' : 'fail'}` : 'rollback missing', checks);
addCheck('recover-pass', recover?.payload?.ok === true, recover ? `recover verdict=${recover.payload?.ok ? 'pass' : 'fail'}` : 'recover missing', checks);
addCheck('restore-pass', restore?.payload?.ok === true, restore ? `restore verdict=${restore.payload?.ok ? 'pass' : 'fail'}` : 'restore missing', checks);
addCheck('export-pass', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? 'pass' : 'fail'}` : 'export missing', checks);
addCheck('releasepack-pass', releasePack?.payload?.ok === true, releasePack ? `releasepack verdict=${releasePack.payload?.ok ? 'pass' : 'fail'}` : 'releasepack missing', checks);
addCheck('gate-go', gate?.payload?.ok === true, gate ? `gate verdict=${gate.payload?.ok ? 'go' : 'no-go'}` : 'gate missing', checks);
addCheck('attestation-pass', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? 'pass' : 'fail'}` : 'attestation missing', checks);
if (index?.payload?.latest?.integrity?.relativeDir && integrity) {
  addCheck('index-latest-integrity-aligned', index.payload.latest.integrity.relativeDir === integrity.relativeDir, `index integrity=${index.payload.latest.integrity.relativeDir}`, checks);
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
const complianceDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(complianceDir, 'packet');
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
  integrity: copySurface(integrity, 'integrity', ['ops-integrity.json', 'ops-integrity.md', 'ops-integrity.tgz']),
  runbook: copySurface(runbook, 'runbook', ['ops-runbook.json', 'ops-runbook.md', 'ops-runbook.tgz']),
  resilience: copySurface(resilience, 'resilience', ['ops-resilience.json', 'ops-resilience.md', 'ops-resilience.tgz']),
  continuity: copySurface(continuity, 'continuity', ['ops-continuity.json', 'ops-continuity.md', 'ops-continuity.tgz']),
  escalation: copySurface(escalation, 'escalation', ['ops-escalate.json', 'ops-escalate.md', 'ops-escalate.tgz']),
  incident: copySurface(incident, 'incident', ['ops-incident.json', 'ops-incident.md', 'ops-incident.tgz']),
  rollback: copySurface(rollback, 'rollback', ['ops-rollback.json', 'ops-rollback.md']),
  recover: copySurface(recover, 'recover', ['ops-recover.json', 'ops-recover.md']),
  restore: copySurface(restore, 'restore', ['ops-restore.json', 'ops-restore.md']),
  export: copySurface(exportSurface, 'export', ['ops-export.json', 'ops-export.md', 'ops-export.tgz']),
  releasePack: copySurface(releasePack, 'releasepack', ['ops-releasepack.json', 'ops-releasepack.md', 'ops-releasepack.tgz']),
  gate: copySurface(gate, 'gate', ['ops-gate.json', 'ops-gate.md']),
  attestation: copySurface(attestation, 'attestation', ['ops-attestation.json', 'ops-attestation.md']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  integrityPacket: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

const integrityPacketDir = integrity ? path.join(integrity.absoluteDir, 'packet') : null;
if (copyDirIfExists(integrityPacketDir, path.join(packetDir, 'integrity', 'packet'))) {
  copied.integrityPacket.push(path.join('packet', 'integrity', 'packet'));
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

const rerunCommand = `pnpm ops:compliance -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim();
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  complianceDir: path.relative(rootDir, complianceDir),
  archivePath: path.join(path.relative(rootDir, complianceDir), 'ops-compliance.tgz'),
  packetDir: path.join(path.relative(rootDir, complianceDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  recommendedCommands: [
    rerunCommand,
    `pnpm ops:integrity -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
    `pnpm ops:runbook -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
  ],
  latest: {
    integrity: integrity ? { dir: integrity.relativeDir, modifiedAt: integrity.modifiedAt, ok: integrity.payload?.ok === true } : null,
    runbook: runbook ? { dir: runbook.relativeDir, modifiedAt: runbook.modifiedAt, ok: runbook.payload?.ok === true } : null,
    resilience: resilience ? { dir: resilience.relativeDir, modifiedAt: resilience.modifiedAt, ok: resilience.payload?.ok === true } : null,
    continuity: continuity ? { dir: continuity.relativeDir, modifiedAt: continuity.modifiedAt, ok: continuity.payload?.ok === true } : null,
    escalation: escalation ? { dir: escalation.relativeDir, modifiedAt: escalation.modifiedAt, ok: escalation.payload?.ok === true } : null,
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

fs.writeFileSync(path.join(complianceDir, 'ops-compliance.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Compliance',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Compliance Dir: ${summary.complianceDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Integrity: ${summary.latest.integrity?.dir ?? 'missing'}`,
  `- Runbook: ${summary.latest.runbook?.dir ?? 'missing'}`,
  `- Resilience: ${summary.latest.resilience?.dir ?? 'missing'}`,
  `- Continuity: ${summary.latest.continuity?.dir ?? 'missing'}`,
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
  `- Integrity files: ${summary.copied.integrity.length}`,
  `- Integrity packet trees: ${summary.copied.integrityPacket.length}`,
  `- Runbook files: ${summary.copied.runbook.length}`,
  `- Resilience files: ${summary.copied.resilience.length}`,
  `- Continuity files: ${summary.copied.continuity.length}`,
  `- Escalation files: ${summary.copied.escalation.length}`,
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
  '## Operator Commands',
  '',
  ...summary.recommendedCommands.map((command) => `- ${command}`),
  '',
  '## Operator Next Steps',
  '',
  '- Attach `ops-compliance.tgz` when auditors or release approvers need one portable packet that includes the final integrity surface, operator docs, and packaged release evidence.',
  '- Use `ops-compliance.json` as the machine-readable final compliance verdict before external handoff, audit sign-off, or release board review.',
  '- Re-run `pnpm ops:compliance -- --label <name> --require-release-output` after any integrity, runbook, gate, export, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(complianceDir, 'ops-compliance.md'), lines.join('\n') + '\n');
console.log(`Operations compliance written to: ${complianceDir}`);
if (!ok) process.exit(1);
NODE

compliance_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$compliance_dir" ]; then
  echo "Failed to locate generated ops compliance directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$compliance_dir/ops-compliance.tgz" -C "$compliance_dir" packet
echo "Operations compliance archive written to: $compliance_dir/ops-compliance.tgz"
pnpm ops:index -- --label "$LABEL"
