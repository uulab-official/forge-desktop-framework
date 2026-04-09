#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

PACK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-external-packs.XXXXXX")"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-external-smoke.XXXXXX")"
PACK_MAP_PATH="$WORK_DIR/forge-packages.tsv"
STAGE_DIR="$WORK_DIR/package-staging"

cleanup() {
  rm -rf "$PACK_DIR" "$WORK_DIR"
}

trap cleanup EXIT

run_with_timeout() {
  local timeout_seconds="$1"
  shift

  node - "$timeout_seconds" "$@" <<'NODE'
const { spawnSync } = require('node:child_process');

const [timeoutSeconds, ...command] = process.argv.slice(2);
if (command.length === 0) {
  console.error('run_with_timeout requires a command');
  process.exit(1);
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: 'inherit',
  timeout: Number(timeoutSeconds) * 1000,
});

if (result.error) {
  if (result.error.code === 'ETIMEDOUT') {
    console.error(`Timed out after ${timeoutSeconds}s: ${command.join(' ')}`);
    process.exit(124);
  }
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
NODE
}

install_with_retry() {
  local target_dir="$1"
  local attempt

  for attempt in 1 2; do
    if run_with_timeout 900 pnpm install --dir "$target_dir"; then
      return 0
    fi

    if [[ "$attempt" -eq 1 ]]; then
      echo "pnpm install stalled or failed for $target_dir; retrying once..."
      sleep 2
    fi
  done

  echo "pnpm install failed for $target_dir after retries."
  exit 1
}

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

compute_tarball_name() {
  local package_dir="$1"

  node -e "const pkg = require('./${package_dir}/package.json'); const base = pkg.name.startsWith('@') ? pkg.name.slice(1).replace(/\//g, '-') : pkg.name; console.log(\`\${base}-\${pkg.version}.tgz\`);"
}

register_workspace_package() {
  local package_dir="$1"
  local package_name
  local tarball_name

  package_name=$(node -p "require('./${package_dir}/package.json').name")
  tarball_name=$(compute_tarball_name "$package_dir")
  printf '%s\t%s\n' "$package_name" "$PACK_DIR/$tarball_name" >> "$PACK_MAP_PATH"
}

rewrite_forge_dependencies() {
  local package_json="$1"

  node - "$package_json" "$PACK_MAP_PATH" <<'NODE'
const fs = require('fs');

const [packageJsonPath, packMapPath] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packMap = new Map(
  fs.readFileSync(packMapPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, tarballPath] = line.split('\t');
      return [name, `file:${tarballPath}`];
    }),
);

for (const field of ['dependencies', 'devDependencies']) {
  const deps = pkg[field];
  if (!deps) continue;

  for (const [name] of Object.entries(deps)) {
    if (!name.startsWith('@forge/')) continue;
    const tarballRef = packMap.get(name);
    if (tarballRef) {
      deps[name] = tarballRef;
    }
  }
}

fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
NODE
}

pack_workspace_package() {
  local package_dir="$1"
  local stage_path="$STAGE_DIR/$(basename "$package_dir")"
  local tarball_name

  tarball_name=$(compute_tarball_name "$package_dir")
  rm -rf "$stage_path"
  mkdir -p "$STAGE_DIR"
  cp -R "$package_dir" "$stage_path"
  rm -rf "$stage_path/node_modules"
  rewrite_forge_dependencies "$stage_path/package.json"
  (cd "$stage_path" && pnpm pack --out "$PACK_DIR/$tarball_name" >/dev/null)
}

