#!/bin/bash
set -euo pipefail

REPO="${1:-}"
PLATFORM_LABEL="${2:-}"
ARCH_LABEL="${3:-}"
CURRENT_VERSION="${4:-}"
LIMIT="${5:-5}"
HISTORY_ROOT="${6:-}"

if [[ -z "$REPO" || -z "$PLATFORM_LABEL" || -z "$ARCH_LABEL" || -z "$CURRENT_VERSION" ]]; then
  echo "Usage: bash scripts/fetch-release-history-from-github.sh <owner/repo> <platform> <arch> <current-version> [limit] [history-root]"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required: gh"
  exit 1
fi

if ! [[ "$LIMIT" =~ ^[0-9]+$ ]] || [[ "$LIMIT" -le 0 ]]; then
  echo "Limit must be a positive integer"
  exit 1
fi

if [[ "$CURRENT_VERSION" == v* ]]; then
  CURRENT_VERSION="${CURRENT_VERSION#v}"
fi

if [[ -z "$HISTORY_ROOT" ]]; then
  HISTORY_ROOT=".fetched-release-history/github-${PLATFORM_LABEL}-${ARCH_LABEL}-from-v${CURRENT_VERSION}"
fi

rm -rf "$HISTORY_ROOT"
mkdir -p "$HISTORY_ROOT"

RELEASES_JSON="$(
  if [[ -n "${FORGE_RELEASE_HISTORY_TAGS:-}" ]]; then
    node - "$FORGE_RELEASE_HISTORY_TAGS" <<'NODE'
const input = process.argv[2] || '';
const releases = input
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean)
  .map((tagName) => ({ tag_name: tagName, draft: false, prerelease: false }));
process.stdout.write(JSON.stringify(releases));
NODE
  else
    gh api "repos/$REPO/releases?per_page=$LIMIT"
  fi
)"

FETCH_SUMMARY_MD="$HISTORY_ROOT/history-fetch-summary.md"
FETCH_SUMMARY_JSON="$HISTORY_ROOT/history-fetch-summary.json"

RELEASES_JSON_FILE="$HISTORY_ROOT/.releases.json"
printf '%s\n' "$RELEASES_JSON" > "$RELEASES_JSON_FILE"

FETCH_TAGS_FILE="$HISTORY_ROOT/.fetch-tags.txt"
node - "$RELEASES_JSON_FILE" "$CURRENT_VERSION" "$LIMIT" <<'NODE' > "$FETCH_TAGS_FILE"
const fs = require('node:fs');

const [releasesJsonPath, currentVersion, limitRaw] = process.argv.slice(2);
const releases = JSON.parse(fs.readFileSync(releasesJsonPath, 'utf8'));
const limit = Number.parseInt(limitRaw, 10);

const semverTuple = (value) => String(value).replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
const compareSemver = (left, right) => {
  const a = semverTuple(left);
  const b = semverTuple(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

const normalizedCurrent = String(currentVersion).replace(/^v/, '');
const tags = releases
  .filter((release) => !release.draft && !release.prerelease && typeof release.tag_name === 'string')
  .map((release) => release.tag_name)
  .filter((tagName) => /^v?\d+\.\d+\.\d+$/.test(tagName))
  .filter((tagName) => compareSemver(tagName, normalizedCurrent) <= 0)
  .sort((left, right) => compareSemver(right, left))
  .slice(0, limit);

for (const tagName of tags) {
  process.stdout.write(`${tagName}\n`);
}
NODE

SUCCESS_TAGS=()
FAILED_TAGS=()
ATTEMPTED_TAGS=()

while IFS= read -r tag_name; do
  [[ -z "$tag_name" ]] && continue
  ATTEMPTED_TAGS+=("$tag_name")
  TAG_ROOT="$HISTORY_ROOT/$tag_name"
  RETRIEVED_DIR="$TAG_ROOT/retrieved"
  if bash scripts/fetch-release-inventory-bundle-from-github.sh "$REPO" "$tag_name" "$PLATFORM_LABEL" "$ARCH_LABEL" "$RETRIEVED_DIR" "$TAG_ROOT" >/dev/null 2>&1; then
    SUCCESS_TAGS+=("$tag_name")
  else
    FAILED_TAGS+=("$tag_name")
    rm -rf "$TAG_ROOT"
  fi
done < "$FETCH_TAGS_FILE"

if [[ "${#SUCCESS_TAGS[@]}" -eq 0 ]]; then
  echo "No matching GitHub release bundles were fetched for ${PLATFORM_LABEL}/${ARCH_LABEL} at or before v${CURRENT_VERSION}"
  exit 1
fi

bash scripts/generate-release-history-index.sh "$HISTORY_ROOT" "$HISTORY_ROOT"

node - "$FETCH_SUMMARY_MD" "$FETCH_SUMMARY_JSON" "$REPO" "$PLATFORM_LABEL" "$ARCH_LABEL" "$CURRENT_VERSION" "$HISTORY_ROOT" "${SUCCESS_TAGS[*]:-}" "${FAILED_TAGS[*]:-}" "${ATTEMPTED_TAGS[*]:-}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [
  summaryMdPath,
  summaryJsonPath,
  repo,
  platform,
  arch,
  currentVersion,
  historyRoot,
  successTagsRaw,
  failedTagsRaw,
  attemptedTagsRaw,
] = process.argv.slice(2);

const splitTags = (value) => String(value || '').split(' ').map((entry) => entry.trim()).filter(Boolean);
const successTags = splitTags(successTagsRaw);
const failedTags = splitTags(failedTagsRaw);
const attemptedTags = splitTags(attemptedTagsRaw);

const checks = {
  attemptedRemoteTags: attemptedTags.length > 0,
  fetchedAtLeastOneTag: successTags.length > 0,
  historyIndexPresent: fs.existsSync(path.join(historyRoot, 'release-history-index.json')),
};
const status = Object.values(checks).every(Boolean) ? 'passed' : 'failed';

const markdown = [
  '# GitHub Release History Fetch',
  '',
  `- Repo: \`${repo}\``,
  `- Target: \`${platform}/${arch}\``,
  `- Current version ceiling: \`${currentVersion}\``,
  `- Status: \`${status}\``,
  `- History root: \`${historyRoot}\``,
  '',
  '| Check | Status |',
  '| --- | --- |',
  `| Attempted remote tags | ${checks.attemptedRemoteTags} |`,
  `| Fetched at least one tag | ${checks.fetchedAtLeastOneTag} |`,
  `| History index present | ${checks.historyIndexPresent} |`,
  '',
  `- Successful tags: ${successTags.length > 0 ? successTags.map((tag) => `\`${tag}\``).join(', ') : '`none`'}`,
  `- Skipped tags: ${failedTags.length > 0 ? failedTags.map((tag) => `\`${tag}\``).join(', ') : '`none`'}`,
  '',
].join('\n');

const payload = {
  repo,
  platform,
  arch,
  currentVersion,
  historyRoot,
  status,
  checks,
  attemptedTags,
  successTags,
  failedTags,
};

fs.writeFileSync(summaryMdPath, `${markdown}\n`);
fs.writeFileSync(summaryJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

if (status !== 'passed') {
  console.error(`GitHub release history fetch failed for ${repo} ${platform}/${arch}`);
  process.exit(1);
}
NODE

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$FETCH_SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
fi

echo "Fetched GitHub release history:"
echo "  $FETCH_SUMMARY_MD"
echo "  $FETCH_SUMMARY_JSON"
