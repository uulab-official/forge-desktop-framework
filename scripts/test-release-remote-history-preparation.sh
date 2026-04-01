#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-remote-history.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

create_release_dir() {
  local release_dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"
  local mode="$6"

  mkdir -p "$release_dir"

  cat > "$release_dir/artifact-summary.md" <<'EOF'
# Artifact Summary
EOF
  cat > "$release_dir/artifact-summary.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "version": "$version",
  "artifacts": [
    {
      "file": "$installer",
      "kind": "installer",
      "path": "$installer"
    }
  ]
}
EOF
  cat > "$release_dir/manifest-audit.md" <<'EOF'
# Manifest Audit
EOF
  cat > "$release_dir/manifest-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "expectedVersion": "$version",
  "status": "passed",
  "manifests": [
    {
      "file": "latest-${platform}.yml",
      "path": "$installer"
    }
  ]
}
EOF
  cat > "$release_dir/publish-audit.md" <<'EOF'
# Publish Audit
EOF
  cat > "$release_dir/publish-audit.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "status": "passed"
}
EOF
  cat > "$release_dir/rollback-readiness.md" <<'EOF'
# Rollback Readiness
EOF
  cat > "$release_dir/rollback-readiness.json" <<EOF
{
  "platform": "$platform",
  "arch": "$arch",
  "version": "$version",
  "status": "passed",
  "requiredArtifacts": [
    "$installer",
    "latest-${platform}.yml"
  ]
}
EOF
  cat > "$release_dir/latest-${platform}.yml" <<EOF
version: $version
path: $installer
sha512: ${platform}${version}
files:
  - url: $installer
    sha512: ${platform}${version}
    size: 100
EOF
  touch "$release_dir/$installer"

  if [[ "$mode" == "dual-channel" ]]; then
    cat > "$release_dir/channel-parity.md" <<'EOF'
# Channel Parity
EOF
    cat > "$release_dir/channel-parity.json" <<'EOF'
{
  "status": "passed"
}
EOF
  fi

  bash scripts/generate-rollback-playbook.sh "$release_dir" "$platform" "$arch" "$version"
  bash scripts/audit-release-channel-recovery.sh "$release_dir" "$platform" "$arch" "$version" "$mode"
}

setup_github_fixtures() {
  local fixture_root="$1"

  mkdir -p "$fixture_root/v0.1.64" "$fixture_root/v0.1.63" "$fixture_root/v0.1.62"

  create_release_dir "$WORK_DIR/github-current" "mac" "arm64" "0.1.64" "Forge-Desktop-0.1.64-arm64.dmg" "dual-channel"
  create_release_dir "$WORK_DIR/github-prev" "mac" "arm64" "0.1.63" "Forge-Desktop-0.1.63-arm64.dmg" "dual-channel"
  create_release_dir "$WORK_DIR/github-older" "mac" "arm64" "0.1.62" "Forge-Desktop-0.1.62-arm64.dmg" "github-only"

  bash scripts/bundle-release-inventory.sh "$WORK_DIR/github-current" "$fixture_root/v0.1.64/release-inventory-mac-arm64" "mac" "arm64" "0.1.64"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/github-prev" "$fixture_root/v0.1.63/release-inventory-mac-arm64" "mac" "arm64" "0.1.63"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/github-older" "$fixture_root/v0.1.62/release-inventory-mac-arm64" "mac" "arm64" "0.1.62"

  for version in 0.1.64 0.1.63 0.1.62; do
    tag="v$version"
    bash scripts/generate-release-bundle-index.sh "$fixture_root/$tag" "$fixture_root/$tag"
    cat > "$fixture_root/$tag/release-matrix-summary.json" <<EOF
{
  "version": "$version",
  "targets": [
    {
      "platform": "mac",
      "arch": "arm64",
      "artifactDir": "release-inventory-mac-arm64"
    }
  ]
}
EOF
    cat > "$fixture_root/$tag/release-provenance.json" <<EOF
{
  "tag": "$tag",
  "commitSha": "deadbeef${version//./}",
  "version": "$version"
}
EOF
  done
}

