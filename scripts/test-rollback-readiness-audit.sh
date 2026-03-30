#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-rollback-audit.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

run_case() {
  local platform="$1"
  local arch="$2"
  local version="$3"
  local installer="$4"
  local manifest="$5"
  local case_dir="$WORK_DIR/${platform}-${arch}/release"
  mkdir -p "$case_dir"

  cat > "$case_dir/artifact-summary.json" <<EOF
{
  "version": "$version",
  "platform": "$platform",
  "arch": "$arch",
  "totals": {
    "files": 2,
    "installers": 1,
    "manifests": 1
  },
  "artifacts": [
    { "file": "$installer", "size": "42 MB", "kind": "installer" },
    { "file": "$manifest", "size": "1 KB", "kind": "manifest" }
  ]
}
EOF

  cat > "$case_dir/publish-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "checks": {
    "hasExpectedInstaller": true,
    "hasManifest": true
  }
}
EOF

  cat > "$case_dir/manifest-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "manifests": [
    {
      "file": "$manifest",
      "version": "$version",
      "path": "$installer",
      "sha512Present": true,
      "versionMatches": true,
      "pathExists": true
    }
  ],
  "checks": {
    "allVersionsMatch": true,
    "allPathsExist": true,
    "allShaPresent": true
  }
}
EOF

  bash scripts/audit-rollback-readiness.sh "$case_dir" "$platform" "$arch" "$version"
  [[ -f "$case_dir/rollback-readiness.md" ]]
  [[ -f "$case_dir/rollback-readiness.json" ]]
}

run_case "mac" "arm64" "0.1.50" "Forge-App-0.1.50.dmg" "latest-mac.yml"
run_case "win" "x64" "0.1.50" "Forge-App-Setup-0.1.50.exe" "latest.yml"
run_case "linux" "x64" "0.1.50" "Forge-App-0.1.50.AppImage" "latest-linux.yml"

BAD_DIR="$WORK_DIR/bad/release"
mkdir -p "$BAD_DIR"
cat > "$BAD_DIR/artifact-summary.json" <<'EOF'
{
  "version": "0.1.50",
  "platform": "mac",
  "arch": "arm64",
  "totals": {
    "files": 2,
    "installers": 1,
    "manifests": 1
  },
  "artifacts": [
    { "file": "Forge-App.dmg", "size": "42 MB", "kind": "installer" },
    { "file": "latest-mac.yml", "size": "1 KB", "kind": "manifest" }
  ]
}
EOF
cat > "$BAD_DIR/publish-audit.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "checks": {
    "hasExpectedInstaller": true,
    "hasManifest": true
  }
}
EOF
cat > "$BAD_DIR/manifest-audit.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "expectedVersion": "0.1.50",
  "manifests": [
    {
      "file": "latest-mac.yml",
      "version": "0.1.50",
      "path": "Forge-App.dmg",
      "sha512Present": true,
      "versionMatches": true,
      "pathExists": true
    }
  ],
  "checks": {
    "allVersionsMatch": true,
    "allPathsExist": true,
    "allShaPresent": true
  }
}
EOF

if bash scripts/audit-rollback-readiness.sh "$BAD_DIR" "mac" "arm64" "0.1.50" >/dev/null 2>&1; then
  echo "Expected rollback readiness audit to fail for non-versioned installer names"
  exit 1
fi

echo "Rollback readiness audit smoke test passed."
