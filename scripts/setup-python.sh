#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/../app/python/worker"

echo "Setting up Python worker environment..."

cd "$WORKER_DIR"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt
pip install pyinstaller

echo "Python worker setup complete!"
echo "  venv: $WORKER_DIR/.venv"
echo "  python: $(python3 --version)"
