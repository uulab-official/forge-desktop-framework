#!/bin/bash
set -euo pipefail

BUMP_TYPE="${1:-patch}"

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Usage: bash scripts/create-release-checklist.sh [patch|minor|major]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

CURRENT_VERSION="$(node -p "require('./package.json').version")"
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac
NEXT_VERSION="$MAJOR.$MINOR.$PATCH"
CHECKLIST_DIR="docs/release-checklists"
CHECKLIST_PATH="$CHECKLIST_DIR/v$NEXT_VERSION.md"
CURRENT_DATE="$(date +%F)"

mkdir -p "$CHECKLIST_DIR"

if [[ -f "$CHECKLIST_PATH" ]]; then
  echo "Release checklist already exists: $CHECKLIST_PATH"
  exit 0
fi

cat > "$CHECKLIST_PATH" <<EOF
# Release Checklist: v$NEXT_VERSION

- Status: draft
- Date: $CURRENT_DATE
- Bump Type: $BUMP_TYPE

## Scope

- Summary:
- User-facing change:

## Public Surface

- Docs:
- Scripts and release flow:
- CLI or scaffold surface:

## Validation Plan

- [ ] \`pnpm --filter create-forge-desktop build\`
- [ ] Narrow feature-specific smoke tests
- [ ] \`pnpm release:ship $BUMP_TYPE\`
- [ ] \`pnpm version:check\`

## Release Notes

- Changelog entry drafted:
- Follow-up risks:
- Next target:
EOF

echo "Created release checklist: $CHECKLIST_PATH"
