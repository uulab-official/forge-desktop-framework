#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

REQUIRED_FILES=(
  "electron-builder.yml"
  "scripts/build-worker.sh"
  "scripts/build-app.sh"
  "worker/main.py"
  ".github/workflows/release.yml"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing required release file: $file"
    exit 1
  fi
done

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required for local packaging."
  exit 1
fi

PYTHON_BIN="${PYTHON:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python 3 is required. Set PYTHON if your binary is not python3."
  exit 1
fi

if ! grep -q "^appId:" electron-builder.yml; then
  echo "electron-builder.yml is missing appId."
  exit 1
fi

if ! grep -q "^productName:" electron-builder.yml; then
  echo "electron-builder.yml is missing productName."
  exit 1
fi

echo "Release preset looks healthy."
echo "Next:"
echo "  1. Fill in .env for local packaging or GitHub Secrets for CI releases."
echo "  2. Run pnpm setup:python"
echo "  3. Run pnpm build:app"
