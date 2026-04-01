#!/bin/bash
set -euo pipefail

S3_BUCKET="${1:-}"
PLATFORM_LABEL="${2:-}"
ARCH_LABEL="${3:-}"
CURRENT_VERSION="${4:-}"
RECOVERY_MODE="${5:-github-only}"
CHANNEL_LABEL="${6:-s3}"
LIMIT="${7:-5}"
HISTORY_ROOT="${8:-}"
OUTPUT_DIR="${9:-}"

if [[ -z "$S3_BUCKET" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" || -z "$CURRENT_VERSION" ]]; then
  echo "Usage: bash scripts/prepare-release-rollback-from-s3-history.sh <bucket> <platform> <arch> <current-version> [github-only|dual-channel] [channel] [limit] [history-root] [output-dir]"
  exit 1
fi

if [[ -z "$HISTORY_ROOT" ]]; then
  HISTORY_ROOT=".fetched-release-history/s3-${PLATFORM_LABEL}-${CHANNEL_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}"
fi

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR=".prepared-rollback-targets/s3-${PLATFORM_LABEL}-${CHANNEL_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}-${RECOVERY_MODE}"
fi

MATCH_PLATFORM_LABEL="$PLATFORM_LABEL"
if [[ "$CHANNEL_LABEL" == "s3" ]]; then
  MATCH_PLATFORM_LABEL="${PLATFORM_LABEL}-s3"
fi

bash scripts/fetch-release-history-from-s3.sh "$S3_BUCKET" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$CHANNEL_LABEL" "$LIMIT" "$HISTORY_ROOT"
bash scripts/prepare-release-rollback-from-history.sh "$HISTORY_ROOT" "$MATCH_PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$RECOVERY_MODE" "$OUTPUT_DIR"
