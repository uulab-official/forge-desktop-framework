#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

LABEL="manual"
OUTPUT_ROOT="${OPS_SNAPSHOT_DIR:-ops/snapshots}"

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
      echo "Unsupported ops snapshot argument: $1"
      echo "Use --label <name> and optional --output-dir <dir>."
      exit 1
      ;;
  esac
  shift
done

safe_label="$(printf "%s" "$LABEL" | tr "[:upper:]" "[:lower:]" | tr -cs "a-z0-9._-" "-")"
timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
snapshot_dir="$OUTPUT_ROOT/${timestamp}-${safe_label}"
mkdir -p "$snapshot_dir"

json_path="$snapshot_dir/ops-snapshot.json"
markdown_path="$snapshot_dir/ops-snapshot.md"

node - "$ROOT_DIR" "$json_path" "$markdown_path" "$LABEL" "$timestamp" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, jsonPath, markdownPath, label, timestamp] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const releaseDir = path.join(rootDir, 'release');
const docsDir = path.join(rootDir, 'docs');
const scriptsDir = path.join(rootDir, 'scripts');

const listIfExists = (dir, filter) => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((entry) => !filter || filter(entry)).sort()
  : [];

const readLines = (file) => fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').split(/\r?\n/)
  : [];

const envExamplePath = path.join(rootDir, '.env.example');
const envLines = readLines(envExamplePath);
const releaseFiles = listIfExists(releaseDir);
const manifestFiles = releaseFiles.filter((file) => file.startsWith('latest') && file.endsWith('.yml'));
const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));
const ci = {
  provider: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
  workflow: process.env.GITHUB_WORKFLOW ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  refName: process.env.GITHUB_REF_NAME ?? null,
  sha: process.env.GITHUB_SHA ?? null,
  runnerOs: process.env.RUNNER_OS ?? process.platform,
};

