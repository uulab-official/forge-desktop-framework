#!/bin/bash
set -euo pipefail

RELEASE_DIR="${1:-apps/app/release}"
PLATFORM_LABEL="${2:-unknown}"
ARCH_LABEL="${3:-default}"

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release directory not found: $RELEASE_DIR"
  exit 1
fi

SUMMARY_JSON="$RELEASE_DIR/publish-audit.json"
SUMMARY_MD="$RELEASE_DIR/publish-audit.md"

cd "$RELEASE_DIR"

FILES=()
while IFS= read -r file; do
  FILES+=("$file")
done < <(find . -maxdepth 1 -type f ! -name 'artifact-summary.*' ! -name 'publish-audit.*' | sed 's|^\./||' | sort)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No files found in $RELEASE_DIR"
  exit 1
fi

expected_installer=""
case "$PLATFORM_LABEL" in
  mac)
    expected_installer=".dmg"
    ;;
  win)
    expected_installer=".exe"
    ;;
  linux)
    expected_installer=".AppImage"
    ;;
  *)
    echo "Unsupported platform label: $PLATFORM_LABEL"
    exit 1
    ;;
esac

has_expected_installer=false
has_manifest=false
has_blockmap=false
has_zip=false

for file in "${FILES[@]}"; do
  if [[ "$file" == *"$expected_installer" ]]; then
    has_expected_installer=true
  fi
  if [[ "$file" == latest*.yml ]]; then
    has_manifest=true
  fi
  if [[ "$file" == *.blockmap ]]; then
    has_blockmap=true
  fi
  if [[ "$file" == *.zip ]]; then
    has_zip=true
  fi
done

if [ "$has_expected_installer" != "true" ]; then
  echo "Expected a $expected_installer installer in $RELEASE_DIR"
  exit 1
fi

if [ "$has_manifest" != "true" ]; then
  echo "Expected a latest*.yml manifest in $RELEASE_DIR"
  exit 1
fi

{
  echo "# Published Artifact Audit"
  echo
  echo "- Platform: \`$PLATFORM_LABEL\`"
  echo "- Arch: \`$ARCH_LABEL\`"
  echo "- Release dir: \`$RELEASE_DIR\`"
  echo "- Expected installer suffix: \`$expected_installer\`"
  echo
  echo "| Check | Status |"
  echo "| --- | --- |"
  echo "| Expected installer present | $has_expected_installer |"
  echo "| Manifest present | $has_manifest |"
  echo "| Blockmap present | $has_blockmap |"
  echo "| Zip present | $has_zip |"
} > "$SUMMARY_MD"

node - "$SUMMARY_JSON" "$PLATFORM_LABEL" "$ARCH_LABEL" "$expected_installer" "$has_expected_installer" "$has_manifest" "$has_blockmap" "$has_zip" <<'NODE'
const fs = require('node:fs');

const [
  summaryJsonPath,
  platform,
  arch,
  expectedInstallerSuffix,
  hasExpectedInstaller,
  hasManifest,
  hasBlockmap,
  hasZip,
] = process.argv.slice(2);

fs.writeFileSync(
  summaryJsonPath,
  `${JSON.stringify(
    {
      platform,
      arch,
      expectedInstallerSuffix,
      checks: {
        hasExpectedInstaller: hasExpectedInstaller === 'true',
        hasManifest: hasManifest === 'true',
        hasBlockmap: hasBlockmap === 'true',
        hasZip: hasZip === 'true',
      },
    },
    null,
    2,
  )}\n`,
);
NODE

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Published artifact audit written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
