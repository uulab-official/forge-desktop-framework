#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="${OPS_AUTHORITY_LABEL:-authority}"
OUTPUT_ROOT="${OPS_AUTHORITY_DIR:-ops/authority}"
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
    --require-release-output)
      REQUIRE_RELEASE_OUTPUT=1
      ;;
    --skip-retention)
      SKIP_RETENTION=1
      ;;
    --keep)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --keep"
        exit 1
      fi
      KEEP="$1"
      ;;
    --)
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
  shift || true
done

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

control_args=(-- --label "$LABEL" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  control_args+=(--require-release-output)
fi
pnpm ops:control "${control_args[@]}"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$LABEL" "$OUTPUT_ROOT" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, label, outputRoot, requireReleaseOutputRaw, skipRetentionRaw, keepRaw] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputRaw === '1';
const skipRetention = skipRetentionRaw === '1';
const keep = Number.parseInt(keepRaw, 10);
const releaseDir = path.join(rootDir, 'release');
const authorityRoot = path.join(rootDir, 'ops', 'authority');
const controlRoot = path.join(rootDir, 'ops', 'control');
const oversightRoot = path.join(rootDir, 'ops', 'oversight');
const governanceRoot = path.join(rootDir, 'ops', 'governance');
const assuranceRoot = path.join(rootDir, 'ops', 'assurances');
const indexRoot = path.join(rootDir, 'ops', 'index');
const packageJsonPath = path.join(rootDir, 'package.json');

const addCheck = (id, ok, detail, checks) => checks.push({ id, ok, detail });
const latestSurface = (root, marker) => {
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root)
    .map((entry) => path.join(root, entry))
    .filter((entry) => fs.existsSync(path.join(entry, marker)))
    .map((entry) => ({
      absoluteDir: entry,
      relativeDir: path.relative(rootDir, entry),
      modifiedAt: fs.statSync(entry).mtime.toISOString(),
      payload: JSON.parse(fs.readFileSync(path.join(entry, marker), 'utf8')),
    }))
    .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
  return dirs[0] ?? null;
};
const copyIfExists = (source, destination) => {
  if (!fs.existsSync(source)) return false;
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

const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) : { name: path.basename(rootDir), version: '0.0.0' };
const control = latestSurface(controlRoot, 'ops-control.json');
const oversight = latestSurface(oversightRoot, 'ops-oversight.json');
const governance = latestSurface(governanceRoot, 'ops-govern.json');
const assurance = latestSurface(assuranceRoot, 'ops-assure.json');
const index = latestSurface(indexRoot, 'ops-index.json');
const checks = [];
addCheck('control-present', Boolean(control), control ? control.relativeDir : 'missing latest control packet', checks);
addCheck('oversight-present', Boolean(oversight), oversight ? oversight.relativeDir : 'missing latest oversight packet', checks);
addCheck('governance-present', Boolean(governance), governance ? governance.relativeDir : 'missing latest governance packet', checks);
addCheck('assurance-present', Boolean(assurance), assurance ? assurance.relativeDir : 'missing latest assurance packet', checks);
addCheck('index-present', Boolean(index), index ? index.relativeDir : 'missing latest ops index', checks);
if (control) {
  addCheck('control-pass', control.payload?.ok === true, control.payload?.ok === true ? 'control verdict passed' : 'control verdict failed', checks);
  addCheck('control-archive-present', fs.existsSync(path.join(control.absoluteDir, 'ops-control.tgz')), fs.existsSync(path.join(control.absoluteDir, 'ops-control.tgz')) ? 'ops-control.tgz present' : 'ops-control.tgz missing', checks);
  addCheck('control-packet-tree-present', fs.existsSync(path.join(control.absoluteDir, 'packet')), fs.existsSync(path.join(control.absoluteDir, 'packet')) ? 'packet directory present' : 'packet directory missing', checks);
  addCheck('control-captures-oversight', Boolean(control.payload?.copied?.oversight?.length), control.payload?.copied?.oversight?.length ? `oversight files: ${control.payload.copied.oversight.length}` : 'control packet did not capture oversight files', checks);
  addCheck('control-package-version-match', control.payload?.package?.version === pkg.version, control.payload?.package?.version === pkg.version ? `version ${pkg.version}` : `control version mismatch: ${control.payload?.package?.version ?? 'unknown'} !== ${pkg.version}`, checks);
  addCheck('control-rerun-command', control.payload?.rerunCommand?.startsWith('pnpm ops:control -- --label '), control.payload?.rerunCommand ? control.payload.rerunCommand : 'missing control rerun command', checks);
  addCheck('control-recency-vs-oversight', !oversight || Date.parse(control.modifiedAt) >= Date.parse(oversight.modifiedAt), !oversight ? 'oversight missing' : Date.parse(control.modifiedAt) >= Date.parse(oversight.modifiedAt) ? 'control is newer than oversight' : 'control is older than oversight', checks);
  addCheck('index-latest-control-aligned', index?.payload?.latest?.control?.relativeDir === control.relativeDir, index?.payload?.latest?.control?.relativeDir ? `index control=${index.payload.latest.control.relativeDir}` : 'index missing control reference', checks);
  addCheck('index-recency-vs-control', !index || index?.payload?.latest?.control?.relativeDir === control.relativeDir || Date.parse(index.modifiedAt) >= Date.parse(control.modifiedAt), !index ? 'index missing' : index?.payload?.latest?.control?.relativeDir === control.relativeDir ? 'index already references the latest control packet' : Date.parse(index.modifiedAt) >= Date.parse(control.modifiedAt) ? 'index is newer than control' : 'index is older than control and will be refreshed after authority packaging', checks);
}

