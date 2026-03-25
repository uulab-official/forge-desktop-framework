#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

ROOT_VERSION=$(node -p "require('./package.json').version")
MISMATCH=0

echo "Checking workspace package versions against root: $ROOT_VERSION"

for pkg_json in packages/*/package.json apps/*/package.json examples/*/package.json; do
  if [ ! -f "$pkg_json" ]; then
    continue
  fi

  VERSION=$(node -p "require('./$pkg_json').version")
  if [ "$VERSION" != "$ROOT_VERSION" ]; then
    echo "Version mismatch: $pkg_json -> $VERSION"
    MISMATCH=1
  fi
done

PYPROJECT_VERSION=$(node -e "
const fs = require('fs');
const raw = fs.readFileSync('packages/worker-runtime/pyproject.toml', 'utf8');
const match = raw.match(/version = \"([^\"]+)\"/);
if (!match) process.exit(1);
console.log(match[1]);
")

SETUP_VERSION=$(node -e "
const fs = require('fs');
const raw = fs.readFileSync('packages/worker-runtime/setup.py', 'utf8');
const match = raw.match(/version=\"([^\"]+)\"/);
if (!match) process.exit(1);
console.log(match[1]);
")

if [ "$PYPROJECT_VERSION" != "$ROOT_VERSION" ]; then
  echo "Version mismatch: packages/worker-runtime/pyproject.toml -> $PYPROJECT_VERSION"
  MISMATCH=1
fi

if [ "$SETUP_VERSION" != "$ROOT_VERSION" ]; then
  echo "Version mismatch: packages/worker-runtime/setup.py -> $SETUP_VERSION"
  MISMATCH=1
fi

if [ "$MISMATCH" -ne 0 ]; then
  echo ""
  echo "Workspace version check failed."
  exit 1
fi

echo "All workspace package versions are aligned."
