#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_INDEX_DIR:-ops/index}"

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
      echo "Unsupported ops index argument: $1"
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
const snapshotsRoot = path.join(rootDir, 'ops', 'snapshots');
const evidenceRoot = path.join(rootDir, 'ops', 'evidence');
const reportsRoot = path.join(rootDir, 'ops', 'reports');
const bundlesRoot = path.join(rootDir, 'ops', 'bundles');
const doctorsRoot = path.join(rootDir, 'ops', 'doctors');
const handoffsRoot = path.join(rootDir, 'ops', 'handoffs');
const attestationsRoot = path.join(rootDir, 'ops', 'attestations');
const readyRoot = path.join(rootDir, 'ops', 'ready');
const gatesRoot = path.join(rootDir, 'ops', 'gates');
const releasePacksRoot = path.join(rootDir, 'ops', 'releasepacks');
const exportsRoot = path.join(rootDir, 'ops', 'exports');
const restoresRoot = path.join(rootDir, 'ops', 'restores');
const recoveriesRoot = path.join(rootDir, 'ops', 'recoveries');
const rollbacksRoot = path.join(rootDir, 'ops', 'rollbacks');
const incidentsRoot = path.join(rootDir, 'ops', 'incidents');
const escalationsRoot = path.join(rootDir, 'ops', 'escalations');
const continuityRoot = path.join(rootDir, 'ops', 'continuity');
const resilienceRoot = path.join(rootDir, 'ops', 'resilience');
const runbooksRoot = path.join(rootDir, 'ops', 'runbooks');
const integrityRoot = path.join(rootDir, 'ops', 'integrity');
const complianceRoot = path.join(rootDir, 'ops', 'compliance');
const certificationRoot = path.join(rootDir, 'ops', 'certifications');
const assuranceRoot = path.join(rootDir, 'ops', 'assurances');
const governanceRoot = path.join(rootDir, 'ops', 'governance');
const oversightRoot = path.join(rootDir, 'ops', 'oversight');
const controlRoot = path.join(rootDir, 'ops', 'control');
const authorityRoot = path.join(rootDir, 'ops', 'authority');
const stewardshipRoot = path.join(rootDir, 'ops', 'stewardship');
const packageJsonPath = path.join(rootDir, 'package.json');

const listDirs = (root, expectedFile) => {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .map((entry) => path.join(root, entry))
    .filter((entry) => fs.existsSync(path.join(entry, expectedFile)))
    .map((entry) => ({
      name: path.basename(entry),
      relativeDir: path.relative(rootDir, entry),
      stat: fs.statSync(entry),
    }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    .map(({ stat, ...entry }) => ({
      ...entry,
      modifiedAt: new Date(stat.mtimeMs).toISOString(),
    }));
};

const snapshots = listDirs(snapshotsRoot, 'ops-snapshot.json');
const evidence = listDirs(evidenceRoot, 'ops-evidence-summary.json');
const reports = listDirs(reportsRoot, 'ops-report.json');
const bundles = listDirs(bundlesRoot, 'ops-bundle-summary.json');
const doctors = listDirs(doctorsRoot, 'ops-doctor.json');
const handoffs = listDirs(handoffsRoot, 'ops-handoff.json');
const attestations = listDirs(attestationsRoot, 'ops-attestation.json');
const readys = listDirs(readyRoot, 'ops-ready.json');
const gates = listDirs(gatesRoot, 'ops-gate.json');
const releasePacks = listDirs(releasePacksRoot, 'ops-releasepack.json');
const exports = listDirs(exportsRoot, 'ops-export.json');
const restores = listDirs(restoresRoot, 'ops-restore.json');
const recoveries = listDirs(recoveriesRoot, 'ops-recover.json');
const rollbacks = listDirs(rollbacksRoot, 'ops-rollback.json');
const incidents = listDirs(incidentsRoot, 'ops-incident.json');
const escalations = listDirs(escalationsRoot, 'ops-escalate.json');
const continuity = listDirs(continuityRoot, 'ops-continuity.json');
const resilience = listDirs(resilienceRoot, 'ops-resilience.json');
const runbooks = listDirs(runbooksRoot, 'ops-runbook.json');
const integrity = listDirs(integrityRoot, 'ops-integrity.json');
const compliance = listDirs(complianceRoot, 'ops-compliance.json');
const certification = listDirs(certificationRoot, 'ops-certify.json');
const assurance = listDirs(assuranceRoot, 'ops-assure.json');
const governance = listDirs(governanceRoot, 'ops-govern.json');
const oversight = listDirs(oversightRoot, 'ops-oversight.json');
const control = listDirs(controlRoot, 'ops-control.json');
const authority = listDirs(authorityRoot, 'ops-authority.json');
const stewardship = listDirs(stewardshipRoot, 'ops-stewardship.json');
const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) : null;
const now = new Date().toISOString();
const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
const timestamp = now.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const indexDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);
fs.mkdirSync(indexDir, { recursive: true });

