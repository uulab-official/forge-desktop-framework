#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

TARGETS=("$@")
if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=("github")
fi

for target in "${TARGETS[@]}"; do
  case "$target" in
    github|s3) ;;
    *)
      echo "Unsupported publish target: $target"
      echo "Use github and/or s3."
      exit 1
      ;;
  esac
done

bash scripts/preflight-release.sh

missing=0

require_var() {
  local name="$1"
  local context="$2"
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable for ${context}: ${name}"
    missing=1
  else
    echo "✓ ${name} (${context})"
  fi
}

optional_var() {
  local name="$1"
  local context="$2"
  if [ -z "${!name:-}" ]; then
    echo "○ ${name} (${context}) optional"
  else
    echo "✓ ${name} (${context})"
  fi
}

for target in "${TARGETS[@]}"; do
  if [ "$target" = "github" ]; then
    if [ ! -f "electron-builder.yml" ]; then
      echo "Missing electron-builder.yml for GitHub publishing."
      missing=1
    fi
    require_var "GH_TOKEN" "GitHub publish"
    optional_var "GH_OWNER" "GitHub publish override"
    optional_var "GH_REPO" "GitHub publish override"
    optional_var "CSC_LINK" "macOS signing"
    optional_var "CSC_KEY_PASSWORD" "macOS signing"
    optional_var "APPLE_ID" "macOS notarization"
    optional_var "APPLE_APP_SPECIFIC_PASSWORD" "macOS notarization"
    optional_var "APPLE_TEAM_ID" "macOS notarization"
    optional_var "WIN_CSC_LINK" "Windows signing"
    optional_var "WIN_CSC_KEY_PASSWORD" "Windows signing"
  fi

  if [ "$target" = "s3" ]; then
    if [ ! -f "electron-builder.s3.yml" ]; then
      echo "Missing electron-builder.s3.yml for S3 publishing."
      missing=1
    fi
    require_var "AWS_ACCESS_KEY_ID" "S3 publish"
    require_var "AWS_SECRET_ACCESS_KEY" "S3 publish"
    require_var "S3_BUCKET" "S3 publish"
    require_var "S3_ENDPOINT" "S3 publish"
    require_var "S3_UPDATE_URL" "S3 auto-update publish"
    optional_var "AWS_REGION" "S3 publish region"
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Publish preflight failed."
  exit 1
fi

echo "Publish preflight passed for: ${TARGETS[*]}"
