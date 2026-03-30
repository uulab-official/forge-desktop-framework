#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-rollback-playbook.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

create_release_fixture() {
  local case_dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"
  local manifest="$6"
  local readiness_status="${7:-passed}"

  mkdir -p "$case_dir"

  cat > "$case_dir/artifact-summary.json" <<EOF
{
  "version": "$version",
  "platform": "$platform",
  "arch": "$arch",
  "artifacts": [
    { "file": "$installer", "size": "42 MB", "kind": "installer" },
    { "file": "$manifest", "size": "1 KB", "kind": "manifest" }
  ]
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

  cat > "$case_dir/rollback-readiness.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "status": "$readiness_status"
}
EOF
}

GITHUB_DIR="$WORK_DIR/github/release"
create_release_fixture "$GITHUB_DIR" "mac" "arm64" "0.1.53" "Forge-App-0.1.53.dmg" "latest-mac.yml"
bash scripts/generate-rollback-playbook.sh "$GITHUB_DIR" "mac" "arm64" "0.1.53"
[[ -f "$GITHUB_DIR/rollback-playbook.md" ]]
[[ -f "$GITHUB_DIR/rollback-playbook.json" ]]
grep -q 'github-releases' "$GITHUB_DIR/rollback-playbook.md"

S3_DIR="$WORK_DIR/s3/release"
create_release_fixture "$S3_DIR" "win" "x64" "0.1.53" "Forge-App-Setup-0.1.53.exe" "latest.yml"
cat > "$S3_DIR/channel-parity.json" <<'EOF'
{
  "platform": "win",
  "arch": "x64",
  "expectedVersion": "0.1.53",
  "status": "passed"
}
EOF
bash scripts/generate-rollback-playbook.sh "$S3_DIR" "win" "x64" "0.1.53"
grep -q 's3-or-r2' "$S3_DIR/rollback-playbook.md"

BAD_DIR="$WORK_DIR/bad/release"
create_release_fixture "$BAD_DIR" "linux" "x64" "0.1.53" "Forge-App-0.1.53.AppImage" "latest-linux.yml" "failed"
if bash scripts/generate-rollback-playbook.sh "$BAD_DIR" "linux" "x64" "0.1.53" >/dev/null 2>&1; then
  echo "Expected rollback playbook generation to fail when rollback readiness has not passed"
  exit 1
fi

echo "Rollback playbook smoke test passed."
