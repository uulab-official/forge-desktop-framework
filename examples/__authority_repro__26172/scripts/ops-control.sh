#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="${OPS_CONTROL_LABEL:-control}"
OUTPUT_ROOT="${OPS_CONTROL_DIR:-ops/control}"
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

oversight_args=(-- --label "$LABEL" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  oversight_args+=(--require-release-output)
fi
pnpm ops:oversight "${oversight_args[@]}"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$LABEL" "$OUTPUT_ROOT" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, label, outputRoot, requireReleaseOutputRaw, skipRetentionRaw, keepRaw] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputRaw === '1';
const skipRetention = skipRetentionRaw === '1';
const keep = Number.parseInt(keepRaw, 10);
const releaseDir = path.join(rootDir, 'release');
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
const oversight = latestSurface(oversightRoot, 'ops-oversight.json');
const governance = latestSurface(governanceRoot, 'ops-govern.json');
const assurance = latestSurface(assuranceRoot, 'ops-assure.json');
const index = latestSurface(indexRoot, 'ops-index.json');
const checks = [];
addCheck('oversight-present', Boolean(oversight), oversight ? oversight.relativeDir : 'missing latest oversight packet', checks);
addCheck('governance-present', Boolean(governance), governance ? governance.relativeDir : 'missing latest governance packet', checks);
addCheck('assurance-present', Boolean(assurance), assurance ? assurance.relativeDir : 'missing latest assurance packet', checks);
addCheck('index-present', Boolean(index), index ? index.relativeDir : 'missing latest ops index', checks);
if (oversight) {
  addCheck('oversight-pass', oversight.payload?.ok === true, oversight.payload?.ok === true ? 'oversight verdict passed' : 'oversight verdict failed', checks);
  addCheck('oversight-archive-present', fs.existsSync(path.join(oversight.absoluteDir, 'ops-oversight.tgz')), fs.existsSync(path.join(oversight.absoluteDir, 'ops-oversight.tgz')) ? 'ops-oversight.tgz present' : 'ops-oversight.tgz missing', checks);
  addCheck('oversight-packet-tree-present', fs.existsSync(path.join(oversight.absoluteDir, 'packet')), fs.existsSync(path.join(oversight.absoluteDir, 'packet')) ? 'packet directory present' : 'packet directory missing', checks);
  addCheck('oversight-captures-governance', Boolean(oversight.payload?.copied?.governance?.length), oversight.payload?.copied?.governance?.length ? `governance files: ${oversight.payload.copied.governance.length}` : 'oversight packet did not capture governance files', checks);
  addCheck('oversight-captures-installers', Boolean(oversight.payload?.copied?.installers?.length), oversight.payload?.copied?.installers?.length ? `installers: ${oversight.payload.copied.installers.length}` : 'oversight packet did not capture installers', checks);
  addCheck('oversight-package-version-match', oversight.payload?.package?.version === pkg.version, oversight.payload?.package?.version === pkg.version ? `version ${pkg.version}` : `oversight version mismatch: ${oversight.payload?.package?.version ?? 'unknown'} !== ${pkg.version}`, checks);
  addCheck('oversight-rerun-command', oversight.payload?.rerunCommand?.startsWith('pnpm ops:oversight -- --label '), oversight.payload?.rerunCommand ? oversight.payload.rerunCommand : 'missing oversight rerun command', checks);
  addCheck('oversight-recency-vs-governance', !governance || Date.parse(oversight.modifiedAt) >= Date.parse(governance.modifiedAt), !governance ? 'governance missing' : Date.parse(oversight.modifiedAt) >= Date.parse(governance.modifiedAt) ? 'oversight is newer than governance' : 'oversight is older than governance', checks);
  addCheck('index-latest-oversight-aligned', index?.payload?.latest?.oversight?.relativeDir === oversight.relativeDir, index?.payload?.latest?.oversight?.relativeDir ? `index oversight=${index.payload.latest.oversight.relativeDir}` : 'index missing oversight reference', checks);
  addCheck('index-recency-vs-oversight', !index || Date.parse(index.modifiedAt) >= Date.parse(oversight.modifiedAt), !index ? 'index missing' : Date.parse(index.modifiedAt) >= Date.parse(oversight.modifiedAt) ? 'index is newer than oversight' : 'index is older than oversight', checks);
};

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
const controlDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(controlDir, 'packet');
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
  oversight: copySurface(oversight, 'oversight', ['ops-oversight.json', 'ops-oversight.md']),
  governance: copySurface(governance, 'governance', ['ops-govern.json', 'ops-govern.md']),
  assurance: copySurface(assurance, 'assurance', ['ops-assure.json', 'ops-assure.md']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  oversightPacket: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

const oversightPacketDir = oversight ? path.join(oversight.absoluteDir, 'packet') : null;
if (copyDirWithoutArchives(oversightPacketDir, path.join(packetDir, 'oversight', 'packet'))) {
  copied.oversightPacket.push(path.join('packet', 'oversight', 'packet'));
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

const rerunCommand = `pnpm ops:control -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim();
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  controlDir: path.relative(rootDir, controlDir),
  archivePath: path.join(path.relative(rootDir, controlDir), 'ops-control.tgz'),
  packetDir: path.join(path.relative(rootDir, controlDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  recommendedCommands: [
    rerunCommand,
    `pnpm ops:oversight -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
    `pnpm ops:govern -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
  ],
  latest: {
    oversight: oversight ? { dir: oversight.relativeDir, modifiedAt: oversight.modifiedAt, ok: oversight.payload?.ok === true } : null,
    governance: governance ? { dir: governance.relativeDir, modifiedAt: governance.modifiedAt, ok: governance.payload?.ok === true } : null,
    assurance: assurance ? { dir: assurance.relativeDir, modifiedAt: assurance.modifiedAt, ok: assurance.payload?.ok === true } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(controlDir, 'ops-control.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Control',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Control Dir: ${summary.controlDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Oversight: ${summary.latest.oversight?.dir ?? 'missing'}`,
  `- Governance: ${summary.latest.governance?.dir ?? 'missing'}`,
  `- Assurance: ${summary.latest.assurance?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Packet Counts',
  '',
  `- Oversight files: ${summary.copied.oversight.length}`,
  `- Oversight packet trees: ${summary.copied.oversightPacket.length}`,
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
  '- Attach `ops-control.tgz` when production operators need one final control packet that packages oversight, governance, release evidence, and operator docs together.',
  '- Use `ops-control.json` as the machine-readable final control verdict before the last production sign-off or change-management close-out.',
  '- Re-run `pnpm ops:control -- --label <name> --require-release-output` after any oversight, governance, assurance, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(controlDir, 'ops-control.md'), lines.join('\n') + '\n');
console.log(`Operations control written to: ${controlDir}`);
if (!ok) process.exit(1);
NODE

control_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$control_dir" ]; then
  echo "Failed to locate generated ops control directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$control_dir/ops-control.tgz" -C "$control_dir" packet
echo "Operations control archive written to: $control_dir/ops-control.tgz"
pnpm ops:index -- --label "$LABEL"