setup_s3_fixtures() {
  local fixture_root="$1"

  mkdir -p "$fixture_root/forge-release-cache/release-bundles/v0.1.64"
  mkdir -p "$fixture_root/forge-release-cache/release-bundles/v0.1.63"
  mkdir -p "$fixture_root/forge-release-cache/release-bundles/v0.1.62"

  create_release_dir "$WORK_DIR/s3-current" "mac-s3" "arm64" "0.1.64" "Forge-Desktop-0.1.64-arm64.dmg" "dual-channel"
  create_release_dir "$WORK_DIR/s3-prev" "mac-s3" "arm64" "0.1.63" "Forge-Desktop-0.1.63-arm64.dmg" "dual-channel"
  create_release_dir "$WORK_DIR/s3-older" "mac-s3" "arm64" "0.1.62" "Forge-Desktop-0.1.62-arm64.dmg" "github-only"

  bash scripts/bundle-release-inventory.sh "$WORK_DIR/s3-current" "$fixture_root/forge-release-cache/release-bundles/v0.1.64" "mac-s3" "arm64" "0.1.64"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/s3-prev" "$fixture_root/forge-release-cache/release-bundles/v0.1.63" "mac-s3" "arm64" "0.1.63"
  bash scripts/bundle-release-inventory.sh "$WORK_DIR/s3-older" "$fixture_root/forge-release-cache/release-bundles/v0.1.62" "mac-s3" "arm64" "0.1.62"

  for version in 0.1.64 0.1.63 0.1.62; do
    cat > "$fixture_root/forge-release-cache/release-bundles/v0.1.63/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.63",
  "targets": [
    {
      "platform": "mac-s3",
      "arch": "arm64",
      "artifactDir": "mac-s3-arm64-v0.1.63"
    }
  ]
}
EOF
    cat > "$fixture_root/forge-release-cache/release-bundles/v0.1.64/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.64",
  "targets": [
    {
      "platform": "mac-s3",
      "arch": "arm64",
      "artifactDir": "mac-s3-arm64-v0.1.64"
    }
  ]
}
EOF
    cat > "$fixture_root/forge-release-cache/release-bundles/v0.1.62/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.62",
  "targets": [
    {
      "platform": "mac-s3",
      "arch": "arm64",
      "artifactDir": "mac-s3-arm64-v0.1.62"
    }
  ]
}
EOF
  done
}

setup_github_fixtures "$WORK_DIR/fake-gh-artifacts"
setup_s3_fixtures "$WORK_DIR/fake-s3-artifacts"

mkdir -p "$WORK_DIR/bin"
cat > "$WORK_DIR/bin/gh" <<'EOF'
#!/bin/bash
set -euo pipefail

if [[ "$1" == "api" ]]; then
  case "$2" in
    repos/uulab-official/forge-desktop-framework/releases\?per_page=3)
      cat <<'JSON'
[
  { "tag_name": "v0.1.64", "draft": false, "prerelease": false },
  { "tag_name": "v0.1.63", "draft": false, "prerelease": false },
  { "tag_name": "v0.1.62", "draft": false, "prerelease": false }
]
JSON
      ;;
    repos/uulab-official/forge-desktop-framework/commits/v0.1.64)
      printf '{"sha":"deadbeef0164"}\n'
      ;;
    repos/uulab-official/forge-desktop-framework/commits/v0.1.63)
      printf '{"sha":"deadbeef0163"}\n'
      ;;
    repos/uulab-official/forge-desktop-framework/commits/v0.1.62)
      printf '{"sha":"deadbeef0162"}\n'
      ;;
    repos/uulab-official/forge-desktop-framework/actions/workflows/release.yml/runs\?event=push\&status=completed\&per_page=100)
      cat <<'JSON'
{
  "workflow_runs": [
    {
      "id": 777064,
      "head_sha": "deadbeef0164",
      "head_branch": "v0.1.64",
      "display_title": "v0.1.64",
      "conclusion": "success",
      "created_at": "2026-04-01T10:00:00Z",
      "run_attempt": 1
    },
    {
      "id": 777063,
      "head_sha": "deadbeef0163",
      "head_branch": "v0.1.63",
      "display_title": "v0.1.63",
      "conclusion": "success",
      "created_at": "2026-04-01T09:00:00Z",
      "run_attempt": 1
    },
    {
      "id": 777062,
      "head_sha": "deadbeef0162",
      "head_branch": "v0.1.62",
      "display_title": "v0.1.62",
      "conclusion": "success",
      "created_at": "2026-04-01T08:00:00Z",
      "run_attempt": 1
    }
  ]
}
JSON
      ;;
    *)
      echo "unexpected gh api path: $2" >&2
      exit 1
      ;;
  esac
  exit 0
