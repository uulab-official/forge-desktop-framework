#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

echo "Building packages..."
pnpm build --filter='./packages/*'

echo "Starting development server..."
pnpm --filter @forge/app dev