const summary = {
  capturedAt: now,
  label,
  package: pkg ? { name: pkg.name, version: pkg.version } : null,
  indexDir: path.relative(rootDir, indexDir),
  counts: { snapshots: snapshots.length, evidence: evidence.length, reports: reports.length, bundles: bundles.length, doctors: doctors.length, handoffs: handoffs.length, attestations: attestations.length, ready: readys.length, gates: gates.length, releasePacks: releasePacks.length, exports: exports.length, restores: restores.length, recoveries: recoveries.length, rollbacks: rollbacks.length, incidents: incidents.length, escalations: escalations.length, continuity: continuity.length, resilience: resilience.length, runbooks: runbooks.length, integrity: integrity.length, compliance: compliance.length, certification: certification.length, assurance: assurance.length, governance: governance.length, oversight: oversight.length, control: control.length, authority: authority.length, stewardship: stewardship.length },
  latest: {
    snapshot: snapshots[0] ?? null,
    evidence: evidence[0] ?? null,
    report: reports[0] ?? null,
    bundle: bundles[0] ?? null,
    doctor: doctors[0] ?? null,
    handoff: handoffs[0] ?? null,
    attestation: attestations[0] ?? null,
    ready: readys[0] ?? null,
    gate: gates[0] ?? null,
    releasePack: releasePacks[0] ?? null,
    export: exports[0] ?? null,
    restore: restores[0] ?? null,
    recovery: recoveries[0] ?? null,
    rollback: rollbacks[0] ?? null,
    incident: incidents[0] ?? null,
    escalation: escalations[0] ?? null,
    continuity: continuity[0] ?? null,
    resilience: resilience[0] ?? null,
    runbook: runbooks[0] ?? null,
    integrity: integrity[0] ?? null,
    compliance: compliance[0] ?? null,
    certification: certification[0] ?? null,
    assurance: assurance[0] ?? null,
    governance: governance[0] ?? null,
    oversight: oversight[0] ?? null,
    control: control[0] ?? null,
    authority: authority[0] ?? null,
    stewardship: stewardship[0] ?? null,
  },
  snapshots,
  evidence,
  reports,
  bundles,
  doctors,
  handoffs,
  attestations,
  readys,
  gates,
  releasePacks,
  exports,
  restores,
  recoveries,
  rollbacks,
  incidents,
  escalations,
  continuity,
  resilience,
  runbooks,
  integrity,
  compliance,
  certification,
  assurance,
  governance,
  oversight,
  control,
  authority,
  stewardship,
};

fs.writeFileSync(path.join(indexDir, 'ops-index.json'), JSON.stringify(summary, null, 2) + '\n');

