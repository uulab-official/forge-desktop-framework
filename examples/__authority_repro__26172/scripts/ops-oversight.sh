#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="${OPS_OVERSIGHT_LABEL:-oversight}"
OUTPUT_ROOT="${OPS_OVERSIGHT_DIR:-ops/oversight}"
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

governance_args=(-- --label "$LABEL" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  governance_args+=(--require-release-output)
fi
pnpm ops:govern "${governance_args[@]}"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$LABEL" "$OUTPUT_ROOT" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, label, outputRoot, requireReleaseOutputRaw, skipRetentionRaw, keepRaw] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputRaw === '1';
const skipRetention = skipRetentionRaw === '1';
const keep = Number.parseInt(keepRaw, 10);
const releaseDir = path.join(rootDir, 'release');
const governanceRoot = path.join(rootDir, 'ops', 'governance');
const assuranceRoot = path.join(rootDir, 'ops', 'assurances');
const certificationRoot = path.join(rootDir, 'ops', 'certifications');
const complianceRoot = path.join(rootDir, 'ops', 'compliance');
const integrityRoot = path.join(rootDir, 'ops', 'integrity');
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
const governance = latestSurface(governanceRoot, 'ops-govern.json');
const assurance = latestSurface(assuranceRoot, 'ops-assure.json');
const certification = latestSurface(certificationRoot, 'ops-certify.json');
const compliance = latestSurface(complianceRoot, 'ops-compliance.json');
const integrity = latestSurface(integrityRoot, 'ops-integrity.json');
const index = latestSurface(indexRoot, 'ops-index.json');
const checks = [];
addCheck('governance-present', Boolean(governance), governance ? governance.relativeDir : 'missing latest governance packet', checks);
addCheck('assurance-present', Boolean(assurance), assurance ? assurance.relativeDir : 'missing latest assurance packet', checks);
addCheck('certification-present', Boolean(certification), certification ? certification.relativeDir : 'missing latest certification packet', checks);
addCheck('compliance-present', Boolean(compliance), compliance ? compliance.relativeDir : 'missing latest compliance packet', checks);
addCheck('integrity-present', Boolean(integrity), integrity ? integrity.relativeDir : 'missing latest integrity packet', checks);
addCheck('index-present', Boolean(index), index ? index.relativeDir : 'missing latest ops index', checks);
if (governance) {
  addCheck('governance-pass', governance.payload?.ok === true, governance.payload?.ok === true ? 'governance verdict passed' : 'governance verdict failed', checks);
  addCheck('governance-captures-assurance', Boolean(governance.payload?.copied?.assurance?.length), governance.payload?.copied?.assurance?.length ? `assurance files: ${governance.payload.copied.assurance.length}` : 'governance packet did not capture assurance files', checks);
  addCheck('governance-captures-release-installers', Boolean(governance.payload?.copied?.installers?.length), governance.payload?.copied?.installers?.length ? `installers: ${governance.payload.copied.installers.length}` : 'governance packet did not capture installers', checks);
  addCheck('governance-captures-docs', Boolean(governance.payload?.copied?.docs?.length), governance.payload?.copied?.docs?.length ? `docs: ${governance.payload.copied.docs.join(', ')}` : 'governance packet did not capture production docs', checks);
  addCheck('governance-captures-manifests', Boolean(governance.payload?.copied?.manifests?.length), governance.payload?.copied?.manifests?.length ? `manifests: ${governance.payload.copied.manifests.length}` : 'governance packet did not capture updater manifests', checks);
  addCheck('governance-archive-present', fs.existsSync(path.join(governance.absoluteDir, 'ops-govern.tgz')), fs.existsSync(path.join(governance.absoluteDir, 'ops-govern.tgz')) ? 'ops-govern.tgz present' : 'ops-govern.tgz missing', checks);
  addCheck('governance-packet-tree-present', fs.existsSync(path.join(governance.absoluteDir, 'packet')), fs.existsSync(path.join(governance.absoluteDir, 'packet')) ? 'packet directory present' : 'packet directory missing', checks);
  addCheck('governance-recency-vs-assurance', !assurance || Date.parse(governance.modifiedAt) >= Date.parse(assurance.modifiedAt), !assurance ? 'assurance packet missing' : Date.parse(governance.modifiedAt) >= Date.parse(assurance.modifiedAt) ? 'governance is newer than assurance' : 'governance is older than assurance', checks);
  addCheck('index-latest-governance-aligned', index?.payload?.latest?.governance?.relativeDir === governance.relativeDir, index?.payload?.latest?.governance?.relativeDir ? `index governance=${index.payload.latest.governance.relativeDir}` : 'index missing governance reference', checks);
  addCheck('index-recency-vs-governance', !index || Date.parse(index.modifiedAt) >= Date.parse(governance.modifiedAt), !index ? 'index missing' : Date.parse(index.modifiedAt) >= Date.parse(governance.modifiedAt) ? 'index is newer than governance' : 'index is older than governance', checks);
  addCheck('governance-package-version-match', governance.payload?.package?.version === pkg.version, governance.payload?.package?.version === pkg.version ? `version ${pkg.version}` : `governance version mismatch: ${governance.payload?.package?.version ?? 'unknown'} !== ${pkg.version}`, checks);
  addCheck('governance-rerun-command', governance.payload?.rerunCommand?.startsWith('pnpm ops:govern -- --label '), governance.payload?.rerunCommand ? governance.payload.rerunCommand : 'missing governance rerun command', checks);
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
const oversightDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(oversightDir, 'packet');
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
  governance: copySurface(governance, 'governance', ['ops-govern.json', 'ops-govern.md', 'ops-govern.tgz']),
  assurance: copySurface(assurance, 'assurance', ['ops-assure.json', 'ops-assure.md', 'ops-assure.tgz']),
  certification: copySurface(certification, 'certification', ['ops-certify.json', 'ops-certify.md', 'ops-certify.tgz']),
  compliance: copySurface(compliance, 'compliance', ['ops-compliance.json', 'ops-compliance.md', 'ops-compliance.tgz']),
  integrity: copySurface(integrity, 'integrity', ['ops-integrity.json', 'ops-integrity.md', 'ops-integrity.tgz']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  governancePacket: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

const governancePacketDir = governance ? path.join(governance.absoluteDir, 'packet') : null;
if (copyDirIfExists(governancePacketDir, path.join(packetDir, 'governance', 'packet'))) {
  copied.governancePacket.push(path.join('packet', 'governance', 'packet'));
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

const rerunCommand = `pnpm ops:oversight -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim();
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  oversightDir: path.relative(rootDir, oversightDir),
  archivePath: path.join(path.relative(rootDir, oversightDir), 'ops-oversight.tgz'),
  packetDir: path.join(path.relative(rootDir, oversightDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  recommendedCommands: [
    rerunCommand,
    `pnpm ops:govern -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
    `pnpm ops:assure -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
  ],
  latest: {
    governance: governance ? { dir: governance.relativeDir, modifiedAt: governance.modifiedAt, ok: governance.payload?.ok === true } : null,
    assurance: assurance ? { dir: assurance.relativeDir, modifiedAt: assurance.modifiedAt, ok: assurance.payload?.ok === true } : null,
    certification: certification ? { dir: certification.relativeDir, modifiedAt: certification.modifiedAt, ok: certification.payload?.ok === true } : null,
    compliance: compliance ? { dir: compliance.relativeDir, modifiedAt: compliance.modifiedAt, ok: compliance.payload?.ok === true } : null,
    integrity: integrity ? { dir: integrity.relativeDir, modifiedAt: integrity.modifiedAt, ok: integrity.payload?.ok === true } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
  },
  copied,
  release: { manifests: manifestFiles, installers: installerFiles },
  checks,
};

fs.writeFileSync(path.join(oversightDir, 'ops-oversight.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Oversight',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Oversight Dir: ${summary.oversightDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Governance: ${summary.latest.governance?.dir ?? 'missing'}`,
  `- Assurance: ${summary.latest.assurance?.dir ?? 'missing'}`,
  `- Certification: ${summary.latest.certification?.dir ?? 'missing'}`,
  `- Compliance: ${summary.latest.compliance?.dir ?? 'missing'}`,
  `- Integrity: ${summary.latest.integrity?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Packet Counts',
  '',
  `- Governance files: ${summary.copied.governance.length}`,
  `- Governance packet trees: ${summary.copied.governancePacket.length}`,
  `- Assurance files: ${summary.copied.assurance.length}`,
  `- Certification files: ${summary.copied.certification.length}`,
  `- Compliance files: ${summary.copied.compliance.length}`,
  `- Integrity files: ${summary.copied.integrity.length}`,
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
  '- Attach `ops-oversight.tgz` when production operators need one final oversight packet that packages governance, assurance, release evidence, and operator docs together.',
  '- Use `ops-oversight.json` as the machine-readable final oversight verdict before audit sign-off, change-management review, or production promotion close-out.',
  '- Re-run `pnpm ops:oversight -- --label <name> --require-release-output` after any governance, assurance, certification, compliance, integrity, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(oversightDir, 'ops-oversight.md'), lines.join('\n') + '\n');
console.log(`Operations oversight written to: ${oversightDir}`);
if (!ok) process.exit(1);
NODE

oversight_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$oversight_dir" ]; then
  echo "Failed to locate generated ops oversight directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$oversight_dir/ops-oversight.tgz" -C "$oversight_dir" packet
echo "Operations oversight archive written to: $oversight_dir/ops-oversight.tgz"
pnpm ops:index -- --label "$LABEL"
