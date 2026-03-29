#!/bin/bash
set -euo pipefail

RELEASE_DIR="${1:-apps/app/release}"
PLATFORM_LABEL="${2:-unknown}"
ARCH_LABEL="${3:-default}"

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release directory not found: $RELEASE_DIR"
  exit 1
fi

APP_DIR="$(cd "$RELEASE_DIR/.." && pwd)"
APP_VERSION="$(node -p "require('$APP_DIR/package.json').version")"
SUMMARY_MD="$RELEASE_DIR/artifact-summary.md"
SUMMARY_JSON="$RELEASE_DIR/artifact-summary.json"

cd "$RELEASE_DIR"

size_bytes() {
  local file="$1"
  if stat -f%z "$file" >/dev/null 2>&1; then
    stat -f%z "$file"
  else
    stat -c%s "$file"
  fi
}

human_size() {
  local bytes="$1"
  node -e "const value = Number(process.argv[1]); const units = ['B','KB','MB','GB']; let i = 0; let size = value; while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1; } console.log(\`\${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} \${units[i]}\`);" "$bytes"
}

FILES=()
while IFS= read -r file; do
  FILES+=("$file")
done < <(find . -maxdepth 1 -type f ! -name 'artifact-summary.*' | sed 's|^\./||' | sort)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No release artifacts found in $RELEASE_DIR"
  exit 1
fi

MANIFEST_COUNT=0
INSTALLER_COUNT=0

{
  echo "# Release Artifact Summary"
  echo
  echo "- Version: \`$APP_VERSION\`"
  echo "- Platform: \`$PLATFORM_LABEL\`"
  echo "- Arch: \`$ARCH_LABEL\`"
  echo "- Release dir: \`$RELEASE_DIR\`"
  echo
  echo "| File | Size | Kind |"
  echo "| --- | ---: | --- |"
} > "$SUMMARY_MD"

JSON_ITEMS=""

for file in "${FILES[@]}"; do
  bytes="$(size_bytes "$file")"
  pretty="$(human_size "$bytes")"
  kind="artifact"

  if [[ "$file" == latest*.yml ]]; then
    kind="manifest"
    MANIFEST_COUNT=$((MANIFEST_COUNT + 1))
  elif [[ "$file" == *.dmg || "$file" == *.exe || "$file" == *.msi || "$file" == *.AppImage || "$file" == *.zip ]]; then
    kind="installer"
    INSTALLER_COUNT=$((INSTALLER_COUNT + 1))
  fi

  echo "| \`$file\` | $pretty | $kind |" >> "$SUMMARY_MD"

  escaped_file="$(node -e "console.log(JSON.stringify(process.argv[1]))" "$file")"
  escaped_kind="$(node -e "console.log(JSON.stringify(process.argv[1]))" "$kind")"
  JSON_ITEMS="${JSON_ITEMS}    {\"file\": ${escaped_file}, \"sizeBytes\": ${bytes}, \"kind\": ${escaped_kind}},\n"
done

{
  echo
  echo "## Totals"
  echo
  echo "- Files: ${#FILES[@]}"
  echo "- Installers: $INSTALLER_COUNT"
  echo "- Manifests: $MANIFEST_COUNT"
} >> "$SUMMARY_MD"

if [ "$INSTALLER_COUNT" -eq 0 ]; then
  echo "No installer artifacts found in $RELEASE_DIR"
  exit 1
fi

if [ "$MANIFEST_COUNT" -eq 0 ]; then
  echo "No latest*.yml manifest found in $RELEASE_DIR"
  exit 1
fi

node - "$SUMMARY_JSON" "$APP_VERSION" "$PLATFORM_LABEL" "$ARCH_LABEL" <<'NODE'
const fs = require('node:fs');

const [summaryJsonPath, version, platform, arch] = process.argv.slice(2);
const markdown = fs.readFileSync('artifact-summary.md', 'utf8');
const rows = markdown
  .split('\n')
  .filter((line) => line.startsWith('| `'))
  .map((line) => {
    const parts = line.split('|').map((part) => part.trim());
    return {
      file: parts[1].replaceAll('`', ''),
      size: parts[2],
      kind: parts[3],
    };
  });

const totals = {
  files: rows.length,
  installers: rows.filter((row) => row.kind === 'installer').length,
  manifests: rows.filter((row) => row.kind === 'manifest').length,
};

fs.writeFileSync(summaryJsonPath, `${JSON.stringify({ version, platform, arch, totals, artifacts: rows }, null, 2)}\n`);
NODE

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Release artifact summary written to:"
echo "  $SUMMARY_MD"
echo "  $SUMMARY_JSON"
