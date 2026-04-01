#!/bin/bash
set -e

BUMP_TYPE="${1:-patch}"

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Usage: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

echo "Verifying versioned release checklist before release gates..."
bash scripts/verify-release-checklist.sh "$BUMP_TYPE"
echo ""

echo "Running scaffold build verification before version bump..."
bash scripts/test-scaffold-builds.sh
echo ""

echo "Running external scaffold verification before version bump..."
bash scripts/test-external-scaffold.sh
echo ""

echo "Running official preset release surface audit before version bump..."
bash scripts/audit-release-surfaces.sh
echo ""

echo "Running published artifact audit smoke test before version bump..."
bash scripts/test-release-artifact-audit.sh
echo ""

echo "Running release manifest audit smoke test before version bump..."
bash scripts/test-release-manifest-audit.sh
echo ""

echo "Running rollback readiness audit smoke test before version bump..."
bash scripts/test-rollback-readiness-audit.sh
echo ""

echo "Running rollback playbook smoke test before version bump..."
bash scripts/test-rollback-playbook.sh
echo ""

echo "Running publish channel parity smoke test before version bump..."
bash scripts/test-publish-channel-parity.sh
echo ""

echo "Running release channel recovery audit smoke test before version bump..."
bash scripts/test-release-channel-recovery.sh
echo ""

echo "Running rollback drill smoke test before version bump..."
bash scripts/test-rollback-drill.sh
echo ""

echo "Running release inventory bundle smoke test before version bump..."
bash scripts/test-release-inventory-bundle.sh
echo ""

echo "Running release bundle index smoke test before version bump..."
bash scripts/test-release-bundle-index.sh
echo ""

echo "Running release history index smoke test before version bump..."
bash scripts/test-release-history-index.sh
echo ""

echo "Running rollback target selection smoke test before version bump..."
bash scripts/test-release-rollback-target-selection.sh
echo ""

echo "Running rollback history preparation smoke test before version bump..."
bash scripts/test-release-rollback-history-preparation.sh
echo ""

echo "Running archived release inventory retrieval smoke test before version bump..."
bash scripts/test-release-inventory-retrieval.sh
echo ""

echo "Running archived release inventory GitHub fetch smoke test before version bump..."
bash scripts/test-release-bundle-fetch.sh
echo ""

echo "Running archived release inventory S3 fetch smoke test before version bump..."
bash scripts/test-release-bundle-fetch-from-s3.sh
echo ""

echo "Running signing readiness audit smoke test before version bump..."
bash scripts/test-signing-readiness-audit.sh
echo ""

echo "Running release matrix summary smoke test before version bump..."
bash scripts/test-release-matrix-summary.sh
echo ""

echo "Running release provenance smoke test before version bump..."
bash scripts/test-release-provenance.sh
echo ""

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New version: $NEW_VERSION"

# Update root package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

node -e "
const fs = require('fs');

const pyprojectPath = 'packages/worker-runtime/pyproject.toml';
const pyproject = fs.readFileSync(pyprojectPath, 'utf8').replace(
  /version = \"[^\"]+\"/,
  'version = \"$NEW_VERSION\"'
);
fs.writeFileSync(pyprojectPath, pyproject);

const setupPath = 'packages/worker-runtime/setup.py';
const setupPy = fs.readFileSync(setupPath, 'utf8').replace(
  /version=\"[^\"]+\"/,
  'version=\"$NEW_VERSION\"'
);
fs.writeFileSync(setupPath, setupPy);
"

# Update all workspace packages
for pkg_json in packages/*/package.json apps/*/package.json examples/*/package.json; do
  if [ -f "$pkg_json" ]; then
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$pkg_json', 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('$pkg_json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "Updated $pkg_json → $NEW_VERSION"
  fi
done

bash scripts/check-versions.sh

echo ""
echo "Version bumped to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  git add -A"
echo "  git commit -m 'release: v$NEW_VERSION'"
echo "  git tag v$NEW_VERSION"
echo "  git push && git push --tags"
