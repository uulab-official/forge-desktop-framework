#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"

KEEP="${OPS_RETENTION_KEEP:-10}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --keep"
        exit 1
      fi
      KEEP="$1"
      ;;
    --)
      ;;
    *)
      echo "Unsupported ops retention argument: $1"
      echo "Use --keep <count>."
      exit 1
      ;;
  esac
  shift
done

case "$KEEP" in
  ""|*[!0-9]*)
    echo "Retention keep value must be a non-negative integer. Got: $KEEP"
    exit 1
    ;;
esac

prune_root() {
  local root_dir="$1"
  local keep_count="$2"
  local label="$3"

  mkdir -p "$root_dir"

  local entries=()
  while IFS= read -r entry; do
    entries+=("$entry")
  done < <(find "$root_dir" -mindepth 1 -maxdepth 1 -type d -print | sort -r)
  local total="${#entries[@]}"

  if [ "$total" -le "$keep_count" ]; then
    echo "Retention OK for ${label}: keeping ${total}/${keep_count} directories."
    return 0
  fi

  local removed=0
  for ((index=keep_count; index<total; index++)); do
    rm -rf "${entries[$index]}"
    removed=$((removed + 1))
  done

  echo "Pruned ${removed} ${label} director$( [ "$removed" -eq 1 ] && echo "y" || echo "ies" ); kept ${keep_count}."
}

prune_root "${OPS_SNAPSHOT_DIR:-ops/snapshots}" "$KEEP" "ops snapshot"
prune_root "${OPS_EVIDENCE_DIR:-ops/evidence}" "$KEEP" "ops evidence"
prune_root "${OPS_REPORT_DIR:-ops/reports}" "$KEEP" "ops report"
prune_root "${OPS_BUNDLE_DIR:-ops/bundles}" "$KEEP" "ops bundle"
prune_root "${OPS_INDEX_DIR:-ops/index}" "$KEEP" "ops index"
prune_root "${OPS_DOCTOR_DIR:-ops/doctors}" "$KEEP" "ops doctor"
prune_root "${OPS_HANDOFF_DIR:-ops/handoffs}" "$KEEP" "ops handoff"
prune_root "${OPS_ATTESTATION_DIR:-ops/attestations}" "$KEEP" "ops attestation"
prune_root "${OPS_READY_DIR:-ops/ready}" "$KEEP" "ops ready"
prune_root "${OPS_GATE_DIR:-ops/gates}" "$KEEP" "ops gate"
prune_root "${OPS_RELEASEPACK_DIR:-ops/releasepacks}" "$KEEP" "ops release pack"
prune_root "${OPS_EXPORT_DIR:-ops/exports}" "$KEEP" "ops export"
prune_root "${OPS_RESTORE_DIR:-ops/restores}" "$KEEP" "ops restore"
prune_root "${OPS_RECOVER_DIR:-ops/recoveries}" "$KEEP" "ops recover"
prune_root "${OPS_ROLLBACK_DIR:-ops/rollbacks}" "$KEEP" "ops rollback"
prune_root "${OPS_INCIDENT_DIR:-ops/incidents}" "$KEEP" "ops incident"
prune_root "${OPS_ESCALATE_DIR:-ops/escalations}" "$KEEP" "ops escalation"
prune_root "${OPS_CONTINUITY_DIR:-ops/continuity}" "$KEEP" "ops continuity"
prune_root "${OPS_RESILIENCE_DIR:-ops/resilience}" "$KEEP" "ops resilience"
prune_root "${OPS_RUNBOOK_DIR:-ops/runbooks}" "$KEEP" "ops runbook"
prune_root "${OPS_INTEGRITY_DIR:-ops/integrity}" "$KEEP" "ops integrity"
prune_root "${OPS_COMPLIANCE_DIR:-ops/compliance}" "$KEEP" "ops compliance"
prune_root "${OPS_CERTIFY_DIR:-ops/certifications}" "$KEEP" "ops certification"
prune_root "${OPS_ASSURE_DIR:-ops/assurances}" "$KEEP" "ops assurance"
prune_root "${OPS_GOVERN_DIR:-ops/governance}" "$KEEP" "ops governance"
prune_root "${OPS_OVERSIGHT_DIR:-ops/oversight}" "$KEEP" "ops oversight"
prune_root "${OPS_CONTROL_DIR:-ops/control}" "$KEEP" "ops control"
prune_root "${OPS_AUTHORITY_DIR:-ops/authority}" "$KEEP" "ops authority"
prune_root "${OPS_STEWARDSHIP_DIR:-ops/stewardship}" "$KEEP" "ops stewardship"

echo "Operations retention checks passed (keep=${KEEP})."
