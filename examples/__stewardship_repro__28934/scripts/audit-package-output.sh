#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

TARGET="${1:-github}"
RELEASE_DIR="${RELEASE_DIR:-release}"
APP_VERSION="$(node -p "require('./package.json').version")"

case "$TARGET" in
  github|s3) ;;
  *)
    echo "Unsupported package audit target: $TARGET"
    echo "Use github or s3."
    exit 1
    ;;
esac

bash scripts/verify-package-output.sh "$TARGET"

manifest_files=$(find "$RELEASE_DIR" -maxdepth 1 -type f -name "latest*.yml" | sort)
if [ -z "$manifest_files" ]; then
  echo "No update manifests available for audit."
  exit 1
fi

audited=0
while IFS= read -r manifest; do
  [ -n "$manifest" ] || continue
  manifest_version="$(sed -n "s/^version:[[:space:]]*//p" "$manifest" | head -n1 | tr -d '\r\"')"
  if [ -z "$manifest_version" ]; then
    echo "Manifest is missing version: $manifest"
    exit 1
  fi
  if [ "$manifest_version" != "$APP_VERSION" ]; then
    echo "Manifest version mismatch in $manifest: expected $APP_VERSION, got $manifest_version"
    exit 1
  fi

  manifest_paths="$(sed -n "s/^path:[[:space:]]*//p" "$manifest" | tr -d '\r\"')"
  if [ -z "$manifest_paths" ]; then
    echo "Manifest is missing referenced package path: $manifest"
    exit 1
  fi

  manifest_sha="$(sed -n "s/^sha512:[[:space:]]*//p" "$manifest" | head -n1 | tr -d '\r\"')"
  if [ -z "$manifest_sha" ]; then
    echo "Manifest is missing sha512: $manifest"
    exit 1
  fi

  while IFS= read -r relative_path; do
    [ -n "$relative_path" ] || continue
    if [ ! -f "$RELEASE_DIR/$relative_path" ]; then
      echo "Manifest references missing file: $RELEASE_DIR/$relative_path"
      exit 1
    fi
  done <<< "$manifest_paths"

  audited=$((audited + 1))
  echo "Audited manifest: $manifest"
done <<< "$manifest_files"

if [ "$audited" -eq 0 ]; then
  echo "No manifests were audited."
  exit 1
fi

echo "Package audit passed for $TARGET at version $APP_VERSION"
