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
  ['ops:report', 'bash scripts/ops-report.sh'],
  ['ops:bundle', 'bash scripts/ops-bundle.sh'],
  ['ops:index', 'bash scripts/ops-index.sh'],
  ['ops:doctor', 'bash scripts/ops-doctor.sh'],
  ['ops:handoff', 'bash scripts/ops-handoff.sh'],
  ['ops:attest', 'bash scripts/ops-attest.sh'],
  ['ops:ready', 'bash scripts/ops-ready.sh'],
  ['ops:gate', 'bash scripts/ops-gate.sh'],
  ['ops:releasepack', 'bash scripts/ops-releasepack.sh'],
  ['ops:export', 'bash scripts/ops-export.sh'],
  ['ops:restore', 'bash scripts/ops-restore.sh'],
  ['ops:recover', 'bash scripts/ops-recover.sh'],
  ['ops:rollback', 'bash scripts/ops-rollback.sh'],
  ['ops:incident', 'bash scripts/ops-incident.sh'],
  ['ops:escalate', 'bash scripts/ops-escalate.sh'],
  ['ops:continuity', 'bash scripts/ops-continuity.sh'],
  ['ops:resilience', 'bash scripts/ops-resilience.sh'],
  ['ops:runbook', 'bash scripts/ops-runbook.sh'],
  ['ops:integrity', 'bash scripts/ops-integrity.sh'],
  ['ops:compliance', 'bash scripts/ops-compliance.sh'],
  ['ops:certify', 'bash scripts/ops-certify.sh'],
  ['ops:assure', 'bash scripts/ops-assure.sh'],
  ['ops:retention', 'bash scripts/ops-retention.sh'],
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
  assert_file "$target_dir/scripts/ops-report.sh"
  assert_file "$target_dir/scripts/ops-bundle.sh"
  assert_file "$target_dir/scripts/ops-index.sh"
  assert_file "$target_dir/scripts/ops-doctor.sh"
  assert_file "$target_dir/scripts/ops-handoff.sh"
  assert_file "$target_dir/scripts/ops-attest.sh"
  assert_file "$target_dir/scripts/ops-ready.sh"
  assert_file "$target_dir/scripts/ops-gate.sh"
  assert_file "$target_dir/scripts/ops-releasepack.sh"
  assert_file "$target_dir/scripts/ops-export.sh"
  assert_file "$target_dir/scripts/ops-restore.sh"
  assert_file "$target_dir/scripts/ops-recover.sh"
  assert_file "$target_dir/scripts/ops-rollback.sh"
  assert_file "$target_dir/scripts/ops-incident.sh"
  assert_file "$target_dir/scripts/ops-escalate.sh"
  assert_file "$target_dir/scripts/ops-continuity.sh"
  assert_file "$target_dir/scripts/ops-resilience.sh"
  assert_file "$target_dir/scripts/ops-runbook.sh"
  assert_file "$target_dir/scripts/ops-integrity.sh"
  assert_file "$target_dir/scripts/ops-compliance.sh"
  assert_file "$target_dir/scripts/ops-certify.sh"
  assert_file "$target_dir/scripts/ops-assure.sh"
  assert_file "$target_dir/scripts/ops-retention.sh"
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
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm ops:assure"
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm ops:retention"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:attest"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:rollback"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:incident"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:escalate"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:continuity"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:resilience"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:runbook"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:integrity"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:certify"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:assure"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/recoveries/"
  assert_contains "$target_dir/docs/release-playbook.md" "pnpm production:check"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm security:check"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:check"
  assert_contains "$target_dir/docs/production-readiness.md" "Operations gate under"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/gates/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/releasepacks/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/exports/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/restores/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/recoveries/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/rollbacks/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/incidents/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/escalations/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/continuity/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/resilience/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/runbooks/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/integrity/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/compliance/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/certifications/"
  assert_contains "$target_dir/docs/production-readiness.md" "ops/assurances/"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm ops:retention"
  assert_contains "$target_dir/docs/production-readiness.md" "pnpm production:check"
  assert_contains "$target_dir/.github/workflows/validate.yml" "pnpm ops:retention"
  assert_contains "$target_dir/.github/workflows/validate.yml" "pnpm ops:check"
  assert_contains "$target_dir/.github/workflows/validate.yml" "actions/upload-artifact@v4"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/snapshots"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/evidence"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/index"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/reports"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/bundles"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/doctors"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/handoffs"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/attestations"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/ready"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/gates"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/releasepacks"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/exports"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/restores"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/recoveries"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/rollbacks"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/incidents"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/escalations"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/continuity"
  assert_contains "$target_dir/.github/workflows/validate.yml" "pnpm ops:assure"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/resilience"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/runbooks"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/integrity"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/compliance"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/certifications"
  assert_contains "$target_dir/.github/workflows/validate.yml" "ops/assurances"
  assert_contains "$target_dir/.github/workflows/release.yml" "pnpm ops:retention"
  assert_contains "$target_dir/.github/workflows/release.yml" "pnpm ops:check"
  assert_contains "$target_dir/.github/workflows/release.yml" "pnpm ops:assure"
  assert_contains "$target_dir/.github/workflows/release.yml" "actions/upload-artifact@v4"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/snapshots"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/evidence"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/index"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/reports"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/bundles"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/doctors"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/handoffs"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/attestations"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/ready"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/gates"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/releasepacks"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/exports"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/restores"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/recoveries"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/rollbacks"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/incidents"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/escalations"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/continuity"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/resilience"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/runbooks"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/integrity"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/compliance"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/certifications"
  assert_contains "$target_dir/.github/workflows/release.yml" "ops/assurances"
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