const lines = [
  '# Operations Index',
  '',
  `- Captured At (UTC): ${summary.capturedAt}`,
  `- Label: ${summary.label}`,
  `- Index Dir: ${summary.indexDir}`,
  `- Package: ${summary.package ? `${summary.package.name}@${summary.package.version}` : 'n/a'}`,
  `- Snapshot directories: ${summary.counts.snapshots}`,
  `- Evidence directories: ${summary.counts.evidence}`,
  `- Report directories: ${summary.counts.reports}`,
  `- Bundle directories: ${summary.counts.bundles}`,
  `- Doctor directories: ${summary.counts.doctors}`,
  `- Handoff directories: ${summary.counts.handoffs}`,
  `- Attestation directories: ${summary.counts.attestations}`,
  `- Ready directories: ${summary.counts.ready}`,
  `- Gate directories: ${summary.counts.gates}`,
  `- Release pack directories: ${summary.counts.releasePacks}`,
  `- Export directories: ${summary.counts.exports}`,
  `- Restore directories: ${summary.counts.restores}`,
  `- Recovery directories: ${summary.counts.recoveries}`,
  `- Rollback directories: ${summary.counts.rollbacks}`,
  `- Incident directories: ${summary.counts.incidents}`,
  `- Escalation directories: ${summary.counts.escalations}`,
  `- Continuity directories: ${summary.counts.continuity}`,
  `- Resilience directories: ${summary.counts.resilience}`,
  `- Runbook directories: ${summary.counts.runbooks}`,
  `- Integrity directories: ${summary.counts.integrity}`,
  `- Compliance directories: ${summary.counts.compliance}`,
  `- Certification directories: ${summary.counts.certification}`,
  `- Assurance directories: ${summary.counts.assurance}`,
  `- Governance directories: ${summary.counts.governance}`,
  `- Oversight directories: ${summary.counts.oversight}`,
  `- Control directories: ${summary.counts.control}`,
  `- Authority directories: ${summary.counts.authority}`,
  `- Stewardship directories: ${summary.counts.stewardship}`,
  '',
  '## Latest Snapshot',
  '',
  summary.latest.snapshot ? `- ${summary.latest.snapshot.relativeDir} (${summary.latest.snapshot.modifiedAt})` : '- none',
  '',
  '## Latest Evidence',
  '',
  summary.latest.evidence ? `- ${summary.latest.evidence.relativeDir} (${summary.latest.evidence.modifiedAt})` : '- none',
  '',
  '## Latest Report',
  '',
  summary.latest.report ? `- ${summary.latest.report.relativeDir} (${summary.latest.report.modifiedAt})` : '- none',
  '',
  '## Latest Bundle',
  '',
  summary.latest.bundle ? `- ${summary.latest.bundle.relativeDir} (${summary.latest.bundle.modifiedAt})` : '- none',
  '',
  '## Latest Doctor',
  '',
  summary.latest.doctor ? `- ${summary.latest.doctor.relativeDir} (${summary.latest.doctor.modifiedAt})` : '- none',
  '',
  '## Latest Handoff',
  '',
  summary.latest.handoff ? `- ${summary.latest.handoff.relativeDir} (${summary.latest.handoff.modifiedAt})` : '- none',
  '',
  '## Latest Attestation',
  '',
  summary.latest.attestation ? `- ${summary.latest.attestation.relativeDir} (${summary.latest.attestation.modifiedAt})` : '- none',
  '',
  '## Latest Ready',
  '',
  summary.latest.ready ? `- ${summary.latest.ready.relativeDir} (${summary.latest.ready.modifiedAt})` : '- none',
  '',
  '## Latest Gate',
  '',
  summary.latest.gate ? `- ${summary.latest.gate.relativeDir} (${summary.latest.gate.modifiedAt})` : '- none',
  '',
  '## Latest Release Pack',
  '',
  summary.latest.releasePack ? `- ${summary.latest.releasePack.relativeDir} (${summary.latest.releasePack.modifiedAt})` : '- none',
  '',
  '## Latest Export',
  '',
  summary.latest.export ? `- ${summary.latest.export.relativeDir} (${summary.latest.export.modifiedAt})` : '- none',
  '',
  '## Latest Restore',
  '',
  summary.latest.restore ? `- ${summary.latest.restore.relativeDir} (${summary.latest.restore.modifiedAt})` : '- none',
  '',
  '## Latest Recovery',
  '',
  summary.latest.recovery ? `- ${summary.latest.recovery.relativeDir} (${summary.latest.recovery.modifiedAt})` : '- none',
  '',
  '## Latest Rollback',
  '',
  summary.latest.rollback ? `- ${summary.latest.rollback.relativeDir} (${summary.latest.rollback.modifiedAt})` : '- none',
  '',
  '## Latest Incident',
  '',
  summary.latest.incident ? `- ${summary.latest.incident.relativeDir} (${summary.latest.incident.modifiedAt})` : '- none',
  '',
  '## Latest Escalation',
  '',
  summary.latest.escalation ? `- ${summary.latest.escalation.relativeDir} (${summary.latest.escalation.modifiedAt})` : '- none',
  '',
  '## Latest Continuity',
  '',
  summary.latest.continuity ? `- ${summary.latest.continuity.relativeDir} (${summary.latest.continuity.modifiedAt})` : '- none',
  '',
  '## Latest Resilience',
  '',
  summary.latest.resilience ? `- ${summary.latest.resilience.relativeDir} (${summary.latest.resilience.modifiedAt})` : '- none',
  '',
  '## Latest Runbook',
  '',
  summary.latest.runbook ? `- ${summary.latest.runbook.relativeDir} (${summary.latest.runbook.modifiedAt})` : '- none',
  '',
  '## Latest Integrity',
  '',
  summary.latest.integrity ? `- ${summary.latest.integrity.relativeDir} (${summary.latest.integrity.modifiedAt})` : '- none',
  '',
  '## Latest Compliance',
  '',
  summary.latest.compliance ? `- ${summary.latest.compliance.relativeDir} (${summary.latest.compliance.modifiedAt})` : '- none',
  '',
  '## Latest Certification',
  '',
  summary.latest.certification ? `- ${summary.latest.certification.relativeDir} (${summary.latest.certification.modifiedAt})` : '- none',
  '',
  '## Latest Assurance',
  '',
  summary.latest.assurance ? `- ${summary.latest.assurance.relativeDir} (${summary.latest.assurance.modifiedAt})` : '- none',
  '',
  '## Latest Governance',
  '',
  summary.latest.governance ? `- ${summary.latest.governance.relativeDir} (${summary.latest.governance.modifiedAt})` : '- none',
  '',
  '## Latest Oversight',
  '',
  summary.latest.oversight ? `- ${summary.latest.oversight.relativeDir} (${summary.latest.oversight.modifiedAt})` : '- none',
  '',
  '## Latest Control',
  '',
  summary.latest.control ? `- ${summary.latest.control.relativeDir} (${summary.latest.control.modifiedAt})` : '- none',
  '',
  '## Latest Authority',
  '',
  summary.latest.authority ? `- ${summary.latest.authority.relativeDir} (${summary.latest.authority.modifiedAt})` : '- none',
  '',
  '## Latest Stewardship',
  '',
  summary.latest.stewardship ? `- ${summary.latest.stewardship.relativeDir} (${summary.latest.stewardship.modifiedAt})` : '- none',
  '',
  '## Control Inventory',
  '',
  ...(summary.control.length > 0 ? summary.control.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Authority Inventory',
  '',
  ...(summary.authority.length > 0 ? summary.authority.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Stewardship Inventory',
  '',
  ...(summary.stewardship.length > 0 ? summary.stewardship.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Snapshot Inventory',
  '',
  ...(summary.snapshots.length > 0 ? summary.snapshots.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Evidence Inventory',
  '',
  ...(summary.evidence.length > 0 ? summary.evidence.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Report Inventory',
  '',
  ...(summary.reports.length > 0 ? summary.reports.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Bundle Inventory',
  '',
  ...(summary.bundles.length > 0 ? summary.bundles.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Doctor Inventory',
  '',
  ...(summary.doctors.length > 0 ? summary.doctors.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Handoff Inventory',
  '',
  ...(summary.handoffs.length > 0 ? summary.handoffs.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Attestation Inventory',
  '',
  ...(summary.attestations.length > 0 ? summary.attestations.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Ready Inventory',
  '',
  ...(summary.readys.length > 0 ? summary.readys.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Gate Inventory',
  '',
  ...(summary.gates.length > 0 ? summary.gates.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Release Pack Inventory',
  '',
  ...(summary.releasePacks.length > 0 ? summary.releasePacks.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Export Inventory',
  '',
  ...(summary.exports.length > 0 ? summary.exports.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Restore Inventory',
  '',
  ...(summary.restores.length > 0 ? summary.restores.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Recovery Inventory',
  '',
  ...(summary.recoveries.length > 0 ? summary.recoveries.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Rollback Inventory',
  '',
  ...(summary.rollbacks.length > 0 ? summary.rollbacks.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Incident Inventory',
  '',
  ...(summary.incidents.length > 0 ? summary.incidents.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Escalation Inventory',
  '',
  ...(summary.escalations.length > 0 ? summary.escalations.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Continuity Inventory',
  '',
  ...(summary.continuity.length > 0 ? summary.continuity.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Resilience Inventory',
  '',
  ...(summary.resilience.length > 0 ? summary.resilience.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Runbook Inventory',
  '',
  ...(summary.runbooks.length > 0 ? summary.runbooks.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Integrity Inventory',
  '',
  ...(summary.integrity.length > 0 ? summary.integrity.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Compliance Inventory',
  '',
  ...(summary.compliance.length > 0 ? summary.compliance.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Certification Inventory',
  '',
  ...(summary.certification.length > 0 ? summary.certification.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Assurance Inventory',
  '',
  ...(summary.assurance.length > 0 ? summary.assurance.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Governance Inventory',
  '',
  ...(summary.governance.length > 0 ? summary.governance.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
  '## Oversight Inventory',
  '',
  ...(summary.oversight.length > 0 ? summary.oversight.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : ['- none']),
  '',
];

fs.writeFileSync(path.join(indexDir, 'ops-index.md'), lines.join('\n') + '\n');
console.log(`Operations index written to: ${indexDir}`);
NODE