const snapshot = {
  label,
  capturedAt: timestamp,
  package: {
    name: pkg.name,
    version: pkg.version,
  },
  commands: {
    releaseCheck: pkg.scripts?.['release:check'] ?? null,
    securityCheck: pkg.scripts?.['security:check'] ?? null,
    opsCheck: pkg.scripts?.['ops:check'] ?? null,
    opsSnapshot: pkg.scripts?.['ops:snapshot'] ?? null,
    opsEvidence: pkg.scripts?.['ops:evidence'] ?? null,
    opsReport: pkg.scripts?.['ops:report'] ?? null,
    opsBundle: pkg.scripts?.['ops:bundle'] ?? null,
    opsIndex: pkg.scripts?.['ops:index'] ?? null,
    opsDoctor: pkg.scripts?.['ops:doctor'] ?? null,
    opsHandoff: pkg.scripts?.['ops:handoff'] ?? null,
    opsAttest: pkg.scripts?.['ops:attest'] ?? null,
    opsReady: pkg.scripts?.['ops:ready'] ?? null,
    opsGate: pkg.scripts?.['ops:gate'] ?? null,
    opsReleasePack: pkg.scripts?.['ops:releasepack'] ?? null,
    opsExport: pkg.scripts?.['ops:export'] ?? null,
    opsRestore: pkg.scripts?.['ops:restore'] ?? null,
    opsRecover: pkg.scripts?.['ops:recover'] ?? null,
    opsRollback: pkg.scripts?.['ops:rollback'] ?? null,
    opsIncident: pkg.scripts?.['ops:incident'] ?? null,
    opsEscalate: pkg.scripts?.['ops:escalate'] ?? null,
    opsContinuity: pkg.scripts?.['ops:continuity'] ?? null,
    opsResilience: pkg.scripts?.['ops:resilience'] ?? null,
    opsRunbook: pkg.scripts?.['ops:runbook'] ?? null,
    opsIntegrity: pkg.scripts?.['ops:integrity'] ?? null,
    opsCompliance: pkg.scripts?.['ops:compliance'] ?? null,
    opsCertify: pkg.scripts?.['ops:certify'] ?? null,
    opsAssure: pkg.scripts?.['ops:assure'] ?? null,
    opsGovern: pkg.scripts?.['ops:govern'] ?? null,
    opsOversight: pkg.scripts?.['ops:oversight'] ?? null,
    opsControl: pkg.scripts?.['ops:control'] ?? null,
    opsAuthority: pkg.scripts?.['ops:authority'] ?? null,
    opsStewardship: pkg.scripts?.['ops:stewardship'] ?? null,
    opsRetention: pkg.scripts?.['ops:retention'] ?? null,
    productionCheck: pkg.scripts?.['production:check'] ?? null,
  },
  files: {
    releasePlaybook: fs.existsSync(path.join(docsDir, 'release-playbook.md')),
    productionReadiness: fs.existsSync(path.join(docsDir, 'production-readiness.md')),
    preflightRelease: fs.existsSync(path.join(scriptsDir, 'preflight-release.sh')),
    securityBaseline: fs.existsSync(path.join(scriptsDir, 'security-baseline.sh')),
    runtimeHygiene: fs.existsSync(path.join(scriptsDir, 'runtime-hygiene.sh')),
    opsSnapshot: fs.existsSync(path.join(scriptsDir, 'ops-snapshot.sh')),
    opsEvidence: fs.existsSync(path.join(scriptsDir, 'ops-evidence.sh')),
    opsReport: fs.existsSync(path.join(scriptsDir, 'ops-report.sh')),
    opsBundle: fs.existsSync(path.join(scriptsDir, 'ops-bundle.sh')),
    opsIndex: fs.existsSync(path.join(scriptsDir, 'ops-index.sh')),
    opsDoctor: fs.existsSync(path.join(scriptsDir, 'ops-doctor.sh')),
    opsHandoff: fs.existsSync(path.join(scriptsDir, 'ops-handoff.sh')),
    opsAttest: fs.existsSync(path.join(scriptsDir, 'ops-attest.sh')),
    opsReady: fs.existsSync(path.join(scriptsDir, 'ops-ready.sh')),
    opsGate: fs.existsSync(path.join(scriptsDir, 'ops-gate.sh')),
    opsReleasePack: fs.existsSync(path.join(scriptsDir, 'ops-releasepack.sh')),
    opsExport: fs.existsSync(path.join(scriptsDir, 'ops-export.sh')),
    opsRestore: fs.existsSync(path.join(scriptsDir, 'ops-restore.sh')),
    opsRecover: fs.existsSync(path.join(scriptsDir, 'ops-recover.sh')),
    opsRollback: fs.existsSync(path.join(scriptsDir, 'ops-rollback.sh')),
    opsIncident: fs.existsSync(path.join(scriptsDir, 'ops-incident.sh')),
    opsEscalate: fs.existsSync(path.join(scriptsDir, 'ops-escalate.sh')),
    opsContinuity: fs.existsSync(path.join(scriptsDir, 'ops-continuity.sh')),
    opsResilience: fs.existsSync(path.join(scriptsDir, 'ops-resilience.sh')),
    opsRunbook: fs.existsSync(path.join(scriptsDir, 'ops-runbook.sh')),
    opsIntegrity: fs.existsSync(path.join(scriptsDir, 'ops-integrity.sh')),
    opsCompliance: fs.existsSync(path.join(scriptsDir, 'ops-compliance.sh')),
    opsCertify: fs.existsSync(path.join(scriptsDir, 'ops-certify.sh')),
    opsAssure: fs.existsSync(path.join(scriptsDir, 'ops-assure.sh')),
    opsGovern: fs.existsSync(path.join(scriptsDir, 'ops-govern.sh')),
    opsOversight: fs.existsSync(path.join(scriptsDir, 'ops-oversight.sh')),
    opsControl: fs.existsSync(path.join(scriptsDir, 'ops-control.sh')),
    opsAuthority: fs.existsSync(path.join(scriptsDir, 'ops-authority.sh')),
    opsStewardship: fs.existsSync(path.join(scriptsDir, 'ops-stewardship.sh')),
    opsRetention: fs.existsSync(path.join(scriptsDir, 'ops-retention.sh')),
    productionReadinessScript: fs.existsSync(path.join(scriptsDir, 'production-readiness.sh')),
  },
  release: {
    exists: fs.existsSync(releaseDir),
    manifests: manifestFiles,
    installers: installerFiles,
  },
  envTemplate: {
    githubOwner: envLines.some((line) => line.startsWith('GH_OWNER=')),
    githubRepo: envLines.some((line) => line.startsWith('GH_REPO=')),
    s3UpdateUrl: envLines.some((line) => line.startsWith('S3_UPDATE_URL=')),
  },
  ci,
};

fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2) + '\n');

