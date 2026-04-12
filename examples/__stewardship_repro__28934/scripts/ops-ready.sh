#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_READY_DIR:-ops/ready}"
KEEP="${OPS_READY_KEEP:-10}"
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
      echo "Unsupported ops ready argument: $1"
      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Ready keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

if [ "$SKIP_RETENTION" -eq 0 ]; then
  pnpm ops:retention -- --keep "$KEEP"
fi

pnpm ops:snapshot -- --label "$LABEL"
pnpm ops:evidence -- --label "$LABEL" --skip-snapshot
pnpm ops:report -- --label "$LABEL"
pnpm ops:bundle -- --label "$LABEL"
pnpm ops:index -- --label "$LABEL"

doctor_args=(-- --label "$LABEL")
handoff_args=(-- --label "$LABEL")
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  doctor_args+=(--require-release-output)
  handoff_args+=(--require-release-output)
fi

pnpm ops:doctor "${doctor_args[@]}"
pnpm ops:index -- --label "$LABEL"
pnpm ops:handoff "${handoff_args[@]}"

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

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const snapshot = readLatest(path.join(rootDir, 'ops', 'snapshots'), 'ops-snapshot.json');
const evidence = readLatest(path.join(rootDir, 'ops', 'evidence'), 'ops-evidence-summary.json');
const report = readLatest(path.join(rootDir, 'ops', 'reports'), 'ops-report.json');
const bundle = readLatest(path.join(rootDir, 'ops', 'bundles'), 'ops-bundle-summary.json');
const index = readLatest(path.join(rootDir, 'ops', 'index'), 'ops-index.json');
const doctor = readLatest(path.join(rootDir, 'ops', 'doctors'), 'ops-doctor.json');
const handoff = readLatest(path.join(rootDir, 'ops', 'handoffs'), 'ops-handoff.json');

const checks = [];
const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });

for (const [id, surface] of [
  ['snapshot-present', snapshot],
  ['evidence-present', evidence],
  ['report-present', report],
  ['bundle-present', bundle],
  ['index-present', index],
  ['doctor-present', doctor],
  ['handoff-present', handoff],
]) {
  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);
}

addCheck('doctor-verdict-pass', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? 'pass' : 'fail'}` : 'doctor missing');
addCheck('handoff-verdict-pass', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? 'pass' : 'fail'}` : 'handoff missing');
addCheck('handoff-archive-present', handoff ? fs.existsSync(path.join(handoff.absoluteDir, 'ops-handoff.tgz')) : false, handoff ? path.join(handoff.relativeDir, 'ops-handoff.tgz') : 'handoff missing');

const ok = checks.every((check) => check.ok);
const capturedAt = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const readyDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
fs.mkdirSync(readyDir, { recursive: true });

const summary = {
  capturedAt,
  label,
  ok,
  package: { name: pkg.name, version: pkg.version },
  readyDir: path.relative(rootDir, readyDir),
  requireReleaseOutput,
  retention: { skipped: skipRetention, keep: Number(keep) },
  latest: {
    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,
    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,
    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,
    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,
    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,
    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,
    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,
  },
  checks,
};

fs.writeFileSync(path.join(readyDir, 'ops-ready.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Ready',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Package: ${summary.package.name}@${summary.package.version}`,
  `- Verdict: ${summary.ok ? 'pass' : 'fail'}`,
  `- Ready Dir: ${summary.readyDir}`,
  `- Retention baseline skipped: ${summary.retention.skipped ? 'yes' : 'no'}`,
  `- Retention keep count: ${summary.retention.keep}`,
  `- Release output required: ${summary.requireReleaseOutput ? 'yes' : 'no'}`,
  '',
  '## Latest Surfaces',
  '',
  `- Snapshot: ${summary.latest.snapshot?.dir ?? 'missing'}`,
  `- Evidence: ${summary.latest.evidence?.dir ?? 'missing'}`,
  `- Report: ${summary.latest.report?.dir ?? 'missing'}`,
  `- Bundle: ${summary.latest.bundle?.dir ?? 'missing'}`,
  `- Index: ${summary.latest.index?.dir ?? 'missing'}`,
  `- Doctor: ${summary.latest.doctor?.dir ?? 'missing'}`,
  `- Handoff: ${summary.latest.handoff?.dir ?? 'missing'}`,
  '',
  '## Checks',
  '',
  ...summary.checks.map((check) => `- [${check.ok ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## Operator Next Steps',
  '',
  '- Review the latest doctor and handoff outputs for the final production verdict.',
  '- Attach the latest `ops-handoff.tgz` when escalating or handing off the release.',
  '- Use `ops-ready.json` as the single machine-readable summary for the production audit run.',
  '',
];

fs.writeFileSync(path.join(readyDir, 'ops-ready.md'), lines.join('\n') + '\n');
console.log(`Operations ready summary written to: ${readyDir}`);
if (!ok) process.exit(1);
NODE

attest_args=(-- --label "$LABEL")
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  attest_args+=(--require-release-output)
fi
pnpm ops:attest "${attest_args[@]}"
pnpm ops:index -- --label "$LABEL"
