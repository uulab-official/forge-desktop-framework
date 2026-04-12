#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_GOVERN_DIR:-ops/governance}"
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
      echo "Unsupported ops govern argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, --keep <count>, --require-release-output, and --skip-retention."
      exit 1
      ;;
  esac
  shift
done

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

assurance_args=(-- --label "$LABEL" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  assurance_args+=(--require-release-output)
fi
pnpm ops:assure "${assurance_args[@]}"

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);
const requireReleaseOutput = requireReleaseOutputFlag === '1';
const skipRetention = skipRetentionFlag === '1';
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const releaseDir = path.join(rootDir, 'release');

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

const addCheck = (id, ok, detail, checks) => checks.push({ id, ok: Boolean(ok), detail });
const manifestFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).filter((file) => /^latest([.-].+)?\.ya?ml$/i.test(file)).sort() : [];
const installerFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).filter((file) => !/^latest([.-].+)?\.ya?ml$/i.test(file)).sort() : [];

const index = loadLatestSurface(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const assurance = loadLatestSurface(path.join(rootDir, 'ops', 'assurances'), 'ops-assure.json');
const certification = loadLatestSurface(path.join(rootDir, 'ops', 'certifications'), 'ops-certify.json');
const compliance = loadLatestSurface(path.join(rootDir, 'ops', 'compliance'), 'ops-compliance.json');
const integrity = loadLatestSurface(path.join(rootDir, 'ops', 'integrity'), 'ops-integrity.json');

const checks = [];
addCheck('assurance-pass', assurance?.payload?.ok === true, assurance ? `assurance verdict=${assurance.payload?.ok ? 'pass' : 'fail'}` : 'assurance missing', checks);
addCheck('assurance-archive', assurance ? fs.existsSync(path.join(assurance.absoluteDir, 'ops-assure.tgz')) : false, assurance ? 'ops-assure.tgz present' : 'assurance missing', checks);
addCheck('assurance-packet-certification', assurance ? fs.existsSync(path.join(assurance.absoluteDir, 'packet', 'certification', 'ops-certify.json')) : false, assurance ? 'assurance packet contains certification record' : 'assurance missing', checks);
addCheck('certification-pass', certification?.payload?.ok === true, certification ? `certification verdict=${certification.payload?.ok ? 'pass' : 'fail'}` : 'certification missing', checks);
addCheck('compliance-pass', compliance?.payload?.ok === true, compliance ? `compliance verdict=${compliance.payload?.ok ? 'pass' : 'fail'}` : 'compliance missing', checks);
addCheck('integrity-pass', integrity?.payload?.ok === true, integrity ? `integrity verdict=${integrity.payload?.ok ? 'pass' : 'fail'}` : 'integrity missing', checks);
if (requireReleaseOutput) {
  addCheck('release-manifests', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(', ') : 'no release manifests', checks);
  addCheck('release-installers', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(', ') : 'no release installers', checks);
} else {
  addCheck('release-output-optional', true, manifestFiles.length + installerFiles.length > 0 ? `release files present: ${manifestFiles.length + installerFiles.length}` : 'release output not required', checks);
}

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const governanceDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const packetDir = path.join(governanceDir, 'packet');
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
  assurance: copySurface(assurance, 'assurance', ['ops-assure.json', 'ops-assure.md', 'ops-assure.tgz']),
  certification: copySurface(certification, 'certification', ['ops-certify.json', 'ops-certify.md', 'ops-certify.tgz']),
  compliance: copySurface(compliance, 'compliance', ['ops-compliance.json', 'ops-compliance.md', 'ops-compliance.tgz']),
  integrity: copySurface(integrity, 'integrity', ['ops-integrity.json', 'ops-integrity.md', 'ops-integrity.tgz']),
  index: copySurface(index, 'index', ['ops-index.json', 'ops-index.md']),
  assurancePacket: [],
  docs: [],
  env: [],
  manifests: [],
  installers: [],
};

const assurancePacketDir = assurance ? path.join(assurance.absoluteDir, 'packet') : null;
if (copyDirIfExists(assurancePacketDir, path.join(packetDir, 'assurance', 'packet'))) {
  copied.assurancePacket.push(path.join('packet', 'assurance', 'packet'));
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

const rerunCommand = `pnpm ops:govern -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim();
const ok = checks.every((check) => check.ok);
const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  governanceDir: path.relative(rootDir, governanceDir),
  archivePath: path.join(path.relative(rootDir, governanceDir), 'ops-govern.tgz'),
  packetDir: path.join(path.relative(rootDir, governanceDir), 'packet'),
  rerunCommand,
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  recommendedCommands: [
    rerunCommand,
    `pnpm ops:assure -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
    `pnpm ops:certify -- --label ${safeLabel}${requireReleaseOutput ? ' --require-release-output' : ''}${skipRetention ? ' --skip-retention' : ''} `.trim(),
  ],
  latest: {
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

fs.writeFileSync(path.join(governanceDir, 'ops-govern.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# Operations Governance',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Governance Dir: ${summary.governanceDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Packet Dir: ${summary.packetDir}`,
  `- Rerun Command: ${summary.rerunCommand}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  '',
  '## Latest Surfaces',
  '',
  `- Assurance: ${summary.latest.assurance?.dir ?? 'missing'}`,
  `- Certification: ${summary.latest.certification?.dir ?? 'missing'}`,
  `- Compliance: ${summary.latest.compliance?.dir ?? 'missing'}`,
  `- Integrity: ${summary.latest.integrity?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  '',
  '## Packet Counts',
  '',
  `- Assurance files: ${summary.copied.assurance.length}`,
  `- Assurance packet trees: ${summary.copied.assurancePacket.length}`,
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
  '- Attach `ops-govern.tgz` when production operators need one final governance packet that packages the assurance chain, release evidence, and operator docs together.',
  '- Use `ops-govern.json` as the machine-readable final governance verdict before audit sign-off, change-management review, or production promotion close-out.',
  '- Re-run `pnpm ops:govern -- --label <name> --require-release-output` after any assurance, certification, compliance, integrity, or packaged release change.',
  '',
];
fs.writeFileSync(path.join(governanceDir, 'ops-govern.md'), lines.join('\n') + '\n');
console.log(`Operations governance written to: ${governanceDir}`);
if (!ok) process.exit(1);
NODE

governance_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$governance_dir" ]; then
  echo "Failed to locate generated ops governance directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$governance_dir/ops-govern.tgz" -C "$governance_dir" packet
echo "Operations governance archive written to: $governance_dir/ops-govern.tgz"
pnpm ops:index -- --label "$LABEL"