const lines = [
  '# Operations Snapshot',
  '',
  `- Label: ${label}`,
  `- Captured At (UTC): ${timestamp}`,
  `- Package: ${snapshot.package.name}@${snapshot.package.version}`,
  '',
  '## Commands',
  '',
  `- release:check: ${snapshot.commands.releaseCheck ?? 'missing'}`,
  `- security:check: ${snapshot.commands.securityCheck ?? 'missing'}`,
  `- ops:check: ${snapshot.commands.opsCheck ?? 'missing'}`,
  `- ops:snapshot: ${snapshot.commands.opsSnapshot ?? 'missing'}`,
  `- ops:evidence: ${snapshot.commands.opsEvidence ?? 'missing'}`,
  `- ops:report: ${snapshot.commands.opsReport ?? 'missing'}`,
  `- ops:bundle: ${snapshot.commands.opsBundle ?? 'missing'}`,
  `- ops:index: ${snapshot.commands.opsIndex ?? 'missing'}`,
  `- ops:doctor: ${snapshot.commands.opsDoctor ?? 'missing'}`,
  `- ops:handoff: ${snapshot.commands.opsHandoff ?? 'missing'}`,
  `- ops:attest: ${snapshot.commands.opsAttest ?? 'missing'}`,
  `- ops:ready: ${snapshot.commands.opsReady ?? 'missing'}`,
  `- ops:gate: ${snapshot.commands.opsGate ?? 'missing'}`,
  `- ops:releasepack: ${snapshot.commands.opsReleasePack ?? 'missing'}`,
  `- ops:export: ${snapshot.commands.opsExport ?? 'missing'}`,
  `- ops:restore: ${snapshot.commands.opsRestore ?? 'missing'}`,
  `- ops:recover: ${snapshot.commands.opsRecover ?? 'missing'}`,
  `- ops:rollback: ${snapshot.commands.opsRollback ?? 'missing'}`,
  `- ops:incident: ${snapshot.commands.opsIncident ?? 'missing'}`,
  `- ops:escalate: ${snapshot.commands.opsEscalate ?? 'missing'}`,
  `- ops:continuity: ${snapshot.commands.opsContinuity ?? 'missing'}`,
  `- ops:resilience: ${snapshot.commands.opsResilience ?? 'missing'}`,
  `- ops:runbook: ${snapshot.commands.opsRunbook ?? 'missing'}`,
  `- ops:integrity: ${snapshot.commands.opsIntegrity ?? 'missing'}`,
  `- ops:compliance: ${snapshot.commands.opsCompliance ?? 'missing'}`,
  `- ops:certify: ${snapshot.commands.opsCertify ?? 'missing'}`,
  `- ops:assure: ${snapshot.commands.opsAssure ?? 'missing'}`,
  `- ops:govern: ${snapshot.commands.opsGovern ?? 'missing'}`,
  `- ops:oversight: ${snapshot.commands.opsOversight ?? 'missing'}`,
  `- ops:control: ${snapshot.commands.opsControl ?? 'missing'}`,
  `- ops:authority: ${snapshot.commands.opsAuthority ?? 'missing'}`,
  `- ops:stewardship: ${snapshot.commands.opsStewardship ?? 'missing'}`,
  `- ops:retention: ${snapshot.commands.opsRetention ?? 'missing'}`,
  `- production:check: ${snapshot.commands.productionCheck ?? 'missing'}`,
  '',
  '## Surface Files',
  '',
  `- docs/release-playbook.md: ${snapshot.files.releasePlaybook ? 'present' : 'missing'}`,
  `- docs/production-readiness.md: ${snapshot.files.productionReadiness ? 'present' : 'missing'}`,
  `- scripts/preflight-release.sh: ${snapshot.files.preflightRelease ? 'present' : 'missing'}`,
  `- scripts/security-baseline.sh: ${snapshot.files.securityBaseline ? 'present' : 'missing'}`,
  `- scripts/runtime-hygiene.sh: ${snapshot.files.runtimeHygiene ? 'present' : 'missing'}`,
  `- scripts/ops-snapshot.sh: ${snapshot.files.opsSnapshot ? 'present' : 'missing'}`,
  `- scripts/ops-evidence.sh: ${snapshot.files.opsEvidence ? 'present' : 'missing'}`,
  `- scripts/ops-report.sh: ${snapshot.files.opsReport ? 'present' : 'missing'}`,
  `- scripts/ops-bundle.sh: ${snapshot.files.opsBundle ? 'present' : 'missing'}`,
  `- scripts/ops-index.sh: ${snapshot.files.opsIndex ? 'present' : 'missing'}`,
  `- scripts/ops-doctor.sh: ${snapshot.files.opsDoctor ? 'present' : 'missing'}`,
  `- scripts/ops-handoff.sh: ${snapshot.files.opsHandoff ? 'present' : 'missing'}`,
  `- scripts/ops-attest.sh: ${snapshot.files.opsAttest ? 'present' : 'missing'}`,
  `- scripts/ops-ready.sh: ${snapshot.files.opsReady ? 'present' : 'missing'}`,
  `- scripts/ops-gate.sh: ${snapshot.files.opsGate ? 'present' : 'missing'}`,
  `- scripts/ops-releasepack.sh: ${snapshot.files.opsReleasePack ? 'present' : 'missing'}`,
  `- scripts/ops-export.sh: ${snapshot.files.opsExport ? 'present' : 'missing'}`,
  `- scripts/ops-restore.sh: ${snapshot.files.opsRestore ? 'present' : 'missing'}`,
  `- scripts/ops-recover.sh: ${snapshot.files.opsRecover ? 'present' : 'missing'}`,
  `- scripts/ops-rollback.sh: ${snapshot.files.opsRollback ? 'present' : 'missing'}`,
  `- scripts/ops-incident.sh: ${snapshot.files.opsIncident ? 'present' : 'missing'}`,
  `- scripts/ops-escalate.sh: ${snapshot.files.opsEscalate ? 'present' : 'missing'}`,
  `- scripts/ops-continuity.sh: ${snapshot.files.opsContinuity ? 'present' : 'missing'}`,
  `- scripts/ops-resilience.sh: ${snapshot.files.opsResilience ? 'present' : 'missing'}`,
  `- scripts/ops-runbook.sh: ${snapshot.files.opsRunbook ? 'present' : 'missing'}`,
  `- scripts/ops-integrity.sh: ${snapshot.files.opsIntegrity ? 'present' : 'missing'}`,
  `- scripts/ops-compliance.sh: ${snapshot.files.opsCompliance ? 'present' : 'missing'}`,
  `- scripts/ops-certify.sh: ${snapshot.files.opsCertify ? 'present' : 'missing'}`,
  `- scripts/ops-assure.sh: ${snapshot.files.opsAssure ? 'present' : 'missing'}`,
  `- scripts/ops-govern.sh: ${snapshot.files.opsGovern ? 'present' : 'missing'}`,
  `- scripts/ops-oversight.sh: ${snapshot.files.opsOversight ? 'present' : 'missing'}`,
  `- scripts/ops-control.sh: ${snapshot.files.opsControl ? 'present' : 'missing'}`,
  `- scripts/ops-authority.sh: ${snapshot.files.opsAuthority ? 'present' : 'missing'}`,
  `- scripts/ops-stewardship.sh: ${snapshot.files.opsStewardship ? 'present' : 'missing'}`,
  `- scripts/ops-retention.sh: ${snapshot.files.opsRetention ? 'present' : 'missing'}`,
  `- scripts/production-readiness.sh: ${snapshot.files.productionReadinessScript ? 'present' : 'missing'}`,
  '',
  '## Release Directory',
  '',
  `- Present: ${snapshot.release.exists ? 'yes' : 'no'}`,
  `- Manifest count: ${snapshot.release.manifests.length}`,
  `- Installer count: ${snapshot.release.installers.length}`,
  snapshot.release.manifests.length > 0 ? `- Manifests: ${snapshot.release.manifests.join(', ')}` : '- Manifests: none',
  snapshot.release.installers.length > 0 ? `- Installers: ${snapshot.release.installers.join(', ')}` : '- Installers: none',
  '',
  '## Env Template',
  '',
  `- GH_OWNER present: ${snapshot.envTemplate.githubOwner ? 'yes' : 'no'}`,
  `- GH_REPO present: ${snapshot.envTemplate.githubRepo ? 'yes' : 'no'}`,
  `- S3_UPDATE_URL present: ${snapshot.envTemplate.s3UpdateUrl ? 'yes' : 'no'}`,
  '',
  '## CI Context',
  '',
  `- Provider: ${snapshot.ci.provider}`,
  `- Workflow: ${snapshot.ci.workflow ?? 'n/a'}`,
  `- Run ID: ${snapshot.ci.runId ?? 'n/a'}`,
  `- Ref Name: ${snapshot.ci.refName ?? 'n/a'}`,
  `- SHA: ${snapshot.ci.sha ?? 'n/a'}`,
  `- Runner OS: ${snapshot.ci.runnerOs}`,
  '',
];

fs.writeFileSync(markdownPath, lines.join('\n') + '\n');
NODE

echo "Operations snapshot written to: $snapshot_dir"
