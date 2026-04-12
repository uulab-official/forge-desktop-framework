#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_REPORT_DIR:-ops/reports}"

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
      echo "Unsupported ops report argument: $1"
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
const packageJsonPath = path.join(rootDir, 'package.json');
const releaseDir = path.join(rootDir, 'release');

const readLatest = (root, fileName) => {
  if (!fs.existsSync(root)) return null;
  const candidates = fs.readdirSync(root)
    .map((entry) => path.join(root, entry))
    .filter((entry) => fs.existsSync(path.join(entry, fileName)))
    .map((entry) => ({ entry, stat: fs.statSync(entry) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  if (candidates.length === 0) return null;
  const latestDir = candidates[0].entry;
  const jsonPath = path.join(latestDir, fileName);
  return {
    dir: path.relative(rootDir, latestDir),
    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),
    payload: JSON.parse(fs.readFileSync(jsonPath, 'utf8')),
  };
};

const snapshot = readLatest(path.join(rootDir, 'ops', 'snapshots'), 'ops-snapshot.json');
const evidence = readLatest(path.join(rootDir, 'ops', 'evidence'), 'ops-evidence-summary.json');
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) : null;
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));
const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
fs.mkdirSync(reportDir, { recursive: true });

const report = {
  capturedAt,
  label,
  package: pkg ? { name: pkg.name, version: pkg.version } : null,
  reportDir: path.relative(rootDir, reportDir),
  latest: {
    snapshot: snapshot ? { dir: snapshot.dir, modifiedAt: snapshot.modifiedAt, capturedAt: snapshot.payload.capturedAt ?? null } : null,
    evidence: evidence ? { dir: evidence.dir, modifiedAt: evidence.modifiedAt, capturedAt: evidence.payload.capturedAt ?? null } : null,
    index: index ? { dir: index.dir, modifiedAt: index.modifiedAt, capturedAt: index.payload.capturedAt ?? null } : null,
  },
  release: {
    manifestCount: manifestFiles.length,
    installerCount: installerFiles.length,
    manifests: manifestFiles,
    installers: installerFiles,
  },
  snapshotCounts: index?.payload?.counts ?? {
    snapshots: snapshot ? 1 : 0,
    evidence: evidence ? 1 : 0,
  },
  ci: snapshot?.payload?.ci ?? evidence?.payload?.ci ?? null,
};

fs.writeFileSync(path.join(reportDir, 'ops-report.json'), JSON.stringify(report, null, 2) + '\n');

const lines = [
  '# Operations Report',
  '',
  `- Captured At (UTC): ${report.capturedAt}`,
  `- Label: ${report.label}`,
  `- Report Dir: ${report.reportDir}`,
  `- Package: ${report.package ? `${report.package.name}@${report.package.version}` : 'n/a'}`,
  '',
  '## Latest Operations Surfaces',
  '',
  report.latest.snapshot ? `- Snapshot: ${report.latest.snapshot.dir} (${report.latest.snapshot.modifiedAt})` : '- Snapshot: none',
  report.latest.evidence ? `- Evidence: ${report.latest.evidence.dir} (${report.latest.evidence.modifiedAt})` : '- Evidence: none',
  report.latest.index ? `- Index: ${report.latest.index.dir} (${report.latest.index.modifiedAt})` : '- Index: none',
  '',
  '## Release Output',
  '',
  `- Manifest count: ${report.release.manifestCount}`,
  `- Installer count: ${report.release.installerCount}`,
  report.release.manifests.length > 0 ? `- Manifests: ${report.release.manifests.join(', ')}` : '- Manifests: none',
  report.release.installers.length > 0 ? `- Installers: ${report.release.installers.join(', ')}` : '- Installers: none',
  '',
  '## Inventory Counts',
  '',
  `- Snapshot directories retained: ${report.snapshotCounts.snapshots ?? 0}`,
  `- Evidence directories retained: ${report.snapshotCounts.evidence ?? 0}`,
  '',
  '## CI Context',
  '',
  `- Provider: ${report.ci?.provider ?? 'n/a'}`,
  `- Workflow: ${report.ci?.workflow ?? 'n/a'}`,
  `- Run ID: ${report.ci?.runId ?? 'n/a'}`,
  `- Ref Name: ${report.ci?.refName ?? 'n/a'}`,
  `- SHA: ${report.ci?.sha ?? 'n/a'}`,
  `- Runner OS: ${report.ci?.runnerOs ?? 'n/a'}`,
  '',
];

fs.writeFileSync(path.join(reportDir, 'ops-report.md'), lines.join('\n') + '\n');
console.log(`Operations report written to: ${reportDir}`);
NODE
