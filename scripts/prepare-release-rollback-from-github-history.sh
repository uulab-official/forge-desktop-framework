#!/bin/bash
set -euo pipefail

REPO="${1:-}"
PLATFORM_LABEL="${2:-}"
ARCH_LABEL="${3:-}"
CURRENT_VERSION="${4:-}"
RECOVERY_MODE="${5:-github-only}"
LIMIT="${6:-5}"
HISTORY_ROOT="${7:-}"
OUTPUT_DIR="${8:-}"

if [[ -z "$REPO" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" || -z "$CURRENT_VERSION" ]]; then
  echo "Usage: bash scripts/prepare-release-rollback-from-github-history.sh <owner/repo> <platform> <arch> <current-version> [github-only|dual-channel] [limit] [history-root] [output-dir]"
  exit 1
fi

if [[ -z "$HISTORY_ROOT" ]]; then
  HISTORY_ROOT=".fetched-release-history/github-${PLATFORM_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}"
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR=".prepared-rollback-targets/github-${PLATFORM_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}-${RECOVERY_MODE}"
fi

bash scripts/fetch-release-history-from-github.sh "$REPO" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$LIMIT" "$HISTORY_ROOT"
bash scripts/prepare-release-rollback-from-history.sh "$HISTORY_ROOT" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$RECOVERY_MODE" "$OUTPUT_DIR"
