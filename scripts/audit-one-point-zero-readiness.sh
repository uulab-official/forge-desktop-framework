#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

OUTPUT_DIR="${1:-$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero.XXXXXX")}"
mkdir -p "$OUTPUT_DIR"

SUMMARY_MD="$OUTPUT_DIR/one-point-zero-readiness.md"
SUMMARY_JSON="$OUTPUT_DIR/one-point-zero-readiness.json"

require_file() {
  local path="$1"

  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path"
    exit 1
  fi
}

require_contains() {
  local path="$1"
  local pattern="$2"

  if ! grep -Fq "$pattern" "$path"; then
    echo "Expected '$pattern' in $path"
    exit 1
  fi
}

require_file "docs/one-point-zero-gate.md"
require_file "README.md"
require_file "docs/deployment.md"
require_file "packages/create-forge-app/README.md"
require_file ".github/workflows/ci.yml"
require_file "scripts/release.sh"
require_file "package.json"

require_contains "docs/one-point-zero-gate.md" "## 1.0 Official Surface"
require_contains "docs/one-point-zero-gate.md" "## 1.0 Exit Criteria"
require_contains "docs/one-point-zero-gate.md" "launch-ready"
require_contains "docs/one-point-zero-gate.md" "support-ready"
require_contains "docs/one-point-zero-gate.md" "ops-ready"
require_contains "docs/one-point-zero-gate.md" "document-ready"
require_contains "docs/one-point-zero-gate.md" "production-ready"
require_contains "docs/one-point-zero-gate.md" "pnpm release:onepointzero:test"
require_contains "README.md" "Forge 1.0 release gate"
require_contains "docs/deployment.md" "Forge 1.0 release gate"
require_contains "packages/create-forge-app/README.md" "Forge 1.0 release gate"
require_contains "scripts/release.sh" "bash scripts/test-one-point-zero-readiness.sh"
require_contains ".github/workflows/ci.yml" "pnpm release:onepointzero:test"

node - "$SUMMARY_MD" "$SUMMARY_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const yaml = fs.readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const releaseScript = fs.readFileSync(path.join(process.cwd(), 'scripts/release.sh'), 'utf8');
const gateDoc = fs.readFileSync(path.join(process.cwd(), 'docs/one-point-zero-gate.md'), 'utf8');
const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');
const deployment = fs.readFileSync(path.join(process.cwd(), 'docs/deployment.md'), 'utf8');
const cliReadme = fs.readFileSync(path.join(process.cwd(), 'packages/create-forge-app/README.md'), 'utf8');

const expectedScripts = {
  'release:onepointzero:test': 'bash scripts/test-one-point-zero-readiness.sh',
  'release:audit': 'pnpm --filter create-forge-desktop build && bash scripts/audit-release-surfaces.sh',
  'release:history:remote:test': 'bash scripts/test-release-remote-history-preparation.sh',
  'release:rollback:remote:test': 'bash scripts/test-remote-release-rollback-drill.sh',
  'release:ship': 'bash scripts/ship-release.sh',
};

const scriptChecks = Object.entries(expectedScripts).map(([name, command]) => ({
  name,
  expected: command,
  actual: packageJson.scripts?.[name] ?? null,
  passed: packageJson.scripts?.[name] === command,
}));

const ciCommands = [
  'pnpm scaffold:external:test',
  'pnpm release:audit',
  'pnpm release:history:test',
  'pnpm release:rollback:target:test',
  'pnpm release:rollback:prepare:test',
  'pnpm release:history:remote:test',
  'pnpm release:rollback:remote:test',
  'pnpm release:onepointzero:test',
];

const ciChecks = ciCommands.map((command) => ({
  command,
  passed: yaml.includes(command),
}));

const releaseChecks = [
  {
    name: 'release-checklist verification',
    passed: releaseScript.includes('bash scripts/verify-release-checklist.sh'),
  },
  {
    name: 'one-point-zero readiness smoke',
    passed: releaseScript.includes('bash scripts/test-one-point-zero-readiness.sh'),
  },
  {
    name: 'official preset release audit',
    passed: releaseScript.includes('bash scripts/audit-release-surfaces.sh'),
  },
];

const docChecks = [
  {
    name: 'gate document exists',
    passed: gateDoc.includes('# Forge 1.0 Release Gate'),
  },
  {
    name: 'README references gate',
    passed: readme.includes('Forge 1.0 release gate'),
  },
  {
    name: 'deployment guide references gate',
    passed: deployment.includes('Forge 1.0 release gate'),
  },
  {
    name: 'CLI README references gate',
    passed: cliReadme.includes('Forge 1.0 release gate'),
  },
];

const presetChecks = ['launch-ready', 'support-ready', 'ops-ready', 'document-ready'].map((preset) => ({
  preset,
  passed: gateDoc.includes(`- \`${preset}\``),
}));

const compositePresetChecks = ['production-ready'].map((preset) => ({
  preset,
  passed: gateDoc.includes(`- \`${preset}\``) && readme.includes(`\`${preset}\``) && deployment.includes(`\`${preset}\``) && cliReadme.includes(`\`${preset}\``),
}));

const checks = [
  ...scriptChecks.map((entry) => ({ name: `script:${entry.name}`, passed: entry.passed })),
  ...ciChecks.map((entry) => ({ name: `ci:${entry.command}`, passed: entry.passed })),
  ...releaseChecks.map((entry) => ({ name: `release:${entry.name}`, passed: entry.passed })),
  ...docChecks.map((entry) => ({ name: `doc:${entry.name}`, passed: entry.passed })),
  ...presetChecks.map((entry) => ({ name: `preset:${entry.preset}`, passed: entry.passed })),
  ...compositePresetChecks.map((entry) => ({ name: `composite:${entry.preset}`, passed: entry.passed })),
];

const status = checks.every((entry) => entry.passed) ? 'passed' : 'failed';

const payload = {
  status,
  officialPresets: presetChecks,
  compositePresets: compositePresetChecks,
  packageScripts: scriptChecks,
  ciCommands: ciChecks,
  releaseGuards: releaseChecks,
  docs: docChecks,
};

const markdown = [
  '# One Point Zero Readiness',
  '',
  `- Status: \`${status}\``,
  '',
  '## Official Presets',
  '',
  '| Preset | Ready |',
  '| --- | --- |',
  ...presetChecks.map((entry) => `| \`${entry.preset}\` | ${entry.passed} |`),
  '',
  '## Composite Production Presets',
  '',
  '| Preset | Ready |',
  '| --- | --- |',
  ...compositePresetChecks.map((entry) => `| \`${entry.preset}\` | ${entry.passed} |`),
  '',
  '## Package Scripts',
  '',
  '| Script | Ready |',
  '| --- | --- |',
  ...scriptChecks.map((entry) => `| \`${entry.name}\` | ${entry.passed} |`),
  '',
  '## CI Release-Readiness Commands',
  '',
  '| Command | Ready |',
  '| --- | --- |',
  ...ciChecks.map((entry) => `| \`${entry.command}\` | ${entry.passed} |`),
  '',
  '## Release Guards',
  '',
  '| Guard | Ready |',
  '| --- | --- |',
  ...releaseChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
  '## Public Docs',
  '',
  '| Surface | Ready |',
  '| --- | --- |',
  ...docChecks.map((entry) => `| ${entry.name} | ${entry.passed} |`),
  '',
].join('\n');

fs.writeFileSync(process.argv[2], `${markdown}\n`);
fs.writeFileSync(process.argv[3], `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error('Forge 1.0 readiness audit failed.');
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Forge 1.0 readiness audit written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
