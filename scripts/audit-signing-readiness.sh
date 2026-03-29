#!/bin/bash
set -euo pipefail

PLATFORM="${1:-}"
ARCH="${2:-default}"
OUTPUT_DIR="${3:-.release-audit/${PLATFORM}-${ARCH}}"

if [[ -z "$PLATFORM" ]]; then
  echo "Usage: bash scripts/audit-signing-readiness.sh <mac|win|linux> [arch] [output-dir]"
  exit 1
fi

case "$PLATFORM" in
  mac|win|linux) ;;
  *)
    echo "Unsupported platform: $PLATFORM"
    exit 1
    ;;
esac

mkdir -p "$OUTPUT_DIR"

declare -a REQUIRED_VARS
declare -a PRESENT_VARS
declare -a MISSING_VARS

REQUIRED_VARS=("GH_TOKEN")

case "$PLATFORM" in
  mac)
    REQUIRED_VARS+=(
      "CSC_LINK"
      "CSC_KEY_PASSWORD"
      "APPLE_ID"
      "APPLE_APP_SPECIFIC_PASSWORD"
      "APPLE_TEAM_ID"
    )
    ;;
  win)
    REQUIRED_VARS+=(
      "WIN_CSC_LINK"
      "WIN_CSC_KEY_PASSWORD"
    )
    ;;
esac

for var_name in "${REQUIRED_VARS[@]}"; do
  if [[ -n "${!var_name:-}" ]]; then
    PRESENT_VARS+=("$var_name")
  else
    MISSING_VARS+=("$var_name")
  fi
done

STATUS="passed"
if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  STATUS="failed"
fi

MD_PATH="$OUTPUT_DIR/signing-readiness.md"
JSON_PATH="$OUTPUT_DIR/signing-readiness.json"

array_to_json() {
  if [[ $# -eq 0 ]]; then
    printf '[]'
    return
  fi

  printf '%s\n' "$@" | node -e "const fs = require('fs'); const data = fs.readFileSync(0, 'utf8').trim().split(/\n/).filter(Boolean); process.stdout.write(JSON.stringify(data));"
}

{
  echo "# Signing Readiness Audit"
  echo
  echo "- Platform: \`$PLATFORM\`"
  echo "- Arch: \`$ARCH\`"
  echo "- Status: \`$STATUS\`"
  echo
  echo "## Required Environment"
  for var_name in "${REQUIRED_VARS[@]}"; do
    echo "- \`$var_name\`"
  done
  echo
  echo "## Present Environment"
  if [[ ${#PRESENT_VARS[@]} -eq 0 ]]; then
    echo "- _(none)_"
  else
    for var_name in "${PRESENT_VARS[@]}"; do
      echo "- \`$var_name\`"
    done
  fi
  echo
  echo "## Missing Environment"
  if [[ ${#MISSING_VARS[@]} -eq 0 ]]; then
    echo "- _(none)_"
  else
    for var_name in "${MISSING_VARS[@]}"; do
      echo "- \`$var_name\`"
    done
  fi
} > "$MD_PATH"

REQUIRED_JSON="$(array_to_json "${REQUIRED_VARS[@]}")"
PRESENT_JSON="$(array_to_json "${PRESENT_VARS[@]}")"
if [[ ${#MISSING_VARS[@]} -eq 0 ]]; then
  MISSING_JSON='[]'
else
  MISSING_JSON="$(array_to_json "${MISSING_VARS[@]}")"
fi

node -e "
  const fs = require('fs');
  const payload = {
    platform: process.argv[1],
    arch: process.argv[2],
    status: process.argv[3],
    requiredEnv: JSON.parse(process.argv[4]),
    presentEnv: JSON.parse(process.argv[5]),
    missingEnv: JSON.parse(process.argv[6]),
  };
  fs.writeFileSync(process.argv[7], JSON.stringify(payload, null, 2) + '\n');
" "$PLATFORM" "$ARCH" "$STATUS" "$REQUIRED_JSON" "$PRESENT_JSON" "$MISSING_JSON" "$JSON_PATH"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$MD_PATH" >> "$GITHUB_STEP_SUMMARY"
  echo >> "$GITHUB_STEP_SUMMARY"
fi

echo "Signing readiness audit written to:"
echo "  $MD_PATH"
echo "  $JSON_PATH"

if [[ "$STATUS" != "passed" ]]; then
  echo "Missing required environment for $PLATFORM signing readiness:"
  for var_name in "${MISSING_VARS[@]}"; do
    echo "  - $var_name"
  done
  exit 1
fi
