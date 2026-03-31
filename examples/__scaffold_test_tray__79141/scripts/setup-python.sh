#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
PYTHON_BIN="${PYTHON:-python3}"

cd "$ROOT_DIR"

$PYTHON_BIN -m venv worker/.venv
source worker/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r worker/requirements.txt

echo "Python environment ready: $ROOT_DIR/worker/.venv"
