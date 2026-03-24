#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "Testing Python workers across all examples..."

FAILED=0

test_worker() {
  local dir=$1
  local action=$2
  local payload=$3
  local name=$(basename "$dir")

  result=$(echo "{\"action\":\"$action\",\"payload\":$payload}" | python3 "$ROOT_DIR/$dir/worker/main.py" 2>/dev/null | grep '"success": true' || true)

  if [ -n "$result" ]; then
    echo "  ✓ $name ($action)"
  else
    echo "  ✗ $name ($action) FAILED"
    FAILED=$((FAILED + 1))
  fi
}

echo ""
echo "=== App worker ==="
test_worker "apps" "health_check" "{}"
test_worker "apps" "echo" '{"message":"test"}'

echo ""
echo "=== Examples ==="
test_worker "examples/minimal" "reverse" '{"text":"hello"}'
test_worker "examples/file-processor" "process_file" '{"path":"README.md"}'
test_worker "examples/ai-tool" "sentiment" '{"text":"great job"}'
test_worker "examples/dashboard" "generate_data" '{"count":3}'
test_worker "examples/multi-module" "calculate" '{"expression":"1+1"}'
test_worker "examples/chat" "chat_respond" '{"message":"hi"}'
test_worker "examples/webrtc-demo" "health_check" "{}"
test_worker "examples/webgpu-compute" "matrix_multiply" '{"size":4}'

echo ""
if [ $FAILED -eq 0 ]; then
  echo "All workers passed!"
else
  echo "$FAILED worker(s) failed"
  exit 1
fi
