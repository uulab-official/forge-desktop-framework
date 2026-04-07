#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

MINIMAL_APP="examples/__scaffold_test_minimal__$$"
LAUNCH_READY_APP="examples/__scaffold_test_launch_ready__$$"
SUPPORT_READY_APP="examples/__scaffold_test_support_ready__$$"
OPS_READY_APP="examples/__scaffold_test_ops_ready__$$"
DOCUMENT_READY_APP="examples/__scaffold_test_document_ready__$$"
PRODUCTION_READY_APP="examples/__scaffold_test_production_ready__$$"
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
IDLE_PRESENCE_APP="examples/__scaffold_test_idle_presence__$$"
SESSION_STATE_APP="examples/__scaffold_test_session_state__$$"
DOWNLOADS_APP="examples/__scaffold_test_downloads__$$"
CLIPBOARD_APP="examples/__scaffold_test_clipboard__$$"
EXTERNAL_LINKS_APP="examples/__scaffold_test_external_links__$$"
SYSTEM_INFO_APP="examples/__scaffold_test_system_info__$$"
PERMISSIONS_APP="examples/__scaffold_test_permissions__$$"
NETWORK_STATUS_APP="examples/__scaffold_test_network_status__$$"
SECURE_STORAGE_APP="examples/__scaffold_test_secure_storage__$$"
SUPPORT_BUNDLE_APP="examples/__scaffold_test_support_bundle__$$"
LOG_ARCHIVE_APP="examples/__scaffold_test_log_archive__$$"
INCIDENT_REPORT_APP="examples/__scaffold_test_incident_report__$$"
DIAGNOSTICS_TIMELINE_APP="examples/__scaffold_test_diagnostics_timeline__$$"
LOCKFILE_BACKUP="$(mktemp)"

cp pnpm-lock.yaml "$LOCKFILE_BACKUP"

