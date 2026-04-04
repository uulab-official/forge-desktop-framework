#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/forge-release-surface.XXXXXX")"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

assert_file() {
  local path="$1"

  if [ ! -f "$path" ]; then
    echo "Missing release surface file: $path"
    exit 1
  fi
}

assert_contains() {
  local path="$1"
  local pattern="$2"

  if ! grep -Fq "$pattern" "$path"; then
    echo "Expected '$pattern' in $path"
    exit 1
  fi
}

assert_package_json() {
  local package_json="$1"
  local expected_version="$2"

  node - "$package_json" "$expected_version" <<'NODE'
const fs = require('node:fs');

const [packageJsonPath, expectedVersion] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const expectedScripts = new Map([
  ['release:check', 'bash scripts/preflight-release.sh'],
  ['publish:check:github', 'bash scripts/check-publish-env.sh github'],
  ['publish:check:s3', 'bash scripts/check-publish-env.sh s3'],
  ['package:verify', 'bash scripts/verify-package-output.sh github'],
  ['package:verify:s3', 'bash scripts/verify-package-output.sh s3'],
  ['package:audit', 'bash scripts/audit-package-output.sh github'],
  ['package:audit:s3', 'bash scripts/audit-package-output.sh s3'],
  ['security:check', 'bash scripts/security-baseline.sh'],
  ['ops:check', 'bash scripts/runtime-hygiene.sh'],
  ['ops:snapshot', 'bash scripts/ops-snapshot.sh'],
  ['ops:evidence', 'bash scripts/ops-evidence.sh'],
  ['production:check', 'bash scripts/production-readiness.sh github'],
  ['production:check:github', 'bash scripts/production-readiness.sh github'],
  ['production:check:s3', 'bash scripts/production-readiness.sh s3'],
  ['production:check:all', 'bash scripts/production-readiness.sh github s3'],
  ['package:local', 'bash scripts/build-app.sh && bash scripts/verify-package-output.sh github && bash scripts/audit-package-output.sh github'],
  ['publish:github', 'bash scripts/check-publish-env.sh github && electron-builder --publish always'],
  ['publish:s3', 'bash scripts/check-publish-env.sh s3 && electron-builder -c electron-builder.s3.yml'],
]);

if (pkg.version !== expectedVersion) {
  console.error(`Unexpected scaffold version in ${packageJsonPath}: ${pkg.version} !== ${expectedVersion}`);
  process.exit(1);
}

for (const [name, command] of expectedScripts.entries()) {
  if (pkg.scripts?.[name] !== command) {
    console.error(`Unexpected script '${name}' in ${packageJsonPath}: ${pkg.scripts?.[name] ?? '<missing>'}`);
    process.exit(1);
  }
}
NODE
}

audit_preset_surface() {
  local preset_id="$1"
  local target_dir="$WORK_DIR/$preset_id"
  local version

  echo "==> Auditing official preset release surface: $preset_id"
  node packages/create-forge-app/dist/index.js create "$target_dir" --template minimal --preset "$preset_id" --yes --package-manager pnpm >/dev/null

  version=$(node -p "require('./package.json').version")

  assert_package_json "$target_dir/package.json" "$version"
  assert_file "$target_dir/.env.example"
  assert_file "$target_dir/electron-builder.yml"
  assert_file "$target_dir/electron-builder.s3.yml"
  assert_file "$target_dir/build/entitlements.mac.plist"
  assert_file "$target_dir/docs/release-playbook.md"
  assert_file "$target_dir/docs/production-readiness.md"
  assert_file "$target_dir/.github/workflows/validate.yml"
  assert_file "$target_dir/.github/workflows/release.yml"
  assert_file "$target_dir/scripts/preflight-release.sh"
  assert_file "$target_dir/scripts/check-publish-env.sh"
  assert_file "$target_dir/scripts/verify-package-output.sh"
  assert_file "$target_dir/scripts/audit-package-output.sh"
  assert_file "$target_dir/scripts/security-baseline.sh"
  assert_file "$target_dir/scripts/runtime-hygiene.sh"
  assert_file "$target_dir/scripts/ops-snapshot.sh"
  assert_file "$target_dir/scripts/ops-evidence.sh"
  assert_file "$target_dir/scripts/production-readiness.sh"
  assert_file "$target_dir/scripts/setup-python.sh"
  assert_file "$target_dir/scripts/build-worker.sh"
  assert_file "$target_dir/scripts/build-app.sh"

  assert_contains "$target_dir/.env.example" "GH_OWNER"
  assert_contains "$target_dir/.env.example" "S3_UPDATE_URL"
  assert_contains "$target_dir/electron-builder.yml" "provider: github"
  assert_contains "$target_dir/electron-builder.yml" "output: release"
  assert_contains "$target_dir/electron-builder.s3.yml" "provider: generic"
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm security:check"
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm ops:check"
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm ops:snapshot"
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm ops:evidence"
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm production:check"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm security:check"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:check"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:snapshot"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:evidence"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm production:check"
  assert_contains "$target_dir/.github/workflows/validate.yml" "pnpm ops:check"
  assert_contains "$target_dir/.github/workflows/validate.yml" "pnpm ops:snapshot"
  assert_contains "$target_dir/.github/workflows/validate.yml" "pnpm ops:evidence"
  assert_contains "$target_dir/.github/workflows/validate.yml" "actions/upload-artifact@v4"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/snapshots"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/evidence"
  assert_contains "$target_dir/.github/workflows/release.yml" "pnpm ops:check"
  assert_contains "$target_dir/.github/workflows/release.yml" "pnpm ops:snapshot"
  assert_contains "$target_dir/.github/workflows/release.yml" "pnpm ops:evidence"
  assert_contains "$target_dir/.github/workflows/release.yml" "actions/upload-artifact@v4"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/snapshots"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/evidence"
  assert_contains "$target_dir/.github/workflows/release.yml" "pnpm publish:check:github"
  assert_contains "$target_dir/.github/workflows/release.yml" "tags:"
  assert_contains "$target_dir/README.md" "Generated with \`create-forge-desktop@${version}\`"
}

if [ ! -f "packages/create-forge-app/dist/index.js" ]; then
  echo "Missing packages/create-forge-app/dist/index.js"
  echo "Run: pnpm --filter create-forge-desktop build"
  exit 1
fi

audit_preset_surface "launch-ready"
audit_preset_surface "support-ready"
audit_preset_surface "ops-ready"
audit_preset_surface "document-ready"
audit_preset_surface "production-ready"

echo "Preset release surface audit passed."
