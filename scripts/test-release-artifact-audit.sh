#!/bin/bash
set -euo pipefail

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-audit.XXXXXX")"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

run_case() {
  local platform="$1"
  local arch="$2"
  local installer_name="$3"
  local manifest_name="$4"
  local case_dir="$WORK_DIR/$platform-$arch/release"

  mkdir -p "$case_dir"
  touch "$case_dir/$installer_name"
  cat > "$case_dir/$manifest_name" <<EOF
version: 0.1.44
path: $installer_name
sha512: smoke
releaseDate: '2026-03-29T00:00:00.000Z'
EOF

  bash scripts/audit-published-artifacts.sh "$case_dir" "$platform" "$arch"
}

run_case "mac" "arm64" "Forge-App-0.1.44.dmg" "latest-mac.yml"
run_case "win" "x64" "Forge-App-Setup-0.1.44.exe" "latest.yml"
run_case "linux" "x64" "Forge-App-0.1.44.AppImage" "latest-linux.yml"

echo "Release artifact audit smoke test passed."