cleanup() {
  node -e "
    const fs = require('fs');
    for (const target of process.argv.slice(1)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  " "$MINIMAL_APP" "$LAUNCH_READY_APP" "$SUPPORT_READY_APP" "$OPS_READY_APP" "$DOCUMENT_READY_APP" "$PRODUCTION_READY_APP" "$TRAY_APP" "$DEEP_LINK_APP" "$MENU_BAR_APP" "$AUTO_LAUNCH_APP" "$GLOBAL_SHORTCUT_APP" "$FILE_ASSOCIATION_APP" "$FILE_DIALOGS_APP" "$RECENT_FILES_APP" "$CRASH_RECOVERY_APP" "$POWER_MONITOR_APP" "$IDLE_PRESENCE_APP" "$SESSION_STATE_APP" "$DOWNLOADS_APP" "$CLIPBOARD_APP" "$EXTERNAL_LINKS_APP" "$SYSTEM_INFO_APP" "$PERMISSIONS_APP" "$NETWORK_STATUS_APP" "$SECURE_STORAGE_APP" "$SUPPORT_BUNDLE_APP" "$LOG_ARCHIVE_APP" "$INCIDENT_REPORT_APP" "$DIAGNOSTICS_TIMELINE_APP"
  cp "$LOCKFILE_BACKUP" pnpm-lock.yaml
  rm -f "$LOCKFILE_BACKUP"
}

trap cleanup EXIT

seed_release_output() {
  local target_dir="$1"
  local version
  version=$(node -e "const path = require('node:path'); console.log(require(path.resolve(process.argv[1])).version)" "$target_dir/package.json")
  mkdir -p "$target_dir/release"
  touch "$target_dir/release/Forge-Test-$version.dmg"
  cat > "$target_dir/release/latest.yml" <<EOF
version: $version
path: Forge-Test-$version.dmg
sha512: smoke-sha512
releaseDate: '2026-03-29T00:00:00.000Z'
EOF
}

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
env GH_TOKEN=forge-smoke-token pnpm --dir "$MINIMAL_APP" publish:check:github
seed_release_output "$MINIMAL_APP"
pnpm --dir "$MINIMAL_APP" package:verify
pnpm --dir "$MINIMAL_APP" package:audit
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
env GH_TOKEN=forge-smoke-token pnpm --dir "$LAUNCH_READY_APP" publish:check:github
pnpm --dir "$LAUNCH_READY_APP" typecheck
pnpm --dir "$LAUNCH_READY_APP" build

echo "==> Scaffolding support-ready smoke app"
node packages/create-forge-app/dist/index.js create "$SUPPORT_READY_APP" --template minimal --preset support-ready --yes --package-manager pnpm >/dev/null

echo "==> Installing support-ready smoke app with workspace links"
pnpm install --dir "$SUPPORT_READY_APP" --link-workspace-packages >/dev/null

echo "==> Verifying support-ready smoke app"
pnpm --dir "$SUPPORT_READY_APP" release:check
pnpm --dir "$SUPPORT_READY_APP" typecheck
pnpm --dir "$SUPPORT_READY_APP" build

echo "==> Scaffolding ops-ready smoke app"
node packages/create-forge-app/dist/index.js create "$OPS_READY_APP" --template minimal --preset ops-ready --yes --package-manager pnpm >/dev/null

echo "==> Installing ops-ready smoke app with workspace links"
pnpm install --dir "$OPS_READY_APP" --link-workspace-packages >/dev/null

echo "==> Verifying ops-ready smoke app"
pnpm --dir "$OPS_READY_APP" release:check
pnpm --dir "$OPS_READY_APP" typecheck
pnpm --dir "$OPS_READY_APP" build

echo "==> Scaffolding document-ready smoke app"
node packages/create-forge-app/dist/index.js create "$DOCUMENT_READY_APP" --template minimal --preset document-ready --yes --package-manager pnpm >/dev/null

echo "==> Installing document-ready smoke app with workspace links"
pnpm install --dir "$DOCUMENT_READY_APP" --link-workspace-packages >/dev/null

echo "==> Verifying document-ready smoke app"
pnpm --dir "$DOCUMENT_READY_APP" release:check
env AWS_ACCESS_KEY_ID=forge-smoke-key AWS_SECRET_ACCESS_KEY=forge-smoke-secret S3_BUCKET=forge-smoke-bucket S3_ENDPOINT=https://example.com S3_UPDATE_URL=https://downloads.example.com/releases pnpm --dir "$DOCUMENT_READY_APP" publish:check:s3
seed_release_output "$DOCUMENT_READY_APP"
pnpm --dir "$DOCUMENT_READY_APP" package:verify:s3
pnpm --dir "$DOCUMENT_READY_APP" package:audit:s3
pnpm --dir "$DOCUMENT_READY_APP" typecheck
pnpm --dir "$DOCUMENT_READY_APP" build

echo "==> Scaffolding production-ready smoke app"
node packages/create-forge-app/dist/index.js create "$PRODUCTION_READY_APP" --template minimal --preset production-ready --yes --package-manager pnpm >/dev/null

echo "==> Installing production-ready smoke app with workspace links"
pnpm install --dir "$PRODUCTION_READY_APP" --link-workspace-packages >/dev/null

echo "==> Verifying production-ready smoke app"
pnpm --dir "$PRODUCTION_READY_APP" release:check
seed_release_output "$PRODUCTION_READY_APP"
env GH_TOKEN=forge-smoke-token AWS_ACCESS_KEY_ID=forge-smoke-key AWS_SECRET_ACCESS_KEY=forge-smoke-secret S3_BUCKET=forge-smoke-bucket S3_ENDPOINT=https://example.com S3_UPDATE_URL=https://downloads.example.com/releases pnpm --dir "$PRODUCTION_READY_APP" production:check:all -- --require-release-output
pnpm --dir "$PRODUCTION_READY_APP" ops:retention -- --keep 1
if ! find "$PRODUCTION_READY_APP/ops/snapshots" -name 'ops-snapshot.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops snapshot JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/evidence" -name 'ops-evidence-summary.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops evidence summary JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/index" -name 'ops-index.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops index JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/reports" -name 'ops-report.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops report JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/bundles" -name 'ops-bundle-summary.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops bundle summary JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/bundles" -name 'ops-bundle.tgz' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops bundle archive was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/doctors" -name 'ops-doctor.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops doctor JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/handoffs" -name 'ops-handoff.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops handoff JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/handoffs" -name 'ops-handoff.tgz' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops handoff archive was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/attestations" -name 'ops-attestation.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops attestation JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/attestations" -name 'ops-attestation.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops attestation Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/ready" -name 'ops-ready.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops ready JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/ready" -name 'ops-ready.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops ready Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/gates" -name 'ops-gate.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops gate JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/gates" -name 'ops-gate.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops gate Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/releasepacks" -name 'ops-releasepack.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops release pack JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/releasepacks" -name 'ops-releasepack.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops release pack Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/releasepacks" -name 'ops-releasepack.tgz' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops release pack archive was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/exports" -name 'ops-export.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops export JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/exports" -name 'ops-export.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops export Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/exports" -name 'ops-export.tgz' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops export archive was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/restores" -name 'ops-restore.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops restore JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/restores" -name 'ops-restore.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops restore Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/restores" -path '*/restored/payload/releasepack/ops-releasepack.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app restored release pack payload was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/recoveries" -name 'ops-recover.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops recover JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/recoveries" -name 'ops-recover.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops recover Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/recoveries" -path '*/proof/restore/ops-restore.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops recover proof did not capture the latest restore JSON."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/rollbacks" -name 'ops-rollback.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops rollback JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/rollbacks" -name 'ops-rollback.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops rollback Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/rollbacks" -path '*/proof/recover/ops-recover.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops rollback proof did not capture the latest recover JSON."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/incidents" -name 'ops-incident.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops incident JSON was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/incidents" -name 'ops-incident.md' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops incident Markdown was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/incidents" -name 'ops-incident.tgz' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops incident archive was not produced."
  exit 1
fi
if ! find "$PRODUCTION_READY_APP/ops/incidents" -path '*/packet/rollback/ops-rollback.json' -print -quit | grep -q .; then
  echo "Production-ready smoke app ops incident packet did not capture the latest rollback JSON."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops snapshot retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/evidence" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops evidence retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/index" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops index retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/reports" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops report retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/bundles" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops bundle retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/doctors" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops doctor retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/handoffs" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops handoff retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/attestations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops attestation retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/ready" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops ready retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/gates" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops gate retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/releasepacks" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops release pack retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/exports" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops export retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/restores" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops restore retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/recoveries" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops recover retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/rollbacks" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops rollback retention did not keep exactly one directory."
  exit 1
fi
if [ "$(find "$PRODUCTION_READY_APP/ops/incidents" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
  echo "Production-ready smoke app ops incident retention did not keep exactly one directory."
  exit 1
fi
if [ ! -f "$PRODUCTION_READY_APP/worker/dist/forge-worker" ] && [ ! -f "$PRODUCTION_READY_APP/worker/dist/forge-worker.exe" ]; then
  echo "Production-ready smoke app worker binary was not produced."
  exit 1
fi

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

echo "==> Scaffolding idle-presence smoke app"
node packages/create-forge-app/dist/index.js create "$IDLE_PRESENCE_APP" --template minimal --feature idle-presence --yes --package-manager pnpm >/dev/null

echo "==> Installing idle-presence smoke app with workspace links"
pnpm install --dir "$IDLE_PRESENCE_APP" --link-workspace-packages >/dev/null

echo "==> Verifying idle-presence smoke app"
pnpm --dir "$IDLE_PRESENCE_APP" release:check
pnpm --dir "$IDLE_PRESENCE_APP" typecheck
pnpm --dir "$IDLE_PRESENCE_APP" build

echo "==> Scaffolding session-state smoke app"
node packages/create-forge-app/dist/index.js create "$SESSION_STATE_APP" --template minimal --feature session-state --yes --package-manager pnpm >/dev/null

echo "==> Installing session-state smoke app with workspace links"
pnpm install --dir "$SESSION_STATE_APP" --link-workspace-packages >/dev/null

echo "==> Verifying session-state smoke app"
pnpm --dir "$SESSION_STATE_APP" release:check
pnpm --dir "$SESSION_STATE_APP" typecheck
pnpm --dir "$SESSION_STATE_APP" build

echo "==> Scaffolding downloads smoke app"
node packages/create-forge-app/dist/index.js create "$DOWNLOADS_APP" --template minimal --feature downloads --yes --package-manager pnpm >/dev/null

echo "==> Installing downloads smoke app with workspace links"
pnpm install --dir "$DOWNLOADS_APP" --link-workspace-packages >/dev/null

echo "==> Verifying downloads smoke app"
pnpm --dir "$DOWNLOADS_APP" release:check
pnpm --dir "$DOWNLOADS_APP" typecheck
pnpm --dir "$DOWNLOADS_APP" build

echo "==> Scaffolding clipboard smoke app"
node packages/create-forge-app/dist/index.js create "$CLIPBOARD_APP" --template minimal --feature clipboard --yes --package-manager pnpm >/dev/null

echo "==> Installing clipboard smoke app with workspace links"
pnpm install --dir "$CLIPBOARD_APP" --link-workspace-packages >/dev/null

echo "==> Verifying clipboard smoke app"
pnpm --dir "$CLIPBOARD_APP" release:check
pnpm --dir "$CLIPBOARD_APP" typecheck
pnpm --dir "$CLIPBOARD_APP" build

echo "==> Scaffolding external-links smoke app"
node packages/create-forge-app/dist/index.js create "$EXTERNAL_LINKS_APP" --template minimal --feature external-links --yes --package-manager pnpm >/dev/null

echo "==> Installing external-links smoke app with workspace links"
pnpm install --dir "$EXTERNAL_LINKS_APP" --link-workspace-packages >/dev/null

echo "==> Verifying external-links smoke app"
pnpm --dir "$EXTERNAL_LINKS_APP" release:check
pnpm --dir "$EXTERNAL_LINKS_APP" typecheck
pnpm --dir "$EXTERNAL_LINKS_APP" build

echo "==> Scaffolding system-info smoke app"
node packages/create-forge-app/dist/index.js create "$SYSTEM_INFO_APP" --template minimal --feature system-info --yes --package-manager pnpm >/dev/null

echo "==> Installing system-info smoke app with workspace links"
pnpm install --dir "$SYSTEM_INFO_APP" --link-workspace-packages >/dev/null

echo "==> Verifying system-info smoke app"
pnpm --dir "$SYSTEM_INFO_APP" release:check
pnpm --dir "$SYSTEM_INFO_APP" typecheck
pnpm --dir "$SYSTEM_INFO_APP" build

echo "==> Scaffolding permissions smoke app"
node packages/create-forge-app/dist/index.js create "$PERMISSIONS_APP" --template minimal --feature permissions --yes --package-manager pnpm >/dev/null

echo "==> Installing permissions smoke app with workspace links"
pnpm install --dir "$PERMISSIONS_APP" --link-workspace-packages >/dev/null

echo "==> Verifying permissions smoke app"
pnpm --dir "$PERMISSIONS_APP" release:check
pnpm --dir "$PERMISSIONS_APP" typecheck
pnpm --dir "$PERMISSIONS_APP" build

echo "==> Scaffolding network-status smoke app"
node packages/create-forge-app/dist/index.js create "$NETWORK_STATUS_APP" --template minimal --feature network-status --yes --package-manager pnpm >/dev/null

echo "==> Installing network-status smoke app with workspace links"
pnpm install --dir "$NETWORK_STATUS_APP" --link-workspace-packages >/dev/null

echo "==> Verifying network-status smoke app"
pnpm --dir "$NETWORK_STATUS_APP" release:check
pnpm --dir "$NETWORK_STATUS_APP" typecheck
pnpm --dir "$NETWORK_STATUS_APP" build

echo "==> Scaffolding secure-storage smoke app"
node packages/create-forge-app/dist/index.js create "$SECURE_STORAGE_APP" --template minimal --feature secure-storage --yes --package-manager pnpm >/dev/null

echo "==> Installing secure-storage smoke app with workspace links"
pnpm install --dir "$SECURE_STORAGE_APP" --link-workspace-packages >/dev/null

echo "==> Verifying secure-storage smoke app"
pnpm --dir "$SECURE_STORAGE_APP" release:check
pnpm --dir "$SECURE_STORAGE_APP" typecheck
pnpm --dir "$SECURE_STORAGE_APP" build

echo "==> Scaffolding support-bundle smoke app"
node packages/create-forge-app/dist/index.js create "$SUPPORT_BUNDLE_APP" --template minimal --feature support-bundle --yes --package-manager pnpm >/dev/null

echo "==> Installing support-bundle smoke app with workspace links"
pnpm install --dir "$SUPPORT_BUNDLE_APP" --link-workspace-packages >/dev/null

echo "==> Verifying support-bundle smoke app"
pnpm --dir "$SUPPORT_BUNDLE_APP" release:check
pnpm --dir "$SUPPORT_BUNDLE_APP" typecheck
pnpm --dir "$SUPPORT_BUNDLE_APP" build

echo "==> Scaffolding log-archive smoke app"
node packages/create-forge-app/dist/index.js create "$LOG_ARCHIVE_APP" --template minimal --feature log-archive --yes --package-manager pnpm >/dev/null

echo "==> Installing log-archive smoke app with workspace links"
pnpm install --dir "$LOG_ARCHIVE_APP" --link-workspace-packages >/dev/null

echo "==> Verifying log-archive smoke app"
pnpm --dir "$LOG_ARCHIVE_APP" release:check
pnpm --dir "$LOG_ARCHIVE_APP" typecheck
pnpm --dir "$LOG_ARCHIVE_APP" build

echo "==> Scaffolding incident-report smoke app"
node packages/create-forge-app/dist/index.js create "$INCIDENT_REPORT_APP" --template minimal --feature incident-report --yes --package-manager pnpm >/dev/null

echo "==> Installing incident-report smoke app with workspace links"
pnpm install --dir "$INCIDENT_REPORT_APP" --link-workspace-packages >/dev/null

echo "==> Verifying incident-report smoke app"
pnpm --dir "$INCIDENT_REPORT_APP" release:check
pnpm --dir "$INCIDENT_REPORT_APP" typecheck
pnpm --dir "$INCIDENT_REPORT_APP" build

echo "==> Scaffolding diagnostics-timeline smoke app"
node packages/create-forge-app/dist/index.js create "$DIAGNOSTICS_TIMELINE_APP" --template minimal --feature diagnostics-timeline --yes --package-manager pnpm >/dev/null

echo "==> Installing diagnostics-timeline smoke app with workspace links"
pnpm install --dir "$DIAGNOSTICS_TIMELINE_APP" --link-workspace-packages >/dev/null

echo "==> Verifying diagnostics-timeline smoke app"
pnpm --dir "$DIAGNOSTICS_TIMELINE_APP" release:check
pnpm --dir "$DIAGNOSTICS_TIMELINE_APP" typecheck
pnpm --dir "$DIAGNOSTICS_TIMELINE_APP" build

echo "Scaffold build verification passed."
