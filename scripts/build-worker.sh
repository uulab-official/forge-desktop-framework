#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/../python/worker"

echo "Building Python worker..."

cd "$WORKER_DIR"
source .venv/bin/activate

pyinstaller --onefile --name forge-worker main.py

echo "Worker built: $WORKER_DIR/dist/forge-worker"
