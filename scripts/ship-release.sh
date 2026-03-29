#!/bin/bash
set -euo pipefail

BUMP_TYPE="${1:-patch}"
PUSH_CHANGES=true

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Usage: ./scripts/ship-release.sh [patch|minor|major] [--no-push]"
  exit 1
fi

if [[ "${2:-}" == "--no-push" ]]; then
  PUSH_CHANGES=false
elif [[ -n "${2:-}" ]]; then
  echo "Unknown option: ${2}"
  echo "Usage: ./scripts/ship-release.sh [patch|minor|major] [--no-push]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "ship-release must run from main. Current branch: $CURRENT_BRANCH"
  exit 1
fi

bash scripts/release.sh "$BUMP_TYPE"

NEW_VERSION="$(node -p "require('./package.json').version")"
TAG_NAME="v${NEW_VERSION}"

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Tag $TAG_NAME already exists."
  exit 1
fi

git add -A
git commit -m "release: $TAG_NAME"
git tag -a "$TAG_NAME" -m "release: $TAG_NAME"

if [[ "$PUSH_CHANGES" == "true" ]]; then
  git push origin main "$TAG_NAME"
fi

echo ""
echo "Released $TAG_NAME"
if [[ "$PUSH_CHANGES" == "true" ]]; then
  echo "Pushed main and $TAG_NAME to origin"
else
  echo "Created commit and tag locally only"
fi
