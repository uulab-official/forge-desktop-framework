#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-bundle-s3-fetch.XXXXXX")"
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

FIXTURE_RELEASE="$WORK_DIR/release"
REMOTE_ROOT="$WORK_DIR/remote-bucket"
FETCH_OUTPUT="$WORK_DIR/retrieved/mac-s3-arm64-v0.1.61"
DOWNLOAD_ROOT="$WORK_DIR/downloaded-artifacts"

create_release_dir "$FIXTURE_RELEASE" "mac" "arm64" "0.1.61" "Forge-Desktop-0.1.61-arm64.dmg" "dual-channel"
mkdir -p "$REMOTE_ROOT/forge-release-cache/release-bundles/v0.1.61"
bash scripts/bundle-release-inventory.sh "$FIXTURE_RELEASE" "$REMOTE_ROOT/forge-release-cache/release-bundles/v0.1.61" "mac-s3" "arm64" "0.1.61"

cat > "$REMOTE_ROOT/forge-release-cache/release-bundles/v0.1.61/release-matrix-summary.json" <<'EOF'
{
  "version": "0.1.61",
  "targets": [
    {
      "platform": "mac-s3",
      "arch": "arm64",
      "artifactDir": "mac-s3-arm64-v0.1.61"
    }
  ]
}
EOF

mkdir -p "$WORK_DIR/bin"
cat > "$WORK_DIR/bin/aws" <<'EOF'
#!/bin/bash
set -euo pipefail

if [[ "$1" != "s3" || "$2" != "sync" ]]; then
  echo "unexpected aws invocation: $*" >&2
  exit 1
fi

SOURCE="$3"
DEST="$4"
shift 4

if [[ "$SOURCE" != s3://* ]]; then
  echo "unexpected sync source: $SOURCE" >&2
  exit 1
fi

STRIPPED="${SOURCE#s3://}"
BUCKET="${STRIPPED%%/*}"
KEY="${STRIPPED#*/}"

if [[ "$BUCKET" != "forge-release-cache" ]]; then
  echo "unexpected bucket: $BUCKET" >&2
  exit 1
fi

mkdir -p "$DEST"
cp -R "$FORGE_FAKE_S3_ROOT/$BUCKET/$KEY"/. "$DEST"/
EOF
chmod +x "$WORK_DIR/bin/aws"

PATH="$WORK_DIR/bin:$PATH" \
FORGE_FAKE_S3_ROOT="$REMOTE_ROOT" \
S3_ENDPOINT="https://example.r2.invalid" \
  bash scripts/fetch-release-inventory-bundle-from-s3.sh \
    "forge-release-cache" \
    "v0.1.61" \
    "mac" \
    "arm64" \
    "s3" \
    "$FETCH_OUTPUT" \
    "$DOWNLOAD_ROOT"

[[ -f "$FETCH_OUTPUT/retrieval-summary.json" ]]
[[ -f "$FETCH_OUTPUT/s3-fetch-summary.json" ]]
[[ -f "$FETCH_OUTPUT/files/channel-recovery.json" ]]
[[ -f "$DOWNLOAD_ROOT/release-bundle-index.json" ]]
[[ -f "$WORK_DIR/release-history-index.json" ]]

if PATH="$WORK_DIR/bin:$PATH" FORGE_FAKE_S3_ROOT="$REMOTE_ROOT" \
  bash scripts/fetch-release-inventory-bundle-from-s3.sh \
    "forge-release-cache" \
    "v9.9.9" \
    "mac" \
    "arm64" \
    "s3" \
    "$WORK_DIR/should-fail" \
    "$WORK_DIR/should-fail-download" >/dev/null 2>&1; then
  echo "Expected S3 bundle fetch to fail for an unknown tag"
  exit 1
fi

echo "S3 release bundle fetch smoke test passed."
