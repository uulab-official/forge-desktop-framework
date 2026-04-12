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
    echo "Security baseline check failed: $description"
    echo "Missing pattern: $pattern"
    echo "File: $path"
    exit 1
  fi
}

assert_not_contains() {
  local path="$1"
  local pattern="$2"
  local description="$3"

  if grep -Fq "$pattern" "$path"; then
    echo "Security baseline check failed: $description"
    echo "Unexpected pattern: $pattern"
    echo "File: $path"
    exit 1
  fi
}

MAIN_FILE="electron/main.ts"
PRELOAD_FILE="electron/preload.ts"

if [ ! -f "$MAIN_FILE" ]; then
  echo "Missing Electron main entry: $MAIN_FILE"
  exit 1
fi

if [ ! -f "$PRELOAD_FILE" ]; then
  echo "Missing Electron preload entry: $PRELOAD_FILE"
  exit 1
fi

assert_contains "$MAIN_FILE" "contextIsolation: true" "renderer isolation must stay enabled"
assert_contains "$MAIN_FILE" "nodeIntegration: false" "Node.js integration must stay disabled in the renderer"
assert_contains "$MAIN_FILE" "sandbox: true" "Chromium sandbox must stay enabled"
assert_contains "$MAIN_FILE" "webSecurity: true" "webSecurity must stay enabled"
assert_contains "$MAIN_FILE" "setWindowOpenHandler" "new windows must be explicitly denied or redirected"
assert_contains "$MAIN_FILE" "will-navigate" "unexpected navigations must be guarded"
assert_contains "$MAIN_FILE" "shell.openExternal" "external links must leave the Electron renderer"
assert_contains "$PRELOAD_FILE" "contextBridge.exposeInMainWorld" "preload must expose a bridged API"
assert_contains "$PRELOAD_FILE" "Object.freeze(" "exposed preload API should be frozen"
assert_not_contains "$PRELOAD_FILE" "ipcRenderer.sendSync" "sync IPC should not be exposed to the renderer"

echo "Electron security baseline checks passed."
