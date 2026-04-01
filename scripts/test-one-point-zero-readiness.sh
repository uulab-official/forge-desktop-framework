#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-one-point-zero-smoke.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

bash scripts/audit-one-point-zero-readiness.sh "$WORK_DIR/output"

[[ -f "$WORK_DIR/output/one-point-zero-readiness.md" ]]
[[ -f "$WORK_DIR/output/one-point-zero-readiness.json" ]]

node - "$WORK_DIR/output/one-point-zero-readiness.json" <<'NODE'
const fs = require('node:fs');

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (payload.status !== 'passed') {
  throw new Error(`Expected readiness audit to pass, found ${payload.status}`);
}

if (payload.officialPresets.length !== 4) {
  throw new Error(`Expected 4 official presets, found ${payload.officialPresets.length}`);
}

if (!payload.packageScripts.find((entry) => entry.name === 'release:onepointzero:test' && entry.passed)) {
  throw new Error('Expected release:onepointzero:test package script to pass');
}

if (!payload.ciCommands.find((entry) => entry.command === 'pnpm release:onepointzero:test' && entry.passed)) {
  throw new Error('Expected CI to run pnpm release:onepointzero:test');
}
NODE

echo "Forge 1.0 readiness smoke test passed."
