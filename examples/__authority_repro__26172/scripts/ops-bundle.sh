#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_BUNDLE_DIR:-ops/bundles}"

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
    --)
      ;;
    *)
      echo "Unsupported ops bundle argument: $1"
      echo "Use --label <name> and optional --output-dir <dir>."
      exit 1
      ;;
  esac
  shift
done

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, outputRoot, label] = process.argv.slice(2);

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
    jsonPath: path.join(latestDir, fileName),
  };
};

const copyIfExists = (source, destination) => {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
};

const packageJsonPath = path.join(rootDir, 'package.json');
const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) : null;
const snapshot = readLatest(path.join(rootDir, 'ops', 'snapshots'), 'ops-snapshot.json');
const evidence = readLatest(path.join(rootDir, 'ops', 'evidence'), 'ops-evidence-summary.json');
const report = readLatest(path.join(rootDir, 'ops', 'reports'), 'ops-report.json');
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');

for (const [labelName, value] of [
  ['snapshot', snapshot],
  ['evidence', evidence],
  ['report', report],
]) {
  if (!value) {
    console.error(`Latest ops ${labelName} surface is missing.`);
    process.exit(1);
  }
}

const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));

const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const bundleDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const payloadDir = path.join(bundleDir, 'payload');
const docsDir = path.join(payloadDir, 'docs');
const envDir = path.join(payloadDir, 'env');
const releaseOutDir = path.join(payloadDir, 'release');
fs.mkdirSync(payloadDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(envDir, { recursive: true });
fs.mkdirSync(releaseOutDir, { recursive: true });

const copied = {
  snapshot: [],
  evidence: [],
  report: [],
  index: [],
  docs: [],
  env: [],
  manifests: [],
};

const copySurface = (surface, key, names) => {
  for (const name of names) {
    const source = path.join(surface.absoluteDir, name);
    const destination = path.join(payloadDir, key, name);
    if (copyIfExists(source, destination)) {
      copied[key].push(path.join(key, name));
    }
  }
};

copySurface(snapshot, 'snapshot', ['ops-snapshot.json', 'ops-snapshot.md']);
copySurface(evidence, 'evidence', ['ops-evidence-summary.json', 'ops-evidence-summary.md']);
copySurface(report, 'report', ['ops-report.json', 'ops-report.md']);
if (index) {
  copySurface(index, 'index', ['ops-index.json', 'ops-index.md']);
}

for (const relativeDoc of [
  path.join('docs', 'release-playbook.md'),
  path.join('docs', 'production-readiness.md'),
]) {
  const source = path.join(rootDir, relativeDoc);
  const destination = path.join(docsDir, path.basename(relativeDoc));
  if (copyIfExists(source, destination)) {
    copied.docs.push(relativeDoc);
  }
}

const envExample = path.join(rootDir, '.env.example');
if (copyIfExists(envExample, path.join(envDir, '.env.example'))) {
  copied.env.push('.env.example');
}

for (const manifestFile of manifestFiles) {
  const source = path.join(releaseDir, manifestFile);
  const destination = path.join(releaseOutDir, manifestFile);
  if (copyIfExists(source, destination)) {
    copied.manifests.push(path.join('release', manifestFile));
  }
}

const installerInventory = installerFiles.map((file) => ({
  file,
  sizeBytes: fs.statSync(path.join(releaseDir, file)).size,
}));

const summary = {
  capturedAt,
  label,
  package: pkg ? { name: pkg.name, version: pkg.version } : null,
  bundleDir: path.relative(rootDir, bundleDir),
  archivePath: path.join(path.relative(rootDir, bundleDir), 'ops-bundle.tgz'),
  latest: {
    snapshot: { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt },
    evidence: { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt },
    report: { dir: report.relativeDir, modifiedAt: report.modifiedAt },
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
  },
  copied,
  release: {
    manifestCount: manifestFiles.length,
    installerCount: installerInventory.length,
    installerInventory,
  },
};

fs.writeFileSync(path.join(bundleDir, 'ops-bundle-summary.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Bundle',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Bundle Dir: ${summary.bundleDir}`,
  `- Archive Path: ${summary.archivePath}`,
  `- Package: ${summary.package ? `${summary.package.name}@${summary.package.version}` : 'n/a'}`,
  '',
  '## Included Surfaces',
  '',
  `- Snapshot dir: ${summary.latest.snapshot.dir}`,
  `- Evidence dir: ${summary.latest.evidence.dir}`,
  `- Report dir: ${summary.latest.report.dir}`,
  `- Index dir: ${summary.latest.index ? summary.latest.index.dir : 'none'}`,
  `- Docs copied: ${summary.copied.docs.length > 0 ? summary.copied.docs.join(', ') : 'none'}`,
  `- Env files copied: ${summary.copied.env.length > 0 ? summary.copied.env.join(', ') : 'none'}`,
  `- Release manifests copied: ${summary.copied.manifests.length > 0 ? summary.copied.manifests.join(', ') : 'none'}`,
  `- Installers inventoried: ${summary.release.installerCount}`,
  '',
];

fs.writeFileSync(path.join(bundleDir, 'ops-bundle-summary.md'), lines.join('\n') + '\n');
console.log(`Operations bundle prepared at: ${bundleDir}`);
NODE

bundle_dir="$(node -e "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; const dirs=fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>path.join(root, entry.name)).sort():[]; if (dirs.length) process.stdout.write(dirs[dirs.length - 1]);" "$OUTPUT_ROOT")"
if [ -z "$bundle_dir" ]; then
  echo "Failed to locate generated ops bundle directory in $OUTPUT_ROOT"
  exit 1
fi
tar -czf "$bundle_dir/ops-bundle.tgz" -C "$bundle_dir" payload
echo "Operations bundle archive written to: $bundle_dir/ops-bundle.tgz"
