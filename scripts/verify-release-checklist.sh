#!/bin/bash
set -euo pipefail

BUMP_TYPE="${1:-patch}"

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Usage: bash scripts/verify-release-checklist.sh [patch|minor|major]"
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
CHECKLIST_PATH="docs/release-checklists/v$NEXT_VERSION.md"

if [[ ! -f "$CHECKLIST_PATH" ]]; then
  echo "Missing release checklist: $CHECKLIST_PATH"
  echo "Create it with: bash scripts/create-release-checklist.sh $BUMP_TYPE"
  exit 1
fi

for required in \
  "# Release Checklist: v$NEXT_VERSION" \
  "- Status: ready" \
  "## Scope" \
  "## Public Surface" \
  "## Validation Plan" \
  "## Release Notes"
do
  if ! grep -Fq -- "$required" "$CHECKLIST_PATH"; then
    echo "Release checklist is missing required content: $required"
    echo "Checklist: $CHECKLIST_PATH"
    exit 1
  fi
done

echo "Release checklist ready: $CHECKLIST_PATH"
