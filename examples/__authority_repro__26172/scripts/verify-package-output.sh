#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

TARGET="${1:-github}"
RELEASE_DIR="${RELEASE_DIR:-release}"

case "$TARGET" in
  github|s3) ;;
  *)
    echo "Unsupported package verification target: $TARGET"
    echo "Use github or s3."
    exit 1
    ;;
esac

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release directory not found: $RELEASE_DIR"
  exit 1
fi

if [ "$TARGET" = "github" ] && [ ! -f "electron-builder.yml" ]; then
  echo "Missing electron-builder.yml for package verification."
  exit 1
fi

if [ "$TARGET" = "s3" ] && [ ! -f "electron-builder.s3.yml" ]; then
  echo "Missing electron-builder.s3.yml for package verification."
  exit 1
fi

find_matches() {
  find "$RELEASE_DIR" -maxdepth 1 -type f \( "$@" \)
}

installer_files=$(find_matches -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.zip" -o -name "*.pkg" -o -name "*.deb" -o -name "*.rpm")
manifest_files=$(find_matches -name "latest*.yml")

if [ -z "$installer_files" ]; then
  echo "No packaged installers found in $RELEASE_DIR"
  exit 1
fi

if [ -z "$manifest_files" ]; then
  echo "No update manifest files found in $RELEASE_DIR"
  exit 1
fi

echo "Packaged installers:"
printf "%s\n" "$installer_files"
echo ""
echo "Update manifests:"
printf "%s\n" "$manifest_files"
echo ""
echo "Package output verification passed for $TARGET"
