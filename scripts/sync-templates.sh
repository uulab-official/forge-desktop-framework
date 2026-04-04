#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
EXAMPLES_DIR="$ROOT_DIR/examples"
TEMPLATES_DIR="$ROOT_DIR/packages/create-forge-app/templates"

echo "Syncing examples → create-forge-app templates..."

rm -rf "$TEMPLATES_DIR"
mkdir -p "$TEMPLATES_DIR"

for example_dir in "$EXAMPLES_DIR"/*/; do
  if [ -d "$example_dir" ]; then
    example_name=$(basename "$example_dir")

    if [[ "$example_name" == __* ]]; then
      echo "  Skipping transient example directory $example_name..."
      continue
    fi

    dest="$TEMPLATES_DIR/$example_name"

    echo "  Copying $example_name..."

    rsync -a \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='dist-electron' \
      --exclude='.turbo' \
      --exclude='__pycache__' \
      --exclude='.venv' \
      --exclude='*.pyc' \
      --exclude='.tsbuildinfo' \
      "$example_dir" "$dest/"
  fi
done

echo "Done! Templates synced to $TEMPLATES_DIR"
