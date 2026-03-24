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

# Update all workspace packages
for pkg_json in packages/*/package.json app/package.json; do
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

echo ""
echo "Version bumped to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  git add -A"
echo "  git commit -m 'release: v$NEW_VERSION'"
echo "  git tag v$NEW_VERSION"
echo "  git push && git push --tags"
