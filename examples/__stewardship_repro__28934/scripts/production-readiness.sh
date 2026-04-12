#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

REQUIRE_RELEASE_OUTPUT=0
TARGETS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    github|s3)
      TARGETS+=("$1")
      ;;
    --)
      ;;
    --require-release-output)
      REQUIRE_RELEASE_OUTPUT=1
      ;;
    *)
      echo "Unsupported production readiness argument: $1"
      echo "Use github, s3, and optionally --require-release-output."
      exit 1
      ;;
  esac
  shift
done

if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=("github")
fi

RELEASE_DIR="${RELEASE_DIR:-release}"

echo "=== Release preflight ==="
bash scripts/preflight-release.sh

echo "=== Type check ==="
pnpm typecheck

echo "=== Electron security baseline ==="
pnpm security:check

echo "=== Runtime hygiene baseline ==="
pnpm ops:check

echo "=== Operations retention baseline ==="
pnpm ops:retention

snapshot_label="production-$(printf "%s-" "${TARGETS[@]}" | sed "s/-$//")"

if [ -f "worker/main.py" ]; then
  echo "=== Python worker environment ==="
  pnpm setup:python
  echo "=== Worker bundle ==="
  pnpm build:worker
fi

echo "=== Desktop build ==="
pnpm build

for target in "${TARGETS[@]}"; do
  echo "=== Publish preflight (${target}) ==="
  pnpm "publish:check:${target}"

  if [ -d "$RELEASE_DIR" ]; then
    echo "=== Packaged artifact audit (${target}) ==="
    if [ "$target" = "github" ]; then
      pnpm package:verify
      pnpm package:audit
    else
      pnpm package:verify:s3
      pnpm package:audit:s3
    fi
  elif [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
    echo "Release directory not found: $RELEASE_DIR"
    echo "Run pnpm package first or omit --require-release-output."
    exit 1
  else
    echo "Skipping packaged artifact checks for ${target}; ${RELEASE_DIR} does not exist yet."
  fi
done

echo "=== Operations rollback rehearsal (${snapshot_label}) ==="
rollback_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  rollback_args+=(--require-release-output)
fi
pnpm ops:rollback "${rollback_args[@]}"

echo "=== Operations incident packet (${snapshot_label}) ==="
incident_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  incident_args+=(--require-release-output)
fi
pnpm ops:incident "${incident_args[@]}"

echo "=== Operations continuity handoff (${snapshot_label}) ==="
continuity_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  continuity_args+=(--require-release-output)
fi
pnpm ops:continuity "${continuity_args[@]}"

echo "=== Operations runbook (${snapshot_label}) ==="
runbook_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  runbook_args+=(--require-release-output)
fi
pnpm ops:runbook "${runbook_args[@]}"

echo "=== Operations integrity (${snapshot_label}) ==="
integrity_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  integrity_args+=(--require-release-output)
fi
pnpm ops:integrity "${integrity_args[@]}"

echo "=== Operations compliance (${snapshot_label}) ==="
compliance_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  compliance_args+=(--require-release-output)
fi
pnpm ops:compliance "${compliance_args[@]}"

echo "=== Operations assurance (${snapshot_label}) ==="
assurance_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  assurance_args+=(--require-release-output)
fi
pnpm ops:assure "${assurance_args[@]}"

echo "=== Operations governance (${snapshot_label}) ==="
governance_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  governance_args+=(--require-release-output)
fi
pnpm ops:govern "${governance_args[@]}"

echo "=== Operations oversight (${snapshot_label}) ==="
oversight_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  oversight_args+=(--require-release-output)
fi
pnpm ops:oversight "${oversight_args[@]}"

echo "=== Operations control (${snapshot_label}) ==="
control_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  control_args+=(--require-release-output)
fi
pnpm ops:control "${control_args[@]}"

echo "=== Operations authority (${snapshot_label}) ==="
authority_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  authority_args+=(--require-release-output)
fi
pnpm ops:authority "${authority_args[@]}"

echo "=== Operations stewardship (${snapshot_label}) ==="
stewardship_args=(-- --label "$snapshot_label" --skip-retention)
if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then
  stewardship_args+=(--require-release-output)
fi
pnpm ops:stewardship "${stewardship_args[@]}"

echo "Production readiness checks passed for: ${TARGETS[*]}"
