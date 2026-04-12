#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

assert_contains() {
  local path="$1"
  local pattern="$2"
  local description="$3"

  if ! grep -Fq "$pattern" "$path"; then
    echo "Runtime hygiene check failed: $description"
    echo "Missing pattern: $pattern"
    echo "File: $path"
    exit 1
  fi
}

MAIN_FILE="electron/main.ts"

if [ ! -f "$MAIN_FILE" ]; then
  echo "Missing Electron main entry: $MAIN_FILE"
  exit 1
fi

assert_contains "$MAIN_FILE" "setAppLogsPath(" "app logs path must be explicitly managed"
assert_contains "$MAIN_FILE" "setPath('crashDumps'" "crash dump path must be explicitly managed"
assert_contains "$MAIN_FILE" "runtimeRetentionPolicy" "runtime retention policy must be declared"
assert_contains "$MAIN_FILE" "pruneRuntimeDirectory" "runtime retention cleanup helper must exist"
assert_contains "$MAIN_FILE" "enforceRuntimeHygiene" "runtime hygiene boot hook must exist"
assert_contains "$MAIN_FILE" "Runtime hygiene completed" "runtime hygiene should log cleanup results"

echo "Runtime hygiene baseline checks passed."
