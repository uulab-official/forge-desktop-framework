#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

if [ ! -d "worker/.venv" ]; then
  bash scripts/setup-python.sh
fi

source worker/.venv/bin/activate
python -m pip install pyinstaller

cd worker
python -m PyInstaller --onefile --name forge-worker main.py

echo "Worker built: $ROOT_DIR/worker/dist/forge-worker"