const manifestFiles = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((file) => /^latest.*\.ya?ml$/i.test(file))
  : [];
const installerFiles = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((file) => /\.(dmg|exe|appimage|zip|pkg)$/i.test(file))
  : [];
if (requireReleaseOutput) {
  addCheck('release-manifests-present', manifestFiles.length > 0, manifestFiles.length > 0 ? `manifests: ${manifestFiles.join(', ')}` : 'no latest*.yml manifests in release/', checks);
  addCheck('release-installers-present', installerFiles.length > 0, installerFiles.length > 0 ? `installers: ${installerFiles.join(', ')}` : 'no installers in release/', checks);
} else {
  addCheck('release-output-optional', true, manifestFiles.length + installerFiles.length > 0 ? `release files present: ${manifestFiles.length + installerFiles.length}` : 'release output not required', checks);
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const authorityDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(authorityDir, 'packet');
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
  control: copySurface(control, 'control', ['ops-control.json', 'ops-control.md']),
  oversight: copySurface(oversight, 'oversight', ['ops-oversight.json', 'ops-oversight.md']),
  governance: copySurface(governance, 'governance', ['ops-govern.json', 'ops-govern.md']),
  assurance: copySurface(assurance, 'assurance', ['ops-assure.json', 'ops-assure.md']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  controlPacket: [],
  oversightPacket: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

const controlPacketDir = control ? path.join(control.absoluteDir, 'packet') : null;
if (controlPacketDir && fs.existsSync(controlPacketDir)) {
  copied.controlPacket = [];
}
const oversightPacketDir = oversight ? path.join(oversight.absoluteDir, 'packet') : null;
if (oversightPacketDir && fs.existsSync(oversightPacketDir)) {
  copied.oversightPacket = [];
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

const rerunCommand = `pnpm ops:authority -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim();
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  authorityDir: path.relative(rootDir, authorityDir),
  archivePath: path.join(path.relative(rootDir, authorityDir), 'ops-authority.tgz'),
  packetDir: path.join(path.relative(rootDir, authorityDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  recommendedCommands: [
    rerunCommand,
    `pnpm ops:control -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
    `pnpm ops:oversight -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
  ],
  latest: {
    control: control ? { dir: control.relativeDir, modifiedAt: control.modifiedAt, ok: control.payload?.ok === true } : null,
    oversight: oversight ? { dir: oversight.relativeDir, modifiedAt: oversight.modifiedAt, ok: oversight.payload?.ok === true } : null,
    governance: governance ? { dir: governance.relativeDir, modifiedAt: governance.modifiedAt, ok: governance.payload?.ok === true } : null,
    assurance: assurance ? { dir: assurance.relativeDir, modifiedAt: assurance.modifiedAt, ok: assurance.payload?.ok === true } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(authorityDir, 'ops-authority.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Authority',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Authority Dir: ${summary.authorityDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Control: ${summary.latest.control?.dir ?? 'missing'}`,
  `- Oversight: ${summary.latest.oversight?.dir ?? 'missing'}`,
  `- Governance: ${summary.latest.governance?.dir ?? 'missing'}`,
  `- Assurance: ${summary.latest.assurance?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Packet Counts',
  '',
  `- Control files: ${summary.copied.control.length}`,
  `- Control packet trees: ${summary.copied.controlPacket.length} (intentionally omitted to avoid recursive packet bloat)`,
  `- Oversight files: ${summary.copied.oversight.length}`,
  `- Oversight packet trees: ${summary.copied.oversightPacket.length} (intentionally omitted to avoid recursive packet bloat)`,
  `- Governance files: ${summary.copied.governance.length}`,
  `- Assurance files: ${summary.copied.assurance.length}`,
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
  '- Attach `ops-authority.tgz` when production operators need one last authority packet that packages control, oversight, governance, release evidence, and operator docs together.',
  '- Use `ops-authority.json` as the machine-readable final authority verdict before final production close-out.',
  '- Re-run `pnpm ops:authority -- --label <name> --require-release-output` after any control, oversight, governance, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(authorityDir, 'ops-authority.md'), lines.join('\n') + '\n');
console.log(`Operations authority written to: ${authorityDir}`);
if (!ok) process.exit(1);
NODE

authority_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$authority_dir" ]; then
  echo "Failed to locate generated ops authority directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$authority_dir/ops-authority.tgz" -C "$authority_dir" packet
echo "Operations authority archive written to: $authority_dir/ops-authority.tgz"
pnpm ops:index -- --label "$LABEL"
