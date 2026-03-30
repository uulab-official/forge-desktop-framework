#!/bin/bash
set -euo pipefail

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-manifest-audit.XXXXXX")"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

run_case() {
  local platform="$1"
  local arch="$2"
  local version="$3"
  local installer_name="$4"
  local manifest_name="$5"
  local case_dir="$WORK_DIR/$platform-$arch/release"

  mkdir -p "$case_dir"
  touch "$case_dir/$installer_name"
  cat > "$case_dir/$manifest_name" <<EOF
version: $version
path: $installer_name
sha512: smoke
releaseDate: '2026-03-30T00:00:00.000Z'
EOF

  bash scripts/audit-release-manifests.sh "$case_dir" "$platform" "$arch" "$version"
}

run_case "mac" "arm64" "0.1.49" "Forge-App-0.1.49.dmg" "latest-mac.yml"
run_case "win" "x64" "0.1.49" "Forge-App-Setup-0.1.49.exe" "latest.yml"
run_case "linux" "x64" "0.1.49" "Forge-App-0.1.49.AppImage" "latest-linux.yml"

BAD_DIR="$WORK_DIR/bad/release"
mkdir -p "$BAD_DIR"
touch "$BAD_DIR/Forge-App-0.1.49.dmg"
cat > "$BAD_DIR/latest-mac.yml" <<'EOF'
version: 0.1.48
path: Forge-App-0.1.49.dmg
sha512: smoke
EOF

if bash scripts/audit-release-manifests.sh "$BAD_DIR" "mac" "arm64" "0.1.49" >/dev/null 2>&1; then
  echo "Expected release manifest audit to fail on version mismatch"
  exit 1
fi

echo "Release manifest audit smoke test passed."
