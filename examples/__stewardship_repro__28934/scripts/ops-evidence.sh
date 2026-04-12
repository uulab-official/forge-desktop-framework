#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_EVIDENCE_DIR:-ops/evidence}"
SNAPSHOT_ROOT="${OPS_SNAPSHOT_DIR:-ops/snapshots}"
SKIP_SNAPSHOT=0

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
    --snapshot-root)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --snapshot-root"
        exit 1
      fi
      SNAPSHOT_ROOT="$1"
      ;;
    --skip-snapshot)
      SKIP_SNAPSHOT=1
      ;;
    --)
      ;;
    *)
      echo "Unsupported ops evidence argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --snapshot-root <dir>, and optional --skip-snapshot."
      exit 1
      ;;
  esac
  shift
done

if [ "$SKIP_SNAPSHOT" -eq 0 ]; then
  pnpm ops:snapshot -- --label "$LABEL" --output-dir "$SNAPSHOT_ROOT"
fi

mkdir -p "$OUTPUT_ROOT"

node - "$ROOT_DIR" "$SNAPSHOT_ROOT" "$OUTPUT_ROOT" "$LABEL" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, snapshotRoot, outputRoot, label] = process.argv.slice(2);

if (!fs.existsSync(snapshotRoot)) {
  console.error(`Snapshot root does not exist: ${snapshotRoot}`);
  process.exit(1);
}

const snapshotDirs = fs.readdirSync(snapshotRoot)
  .map((entry) => path.join(snapshotRoot, entry))
  .filter((entry) => fs.existsSync(path.join(entry, 'ops-snapshot.json')))
  .map((entry) => ({
    dir: entry,
    stat: fs.statSync(entry),
  }))
  .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

if (snapshotDirs.length === 0) {
  console.error(`No ops snapshots found under ${snapshotRoot}`);
  process.exit(1);
}

const latestSnapshotDir = snapshotDirs[0].dir;
const snapshotJsonPath = path.join(latestSnapshotDir, 'ops-snapshot.json');
const snapshotMarkdownPath = path.join(latestSnapshotDir, 'ops-snapshot.md');
const snapshot = JSON.parse(fs.readFileSync(snapshotJsonPath, 'utf8'));

const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = snapshot.capturedAt ?? new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const evidenceDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
const snapshotOutDir = path.join(evidenceDir, 'snapshot');
const docsOutDir = path.join(evidenceDir, 'docs');
const releaseOutDir = path.join(evidenceDir, 'release-manifests');
const envOutDir = path.join(evidenceDir, 'env');

fs.mkdirSync(snapshotOutDir, { recursive: true });
fs.mkdirSync(docsOutDir, { recursive: true });
fs.mkdirSync(releaseOutDir, { recursive: true });
fs.mkdirSync(envOutDir, { recursive: true });

fs.copyFileSync(snapshotJsonPath, path.join(snapshotOutDir, 'ops-snapshot.json'));
if (fs.existsSync(snapshotMarkdownPath)) {
  fs.copyFileSync(snapshotMarkdownPath, path.join(snapshotOutDir, 'ops-snapshot.md'));
}

const copiedDocs = [];
for (const relativeDoc of [
  path.join('docs', 'release-playbook.md'),
  path.join('docs', 'production-readiness.md'),
]) {
  const source = path.join(rootDir, relativeDoc);
  if (!fs.existsSync(source)) continue;
  const destination = path.join(docsOutDir, path.basename(relativeDoc));
  fs.copyFileSync(source, destination);
  copiedDocs.push(relativeDoc);
}

const envExample = path.join(rootDir, '.env.example');
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, path.join(envOutDir, '.env.example'));
}

const releaseDir = path.join(rootDir, 'release');
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
for (const manifestFile of manifestFiles) {
  fs.copyFileSync(path.join(releaseDir, manifestFile), path.join(releaseOutDir, manifestFile));
}

const installerInventory = releaseFiles
  .filter((file) => !manifestFiles.includes(file))
  .map((file) => ({
    file,
    sizeBytes: fs.statSync(path.join(releaseDir, file)).size,
  }));

const summary = {
  label,
  capturedAt: snapshot.capturedAt ?? null,
  package: snapshot.package ?? null,
  ci: snapshot.ci ?? null,
  sourceSnapshotDir: path.relative(rootDir, latestSnapshotDir),
  evidenceDir: path.relative(rootDir, evidenceDir),
  included: {
    snapshot: ['snapshot/ops-snapshot.json', ...(fs.existsSync(snapshotMarkdownPath) ? ['snapshot/ops-snapshot.md'] : [])],
    docs: copiedDocs,
    envExample: fs.existsSync(envExample),
    manifests: manifestFiles,
    installerInventory,
  },
};

fs.writeFileSync(path.join(evidenceDir, 'ops-evidence-summary.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Evidence Bundle',
  '',
  `- Label: ${summary.label}`,
  `- Captured At (UTC): ${summary.capturedAt ?? 'n/a'}`,
  `- Evidence Dir: ${summary.evidenceDir}`,
  `- Source Snapshot Dir: ${summary.sourceSnapshotDir}`,
  `- Package: ${summary.package ? `${summary.package.name}@${summary.package.version}` : 'n/a'}`,
  '',
  '## Included Evidence',
  '',
  `- Snapshot JSON: ${summary.included.snapshot.includes('snapshot/ops-snapshot.json') ? 'yes' : 'no'}`,
  `- Snapshot Markdown: ${summary.included.snapshot.includes('snapshot/ops-snapshot.md') ? 'yes' : 'no'}`,
  `- Docs Copied: ${summary.included.docs.length > 0 ? summary.included.docs.join(', ') : 'none'}`,
  `- .env.example copied: ${summary.included.envExample ? 'yes' : 'no'}`,
  `- Release manifests: ${summary.included.manifests.length > 0 ? summary.included.manifests.join(', ') : 'none'}`,
  `- Installers inventoried: ${summary.included.installerInventory.length}` ,
  '',
  '## CI Context',
  '',
  `- Provider: ${summary.ci?.provider ?? 'n/a'}`,
  `- Workflow: ${summary.ci?.workflow ?? 'n/a'}`,
  `- Run ID: ${summary.ci?.runId ?? 'n/a'}`,
  `- Ref Name: ${summary.ci?.refName ?? 'n/a'}`,
  `- SHA: ${summary.ci?.sha ?? 'n/a'}`,
  `- Runner OS: ${summary.ci?.runnerOs ?? 'n/a'}`,
  '',
];

fs.writeFileSync(path.join(evidenceDir, 'ops-evidence-summary.md'), lines.join('\n') + '\n');
console.log(`Operations evidence bundle written to: ${evidenceDir}`);
NODE