verify_external_app() {
  local preset_id="$1"
  local target_dir="$WORK_DIR/$2"

  echo "==> Scaffolding external ${preset_id} app with packed CLI"
  pnpm --package "$CLI_TARBALL" dlx create-forge-desktop "$target_dir" --template minimal --preset "$preset_id" --yes --package-manager pnpm >/dev/null

  echo "==> Rewriting Forge dependencies to local tarballs for ${preset_id}"
  rewrite_forge_dependencies "$target_dir/package.json"

  echo "==> Installing external ${preset_id} app without workspace links"
  install_with_retry "$target_dir"

  echo "==> Verifying external ${preset_id} app"
  pnpm --dir "$target_dir" release:check
  if [[ "$preset_id" == "launch-ready" ]]; then
    env GH_TOKEN=forge-smoke-token pnpm --dir "$target_dir" publish:check:github
    seed_release_output "$target_dir"
    pnpm --dir "$target_dir" package:verify
    pnpm --dir "$target_dir" package:audit
  fi
  if [[ "$preset_id" == "document-ready" ]]; then
    env AWS_ACCESS_KEY_ID=forge-smoke-key AWS_SECRET_ACCESS_KEY=forge-smoke-secret S3_BUCKET=forge-smoke-bucket S3_ENDPOINT=https://example.com S3_UPDATE_URL=https://downloads.example.com/releases pnpm --dir "$target_dir" publish:check:s3
    seed_release_output "$target_dir"
    pnpm --dir "$target_dir" package:verify:s3
    pnpm --dir "$target_dir" package:audit:s3
  fi
  if [[ "$preset_id" == "launch-ready" ]]; then
    pnpm --dir "$target_dir" setup:python
    pnpm --dir "$target_dir" build:worker
    if [ ! -f "$target_dir/worker/dist/forge-worker" ] && [ ! -f "$target_dir/worker/dist/forge-worker.exe" ]; then
      echo "External ${preset_id} smoke app worker binary was not produced."
      exit 1
    fi
  fi
  if [[ "$preset_id" == "production-ready" ]]; then
    seed_release_output "$target_dir"
    env GH_TOKEN=forge-smoke-token AWS_ACCESS_KEY_ID=forge-smoke-key AWS_SECRET_ACCESS_KEY=forge-smoke-secret S3_BUCKET=forge-smoke-bucket S3_ENDPOINT=https://example.com S3_UPDATE_URL=https://downloads.example.com/releases pnpm --dir "$target_dir" production:check:all -- --require-release-output
    pnpm --dir "$target_dir" ops:retention -- --keep 1
    if ! find "$target_dir/ops/snapshots" -name 'ops-snapshot.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops snapshot JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/evidence" -name 'ops-evidence-summary.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops evidence summary JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/index" -name 'ops-index.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops index JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/reports" -name 'ops-report.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops report JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/bundles" -name 'ops-bundle-summary.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops bundle summary JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/bundles" -name 'ops-bundle.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops bundle archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/doctors" -name 'ops-doctor.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops doctor JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/handoffs" -name 'ops-handoff.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops handoff JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/handoffs" -name 'ops-handoff.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops handoff archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/attestations" -name 'ops-attestation.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops attestation JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/attestations" -name 'ops-attestation.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops attestation Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/ready" -name 'ops-ready.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops ready JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/ready" -name 'ops-ready.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops ready Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/gates" -name 'ops-gate.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops gate JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/gates" -name 'ops-gate.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops gate Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/releasepacks" -name 'ops-releasepack.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops release pack JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/releasepacks" -name 'ops-releasepack.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops release pack Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/releasepacks" -name 'ops-releasepack.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops release pack archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/exports" -name 'ops-export.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops export JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/exports" -name 'ops-export.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops export Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/exports" -name 'ops-export.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops export archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/restores" -name 'ops-restore.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops restore JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/restores" -name 'ops-restore.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops restore Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/restores" -path '*/restored/payload/releasepack/ops-releasepack.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app restored release pack payload was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/recoveries" -name 'ops-recover.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops recover JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/recoveries" -name 'ops-recover.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops recover Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/recoveries" -path '*/proof/restore/ops-restore.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops recover proof did not capture the latest restore JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/rollbacks" -name 'ops-rollback.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops rollback JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/rollbacks" -name 'ops-rollback.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops rollback Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/rollbacks" -path '*/proof/recover/ops-recover.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops rollback proof did not capture the latest recover JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/incidents" -name 'ops-incident.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops incident JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/incidents" -name 'ops-incident.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops incident Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/incidents" -name 'ops-incident.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops incident archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/incidents" -path '*/packet/rollback/ops-rollback.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops incident packet did not capture the latest rollback JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/escalations" -name 'ops-escalate.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops escalate JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/escalations" -name 'ops-escalate.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops escalate Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/escalations" -name 'ops-escalate.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops escalate archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/escalations" -path '*/packet/incident/ops-incident.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops escalate packet did not capture the latest incident JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/continuity" -name 'ops-continuity.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops continuity JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/continuity" -name 'ops-continuity.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops continuity Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/continuity" -name 'ops-continuity.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops continuity archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/continuity" -path '*/packet/escalation/ops-escalate.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops continuity packet did not capture the latest escalation JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/resilience" -name 'ops-resilience.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops resilience JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/resilience" -name 'ops-resilience.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops resilience Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/resilience" -name 'ops-resilience.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops resilience archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/resilience" -path '*/packet/continuity/ops-continuity.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops resilience packet did not capture the latest continuity JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/runbooks" -name 'ops-runbook.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops runbook JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/runbooks" -name 'ops-runbook.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops runbook Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/runbooks" -name 'ops-runbook.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops runbook archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/runbooks" -path '*/packet/resilience/ops-resilience.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops runbook packet did not capture the latest resilience JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/integrity" -name 'ops-integrity.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops integrity JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/integrity" -name 'ops-integrity.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops integrity Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/integrity" -name 'ops-integrity.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops integrity archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/integrity" -path '*/packet/runbook/ops-runbook.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops integrity packet did not capture the latest runbook JSON."
      exit 1
    fi
    if ! find "$target_dir/ops/compliance" -name 'ops-compliance.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops compliance JSON was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/compliance" -name 'ops-compliance.md' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops compliance Markdown was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/compliance" -name 'ops-compliance.tgz' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops compliance archive was not produced."
      exit 1
    fi
    if ! find "$target_dir/ops/compliance" -path '*/packet/integrity/ops-integrity.json' -print -quit | grep -q .; then
      echo "External ${preset_id} smoke app ops compliance packet did not capture the latest integrity JSON."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops snapshot retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/evidence" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops evidence retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/index" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops index retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/reports" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops report retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/bundles" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops bundle retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/doctors" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops doctor retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/handoffs" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops handoff retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/attestations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops attestation retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/ready" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops ready retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/gates" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops gate retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/releasepacks" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops release pack retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/exports" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops export retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/restores" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops restore retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/recoveries" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops recover retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/rollbacks" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops rollback retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/incidents" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops incident retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/escalations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops escalation retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/continuity" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops continuity retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/resilience" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops resilience retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/runbooks" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops runbook retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/integrity" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops integrity retention did not keep exactly one directory."
      exit 1
    fi
    if [ "$(find "$target_dir/ops/compliance" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -ne 1 ]; then
      echo "External ${preset_id} smoke app ops compliance retention did not keep exactly one directory."
      exit 1
    fi
    if [ ! -f "$target_dir/worker/dist/forge-worker" ] && [ ! -f "$target_dir/worker/dist/forge-worker.exe" ]; then
      echo "External ${preset_id} smoke app worker binary was not produced."
      exit 1
    fi
  fi
  pnpm --dir "$target_dir" typecheck
  pnpm --dir "$target_dir" build
}

echo "==> Building Forge packages for external scaffold verification"
pnpm build --filter='./packages/*'

echo "==> Building create-forge-desktop"
pnpm --filter create-forge-desktop build

: > "$PACK_MAP_PATH"

echo "==> Registering Forge workspace package tarballs"
for package_dir in packages/*; do
  if [ ! -f "$package_dir/package.json" ]; then
    continue
  fi

  if [ "$package_dir" = "packages/create-forge-app" ]; then
    continue
  fi

  register_workspace_package "$package_dir"
done

echo "==> Packing Forge workspace packages"
for package_dir in packages/*; do
  if [ ! -f "$package_dir/package.json" ]; then
    continue
  fi

  if [ "$package_dir" = "packages/create-forge-app" ]; then
    continue
  fi

  pack_workspace_package "$package_dir"
done

echo "==> Packing create-forge-desktop CLI"
CLI_TARBALL_NAME=$(node -e "const pkg = require('./packages/create-forge-app/package.json'); console.log(\`\${pkg.name}-\${pkg.version}.tgz\`);")
(cd packages/create-forge-app && pnpm pack --out "$PACK_DIR/$CLI_TARBALL_NAME" >/dev/null)
CLI_TARBALL="$PACK_DIR/$CLI_TARBALL_NAME"

verify_external_app "launch-ready" "launch-ready"
verify_external_app "support-ready" "support-ready"
verify_external_app "ops-ready" "ops-ready"
verify_external_app "document-ready" "document-ready"
verify_external_app "production-ready" "production-ready"

echo "External scaffold verification passed."
