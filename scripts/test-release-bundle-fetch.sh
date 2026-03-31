#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-bundle-fetch.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

create_release_dir() {
  local release_dir="$1"
  local platform="$2"
  local arch="$3"
  local version="$4"
  local installer="$5"

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

  bash scripts/generate-rollback-playbook.sh "$release_dir" "$platform" "$arch" "$version"
  bash scripts/audit-release-channel-recovery.sh "$release_dir" "$platform" "$arch" "$version" github-only
}

FIXTURE_RELEASE="$WORK_DIR/release"
FIXTURE_ARTIFACTS="$WORK_DIR/fake-gh-artifacts"
FETCH_OUTPUT="$WORK_DIR/retrieved/mac-arm64-v0.1.60"
DOWNLOAD_ROOT="$WORK_DIR/downloaded-artifacts"

create_release_dir "$FIXTURE_RELEASE" "mac" "arm64" "0.1.60" "Forge-Desktop-0.1.60-arm64.dmg"
mkdir -p "$FIXTURE_ARTIFACTS"
bash scripts/bundle-release-inventory.sh "$FIXTURE_RELEASE" "$FIXTURE_ARTIFACTS/release-inventory-mac-arm64" "mac" "arm64" "0.1.60"
bash scripts/generate-release-bundle-index.sh "$FIXTURE_ARTIFACTS" "$FIXTURE_ARTIFACTS/release-matrix-summary"

cat > "$FIXTURE_ARTIFACTS/release-matrix-summary/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.60",
  "targets": [
    {
      "platform": "mac",
      "arch": "arm64",
      "artifactDir": "release-inventory-mac-arm64"
    }
  ]
}
EOF

cat > "$FIXTURE_ARTIFACTS/release-matrix-summary/release-provenance.json" <<'EOF'
{
  "tag": "v0.1.60",
  "commitSha": "deadbeef0160",
  "version": "0.1.60"
}
EOF

mkdir -p "$WORK_DIR/bin"
cat > "$WORK_DIR/bin/gh" <<'EOF'
#!/bin/bash
set -euo pipefail

if [[ "$1" == "api" ]]; then
  case "$2" in
    repos/uulab-official/forge-desktop-framework/commits/v0.1.60)
      printf '{"sha":"deadbeef0160"}\n'
      ;;
    repos/uulab-official/forge-desktop-framework/actions/workflows/release.yml/runs\?event=push\&status=completed\&per_page=100)
      cat <<'JSON'
{
  "workflow_runs": [
    {
      "id": 777001,
      "head_sha": "deadbeef0160",
      "head_branch": "v0.1.60",
      "display_title": "v0.1.60",
      "conclusion": "success",
      "created_at": "2026-03-31T10:00:00Z",
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

  if [[ "$RUN_ID" != "777001" ]]; then
    echo "unexpected run id: $RUN_ID" >&2
    exit 1
  fi

  if [[ -z "$DEST_DIR" ]]; then
    echo "missing --dir for gh run download" >&2
    exit 1
  fi

  mkdir -p "$DEST_DIR"
  cp -R "$FORGE_FAKE_GH_FIXTURE_ROOT"/. "$DEST_DIR"/
  exit 0
fi

echo "unexpected gh invocation: $*" >&2
exit 1
EOF
chmod +x "$WORK_DIR/bin/gh"

PATH="$WORK_DIR/bin:$PATH" \
FORGE_FAKE_GH_FIXTURE_ROOT="$FIXTURE_ARTIFACTS" \
  bash scripts/fetch-release-inventory-bundle-from-github.sh \
    "uulab-official/forge-desktop-framework" \
    "v0.1.60" \
    "mac" \
    "arm64" \
    "$FETCH_OUTPUT" \
    "$DOWNLOAD_ROOT"

[[ -f "$FETCH_OUTPUT/retrieval-summary.json" ]]
[[ -f "$FETCH_OUTPUT/fetch-summary.json" ]]
[[ -f "$FETCH_OUTPUT/files/rollback-playbook.json" ]]
[[ -f "$DOWNLOAD_ROOT/release-bundle-index.json" ]]
[[ -f "$DOWNLOAD_ROOT/release-matrix-summary.json" ]]

if PATH="$WORK_DIR/bin:$PATH" FORGE_FAKE_GH_FIXTURE_ROOT="$FIXTURE_ARTIFACTS" \
  bash scripts/fetch-release-inventory-bundle-from-github.sh \
    "uulab-official/forge-desktop-framework" \
    "v9.9.9" \
    "mac" \
    "arm64" \
    "$WORK_DIR/should-fail" \
    "$WORK_DIR/should-fail-download" >/dev/null 2>&1; then
  echo "Expected GitHub bundle fetch to fail for an unknown tag"
  exit 1
fi

echo "Release bundle fetch smoke test passed."