fi

if [[ "$1" == "run" && "$2" == "download" ]]; then
  RUN_ID="$3"
  shift 3
  DEST_DIR=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo)
        shift 2
        ;;
      --dir|-D)
        DEST_DIR="$2"
        shift 2
        ;;
      *)
        echo "unexpected gh run download args: $*" >&2
        exit 1
        ;;
    esac
  done

  [[ -n "$DEST_DIR" ]] || { echo "missing --dir" >&2; exit 1; }
  mkdir -p "$DEST_DIR"

  case "$RUN_ID" in
    777064) cp -R "$FORGE_FAKE_GH_FIXTURE_ROOT/v0.1.64"/. "$DEST_DIR"/ ;;
    777063) cp -R "$FORGE_FAKE_GH_FIXTURE_ROOT/v0.1.63"/. "$DEST_DIR"/ ;;
    777062) cp -R "$FORGE_FAKE_GH_FIXTURE_ROOT/v0.1.62"/. "$DEST_DIR"/ ;;
    *) echo "unexpected run id: $RUN_ID" >&2; exit 1 ;;
  esac
  exit 0
fi

echo "unexpected gh invocation: $*" >&2
exit 1
EOF
chmod +x "$WORK_DIR/bin/gh"

cat > "$WORK_DIR/bin/aws" <<'EOF'
#!/bin/bash
set -euo pipefail

if [[ "$1" == "s3" && "$2" == "ls" ]]; then
  cat <<'OUT'
                           PRE v0.1.64/
                           PRE v0.1.63/
                           PRE v0.1.62/
OUT
  exit 0
fi

if [[ "$1" == "s3" && "$2" == "sync" ]]; then
  SOURCE="$3"
  DEST="$4"
  STRIPPED="${SOURCE#s3://}"
  BUCKET="${STRIPPED%%/*}"
  KEY="${STRIPPED#*/}"
  mkdir -p "$DEST"
  cp -R "$FORGE_FAKE_S3_ROOT/$BUCKET/$KEY"/. "$DEST"/
  exit 0
fi

echo "unexpected aws invocation: $*" >&2
exit 1
EOF
chmod +x "$WORK_DIR/bin/aws"

PATH="$WORK_DIR/bin:$PATH" \
FORGE_FAKE_GH_FIXTURE_ROOT="$WORK_DIR/fake-gh-artifacts" \
  bash scripts/prepare-release-rollback-from-github-history.sh \
    "uulab-official/forge-desktop-framework" \
    "mac" \
    "arm64" \
    "0.1.64" \
    "dual-channel" \
    "3" \
    "$WORK_DIR/github-history" \
    "$WORK_DIR/github-prepared"

[[ -f "$WORK_DIR/github-history/release-history-index.json" ]]
[[ -f "$WORK_DIR/github-history/history-fetch-summary.json" ]]
[[ -f "$WORK_DIR/github-prepared/prepared-rollback-target.json" ]]

node - "$WORK_DIR/github-prepared/prepared-rollback-target.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.selection.selected.version !== '0.1.63') {
  throw new Error(`Expected GitHub history prepared rollback 0.1.63, found ${payload.selection.selected.version}`);
}
NODE

PATH="$WORK_DIR/bin:$PATH" \
FORGE_FAKE_S3_ROOT="$WORK_DIR/fake-s3-artifacts" \
S3_ENDPOINT="https://example.r2.invalid" \
  bash scripts/prepare-release-rollback-from-s3-history.sh \
    "forge-release-cache" \
    "mac" \
    "arm64" \
    "0.1.64" \
    "dual-channel" \
    "s3" \
    "3" \
    "$WORK_DIR/s3-history" \
    "$WORK_DIR/s3-prepared"

[[ -f "$WORK_DIR/s3-history/release-history-index.json" ]]
[[ -f "$WORK_DIR/s3-history/history-fetch-summary.json" ]]
[[ -f "$WORK_DIR/s3-prepared/prepared-rollback-target.json" ]]

node - "$WORK_DIR/s3-prepared/prepared-rollback-target.json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.selection.selected.version !== '0.1.63') {
  throw new Error(`Expected S3 history prepared rollback 0.1.63, found ${payload.selection.selected.version}`);
}
NODE

echo "Remote release history preparation smoke test passed."
