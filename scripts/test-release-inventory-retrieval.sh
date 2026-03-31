#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-retrieval.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

ARCHIVED_RELEASE="$WORK_DIR/archived-release"
CURRENT_RELEASE="$WORK_DIR/current-release"
ARCHIVE_ROOT="$WORK_DIR/archive-root"
RETRIEVED_BUNDLE="$WORK_DIR/retrieved/mac-arm64-v0.1.58"

mkdir -p "$ARCHIVED_RELEASE" "$CURRENT_RELEASE" "$ARCHIVE_ROOT"

cat > "$ARCHIVED_RELEASE/artifact-summary.md" <<'EOF'
# Artifact Summary
EOF

cat > "$ARCHIVED_RELEASE/artifact-summary.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "version": "0.1.58",
  "artifacts": [
    {
      "file": "Forge-Desktop-0.1.58-arm64.dmg",
      "kind": "installer",
      "path": "Forge-Desktop-0.1.58-arm64.dmg"
    }
  ]
}
EOF

cat > "$ARCHIVED_RELEASE/manifest-audit.md" <<'EOF'
# Manifest Audit
EOF

cat > "$ARCHIVED_RELEASE/manifest-audit.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "expectedVersion": "0.1.58",
  "status": "passed",
  "manifests": [
    {
      "file": "latest-mac.yml",
      "path": "Forge-Desktop-0.1.58-arm64.dmg"
    }
  ]
}
EOF

cat > "$ARCHIVED_RELEASE/publish-audit.md" <<'EOF'
# Publish Audit
EOF

cat > "$ARCHIVED_RELEASE/publish-audit.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "status": "passed"
}
EOF

cat > "$ARCHIVED_RELEASE/rollback-readiness.md" <<'EOF'
# Rollback Readiness
EOF

cat > "$ARCHIVED_RELEASE/rollback-readiness.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "version": "0.1.58",
  "status": "passed",
  "requiredArtifacts": [
    "Forge-Desktop-0.1.58-arm64.dmg",
    "latest-mac.yml"
  ]
}
EOF

cat > "$ARCHIVED_RELEASE/latest-mac.yml" <<'EOF'
version: 0.1.58
path: Forge-Desktop-0.1.58-arm64.dmg
sha512: archivedsha
files:
  - url: Forge-Desktop-0.1.58-arm64.dmg
    sha512: archivedsha
    size: 111
EOF

touch "$ARCHIVED_RELEASE/Forge-Desktop-0.1.58-arm64.dmg"

bash scripts/generate-rollback-playbook.sh "$ARCHIVED_RELEASE" "mac" "arm64" "0.1.58"
bash scripts/audit-release-channel-recovery.sh "$ARCHIVED_RELEASE" "mac" "arm64" "0.1.58" github-only
bash scripts/bundle-release-inventory.sh "$ARCHIVED_RELEASE" "$ARCHIVE_ROOT/release-inventory-mac-arm64" "mac" "arm64" "0.1.58"

cat > "$CURRENT_RELEASE/artifact-summary.md" <<'EOF'
# Artifact Summary
EOF

cat > "$CURRENT_RELEASE/artifact-summary.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "version": "0.1.59",
  "artifacts": [
    {
      "file": "Forge-Desktop-0.1.59-arm64.dmg",
      "kind": "installer",
      "path": "Forge-Desktop-0.1.59-arm64.dmg"
    }
  ]
}
EOF

cat > "$CURRENT_RELEASE/manifest-audit.md" <<'EOF'
# Manifest Audit
EOF

cat > "$CURRENT_RELEASE/manifest-audit.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "expectedVersion": "0.1.59",
  "status": "passed",
  "manifests": [
    {
      "file": "latest-mac.yml",
      "path": "Forge-Desktop-0.1.59-arm64.dmg"
    }
  ]
}
EOF

cat > "$CURRENT_RELEASE/publish-audit.md" <<'EOF'
# Publish Audit
EOF

cat > "$CURRENT_RELEASE/publish-audit.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "status": "passed"
}
EOF

cat > "$CURRENT_RELEASE/rollback-readiness.md" <<'EOF'
# Rollback Readiness
EOF

cat > "$CURRENT_RELEASE/rollback-readiness.json" <<'EOF'
{
  "platform": "mac",
  "arch": "arm64",
  "version": "0.1.59",
  "status": "passed",
  "requiredArtifacts": [
    "Forge-Desktop-0.1.59-arm64.dmg",
    "latest-mac.yml"
  ]
}
EOF

cat > "$CURRENT_RELEASE/latest-mac.yml" <<'EOF'
version: 0.1.59
path: Forge-Desktop-0.1.59-arm64.dmg
sha512: currentsha
files:
  - url: Forge-Desktop-0.1.59-arm64.dmg
    sha512: currentsha
    size: 222
EOF

touch "$CURRENT_RELEASE/Forge-Desktop-0.1.59-arm64.dmg"

bash scripts/generate-rollback-playbook.sh "$CURRENT_RELEASE" "mac" "arm64" "0.1.59"
bash scripts/audit-release-channel-recovery.sh "$CURRENT_RELEASE" "mac" "arm64" "0.1.59" github-only

bash scripts/retrieve-release-inventory-bundle.sh "$ARCHIVE_ROOT" "mac" "arm64" "0.1.58" "$RETRIEVED_BUNDLE"

[[ -f "$RETRIEVED_BUNDLE/retrieval-summary.json" ]]
[[ -f "$RETRIEVED_BUNDLE/files/rollback-playbook.json" ]]

bash scripts/run-rollback-drill.sh "$CURRENT_RELEASE" "$RETRIEVED_BUNDLE" "mac" "arm64" "0.1.59" "0.1.58" github-only

if bash scripts/retrieve-release-inventory-bundle.sh "$ARCHIVE_ROOT" "win" "x64" "0.1.58" "$WORK_DIR/missing" >/dev/null 2>&1; then
  echo "Expected retrieval to fail for a missing bundle target"
  exit 1
fi

echo "Release inventory retrieval smoke test passed."
