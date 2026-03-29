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
  pnpm install --dir "$target_dir"

  echo "==> Verifying external ${preset_id} app"
  pnpm --dir "$target_dir" release:check
  if [[ "$preset_id" == "launch-ready" ]]; then
    pnpm --dir "$target_dir" setup:python
    pnpm --dir "$target_dir" build:worker
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

echo "External scaffold verification passed."
