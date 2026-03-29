#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-signing-audit.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

env \
  GH_TOKEN=forge-smoke-token \
  CSC_LINK=forge-smoke-csc-link \
  CSC_KEY_PASSWORD=forge-smoke-csc-password \
  APPLE_ID=forge@example.com \
  APPLE_APP_SPECIFIC_PASSWORD=forge-smoke-app-password \
  APPLE_TEAM_ID=FORGETEAM \
  bash scripts/audit-signing-readiness.sh mac arm64 "$TMP_DIR/mac-arm64"

env \
  GH_TOKEN=forge-smoke-token \
  WIN_CSC_LINK=forge-smoke-win-link \
  WIN_CSC_KEY_PASSWORD=forge-smoke-win-password \
  bash scripts/audit-signing-readiness.sh win x64 "$TMP_DIR/win-x64"

env \
  GH_TOKEN=forge-smoke-token \
  bash scripts/audit-signing-readiness.sh linux x64 "$TMP_DIR/linux-x64"

if env \
  GH_TOKEN=forge-smoke-token \
  CSC_LINK=forge-smoke-csc-link \
  CSC_KEY_PASSWORD=forge-smoke-csc-password \
  APPLE_APP_SPECIFIC_PASSWORD=forge-smoke-app-password \
  APPLE_TEAM_ID=FORGETEAM \
  bash scripts/audit-signing-readiness.sh mac arm64 "$TMP_DIR/negative" >/dev/null 2>&1; then
  echo "Expected mac signing readiness audit to fail without APPLE_ID"
  exit 1
fi

for audit_dir in "$TMP_DIR/mac-arm64" "$TMP_DIR/win-x64" "$TMP_DIR/linux-x64"; do
  [[ -f "$audit_dir/signing-readiness.md" ]]
  [[ -f "$audit_dir/signing-readiness.json" ]]
done

echo "Signing readiness audit smoke test passed."
