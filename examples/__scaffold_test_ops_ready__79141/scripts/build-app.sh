#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

echo "=== Step 1: Build Python worker ==="
bash scripts/build-worker.sh

echo "=== Step 2: Build Electron app ==="
pnpm build

echo "=== Step 3: Package desktop app ==="
pnpm package
