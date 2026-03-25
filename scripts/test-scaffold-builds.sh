#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

MINIMAL_APP="examples/__scaffold_test_minimal__$$"
LAUNCH_READY_APP="examples/__scaffold_test_launch_ready__$$"
LOCKFILE_BACKUP="$(mktemp)"

cp pnpm-lock.yaml "$LOCKFILE_BACKUP"

cleanup() {
  node -e "
    const fs = require('fs');
    for (const target of process.argv.slice(1)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  " "$MINIMAL_APP" "$LAUNCH_READY_APP"
  cp "$LOCKFILE_BACKUP" pnpm-lock.yaml
  rm -f "$LOCKFILE_BACKUP"
}

trap cleanup EXIT

echo "==> Building Forge packages required for scaffold verification"
pnpm build --filter='./packages/*'

echo "==> Building create-forge-desktop"
pnpm --filter create-forge-desktop build

echo "==> Scaffolding minimal smoke app"
node packages/create-forge-app/dist/index.js create "$MINIMAL_APP" --template minimal --yes --package-manager pnpm >/dev/null

echo "==> Installing minimal smoke app with workspace links"
pnpm install --dir "$MINIMAL_APP" --link-workspace-packages >/dev/null

echo "==> Verifying minimal smoke app"
pnpm --dir "$MINIMAL_APP" release:check
pnpm --dir "$MINIMAL_APP" setup:python
pnpm --dir "$MINIMAL_APP" build:worker
pnpm --dir "$MINIMAL_APP" typecheck
pnpm --dir "$MINIMAL_APP" build

if [ ! -f "$MINIMAL_APP/worker/dist/forge-worker" ] && [ ! -f "$MINIMAL_APP/worker/dist/forge-worker.exe" ]; then
  echo "Minimal smoke app worker binary was not produced."
  exit 1
fi

echo "==> Scaffolding launch-ready smoke app"
node packages/create-forge-app/dist/index.js create "$LAUNCH_READY_APP" --template minimal --preset launch-ready --yes --package-manager pnpm >/dev/null

echo "==> Installing launch-ready smoke app with workspace links"
pnpm install --dir "$LAUNCH_READY_APP" --link-workspace-packages >/dev/null

echo "==> Verifying launch-ready smoke app"
pnpm --dir "$LAUNCH_READY_APP" release:check
pnpm --dir "$LAUNCH_READY_APP" typecheck
pnpm --dir "$LAUNCH_READY_APP" build

echo "Scaffold build verification passed."
