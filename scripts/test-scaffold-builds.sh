#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

MINIMAL_APP="examples/__scaffold_test_minimal__$$"
LAUNCH_READY_APP="examples/__scaffold_test_launch_ready__$$"
TRAY_APP="examples/__scaffold_test_tray__$$"
DEEP_LINK_APP="examples/__scaffold_test_deep_link__$$"
MENU_BAR_APP="examples/__scaffold_test_menu_bar__$$"
AUTO_LAUNCH_APP="examples/__scaffold_test_auto_launch__$$"
GLOBAL_SHORTCUT_APP="examples/__scaffold_test_global_shortcut__$$"
FILE_ASSOCIATION_APP="examples/__scaffold_test_file_association__$$"
FILE_DIALOGS_APP="examples/__scaffold_test_file_dialogs__$$"
RECENT_FILES_APP="examples/__scaffold_test_recent_files__$$"
CRASH_RECOVERY_APP="examples/__scaffold_test_crash_recovery__$$"
POWER_MONITOR_APP="examples/__scaffold_test_power_monitor__$$"
DOWNLOADS_APP="examples/__scaffold_test_downloads__$$"
LOCKFILE_BACKUP="$(mktemp)"

cp pnpm-lock.yaml "$LOCKFILE_BACKUP"

cleanup() {
  node -e "
    const fs = require('fs');
    for (const target of process.argv.slice(1)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  " "$MINIMAL_APP" "$LAUNCH_READY_APP" "$TRAY_APP" "$DEEP_LINK_APP" "$MENU_BAR_APP" "$AUTO_LAUNCH_APP" "$GLOBAL_SHORTCUT_APP" "$FILE_ASSOCIATION_APP" "$FILE_DIALOGS_APP" "$RECENT_FILES_APP" "$CRASH_RECOVERY_APP" "$POWER_MONITOR_APP" "$DOWNLOADS_APP"
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

echo "==> Scaffolding tray smoke app"
node packages/create-forge-app/dist/index.js create "$TRAY_APP" --template minimal --feature tray --yes --package-manager pnpm >/dev/null

echo "==> Installing tray smoke app with workspace links"
pnpm install --dir "$TRAY_APP" --link-workspace-packages >/dev/null

echo "==> Verifying tray smoke app"
pnpm --dir "$TRAY_APP" release:check
pnpm --dir "$TRAY_APP" typecheck
pnpm --dir "$TRAY_APP" build

echo "==> Scaffolding deep-link smoke app"
node packages/create-forge-app/dist/index.js create "$DEEP_LINK_APP" --template minimal --feature deep-link --yes --package-manager pnpm >/dev/null

echo "==> Installing deep-link smoke app with workspace links"
pnpm install --dir "$DEEP_LINK_APP" --link-workspace-packages >/dev/null

echo "==> Verifying deep-link smoke app"
pnpm --dir "$DEEP_LINK_APP" release:check
pnpm --dir "$DEEP_LINK_APP" typecheck
pnpm --dir "$DEEP_LINK_APP" build

echo "==> Scaffolding menu-bar smoke app"
node packages/create-forge-app/dist/index.js create "$MENU_BAR_APP" --template minimal --feature menu-bar --yes --package-manager pnpm >/dev/null

echo "==> Installing menu-bar smoke app with workspace links"
pnpm install --dir "$MENU_BAR_APP" --link-workspace-packages >/dev/null

echo "==> Verifying menu-bar smoke app"
pnpm --dir "$MENU_BAR_APP" release:check
pnpm --dir "$MENU_BAR_APP" typecheck
pnpm --dir "$MENU_BAR_APP" build

echo "==> Scaffolding auto-launch smoke app"
node packages/create-forge-app/dist/index.js create "$AUTO_LAUNCH_APP" --template minimal --feature auto-launch --yes --package-manager pnpm >/dev/null

echo "==> Installing auto-launch smoke app with workspace links"
pnpm install --dir "$AUTO_LAUNCH_APP" --link-workspace-packages >/dev/null

echo "==> Verifying auto-launch smoke app"
pnpm --dir "$AUTO_LAUNCH_APP" release:check
pnpm --dir "$AUTO_LAUNCH_APP" typecheck
pnpm --dir "$AUTO_LAUNCH_APP" build

echo "==> Scaffolding global-shortcut smoke app"
node packages/create-forge-app/dist/index.js create "$GLOBAL_SHORTCUT_APP" --template minimal --feature global-shortcut --yes --package-manager pnpm >/dev/null

echo "==> Installing global-shortcut smoke app with workspace links"
pnpm install --dir "$GLOBAL_SHORTCUT_APP" --link-workspace-packages >/dev/null

echo "==> Verifying global-shortcut smoke app"
pnpm --dir "$GLOBAL_SHORTCUT_APP" release:check
pnpm --dir "$GLOBAL_SHORTCUT_APP" typecheck
pnpm --dir "$GLOBAL_SHORTCUT_APP" build

echo "==> Scaffolding file-association smoke app"
node packages/create-forge-app/dist/index.js create "$FILE_ASSOCIATION_APP" --template minimal --feature file-association --yes --package-manager pnpm >/dev/null

echo "==> Installing file-association smoke app with workspace links"
pnpm install --dir "$FILE_ASSOCIATION_APP" --link-workspace-packages >/dev/null

echo "==> Verifying file-association smoke app"
pnpm --dir "$FILE_ASSOCIATION_APP" release:check
pnpm --dir "$FILE_ASSOCIATION_APP" typecheck
pnpm --dir "$FILE_ASSOCIATION_APP" build

echo "==> Scaffolding file-dialogs smoke app"
node packages/create-forge-app/dist/index.js create "$FILE_DIALOGS_APP" --template minimal --feature file-dialogs --yes --package-manager pnpm >/dev/null

echo "==> Installing file-dialogs smoke app with workspace links"
pnpm install --dir "$FILE_DIALOGS_APP" --link-workspace-packages >/dev/null

echo "==> Verifying file-dialogs smoke app"
pnpm --dir "$FILE_DIALOGS_APP" release:check
pnpm --dir "$FILE_DIALOGS_APP" typecheck
pnpm --dir "$FILE_DIALOGS_APP" build

echo "==> Scaffolding recent-files smoke app"
node packages/create-forge-app/dist/index.js create "$RECENT_FILES_APP" --template minimal --feature recent-files --feature file-association --feature file-dialogs --yes --package-manager pnpm >/dev/null

echo "==> Installing recent-files smoke app with workspace links"
pnpm install --dir "$RECENT_FILES_APP" --link-workspace-packages >/dev/null

echo "==> Verifying recent-files smoke app"
pnpm --dir "$RECENT_FILES_APP" release:check
pnpm --dir "$RECENT_FILES_APP" typecheck
pnpm --dir "$RECENT_FILES_APP" build

echo "==> Scaffolding crash-recovery smoke app"
node packages/create-forge-app/dist/index.js create "$CRASH_RECOVERY_APP" --template minimal --feature crash-recovery --yes --package-manager pnpm >/dev/null

echo "==> Installing crash-recovery smoke app with workspace links"
pnpm install --dir "$CRASH_RECOVERY_APP" --link-workspace-packages >/dev/null

echo "==> Verifying crash-recovery smoke app"
pnpm --dir "$CRASH_RECOVERY_APP" release:check
pnpm --dir "$CRASH_RECOVERY_APP" typecheck
pnpm --dir "$CRASH_RECOVERY_APP" build

echo "==> Scaffolding power-monitor smoke app"
node packages/create-forge-app/dist/index.js create "$POWER_MONITOR_APP" --template minimal --feature power-monitor --yes --package-manager pnpm >/dev/null

echo "==> Installing power-monitor smoke app with workspace links"
pnpm install --dir "$POWER_MONITOR_APP" --link-workspace-packages >/dev/null

echo "==> Verifying power-monitor smoke app"
pnpm --dir "$POWER_MONITOR_APP" release:check
pnpm --dir "$POWER_MONITOR_APP" typecheck
pnpm --dir "$POWER_MONITOR_APP" build

echo "==> Scaffolding downloads smoke app"
node packages/create-forge-app/dist/index.js create "$DOWNLOADS_APP" --template minimal --feature downloads --yes --package-manager pnpm >/dev/null

echo "==> Installing downloads smoke app with workspace links"
pnpm install --dir "$DOWNLOADS_APP" --link-workspace-packages >/dev/null

echo "==> Verifying downloads smoke app"
pnpm --dir "$DOWNLOADS_APP" release:check
pnpm --dir "$DOWNLOADS_APP" typecheck
pnpm --dir "$DOWNLOADS_APP" build

echo "Scaffold build verification passed."
