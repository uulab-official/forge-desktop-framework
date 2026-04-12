# Authority Repro 26172 Production Readiness

Use these commands when you want one repeatable production-grade check before tagging or publishing a desktop release.

## Default GitHub Release Path

```bash
pnpm security:check
pnpm ops:check
pnpm ops:retention -- --keep 3
pnpm production:check
pnpm package
pnpm ops:stewardship -- --label github-readiness --require-release-output
```

## Generic or S3 Update Channel

```bash
pnpm security:check
pnpm ops:check
pnpm ops:retention -- --keep 3
pnpm production:check:s3
pnpm package:s3
pnpm ops:stewardship -- --label s3-readiness --require-release-output
```

## Full Multi-Channel Audit

```bash
pnpm security:check
pnpm ops:check
pnpm ops:retention -- --keep 3
pnpm production:check:all
pnpm package
pnpm ops:stewardship -- --label full-audit --require-release-output
```

## Standalone Attestation

```bash
pnpm ops:attest -- --label release-attestation --require-release-output
```

Use `pnpm ops:attest` when you want one checksum-backed Markdown and JSON inventory for the latest bundle, handoff, ready surface, and packaged release output without rerunning the whole `ops:ready` chain.

## Final Rollback Rehearsal

```bash
pnpm ops:rollback -- --label release-rollback --require-release-output
```

Use `pnpm ops:rollback` when you want one final rollback rehearsal under `ops/rollbacks/` that reruns the latest recovery proof, confirms the restored payload still matches the gate and export surfaces, and leaves a Markdown and JSON rollback verdict after the packaged release output is in place.

## Final Incident Packet

```bash
pnpm ops:incident -- --label release-incident --require-release-output
```

Use `pnpm ops:incident` when you want one final incident-response packet under `ops/incidents/` that packages the latest rollback verdict, proof chain, handoff surface, and release evidence into one portable operator escalation bundle.

## Final Escalation Handoff

```bash
pnpm ops:escalate -- --label release-escalation --require-release-output
```

Use `pnpm ops:escalate` when you want one final operator escalation handoff under `ops/escalations/` that packages the latest incident packet, attestation, gate verdict, release pack, export, rollback proof, and release evidence into one portable escalation packet.

## Final Continuity Handoff

```bash
pnpm ops:continuity -- --label release-continuity --require-release-output
```

Use `pnpm ops:continuity` when you want one final business-continuity handoff under `ops/continuity/` that packages the latest escalation packet, recovery chain, export surface, attestation, gate verdict, and release evidence into one portable continuity packet.

## Final Resilience Handoff

```bash
pnpm ops:resilience -- --label release-resilience --require-release-output
```

Use `pnpm ops:resilience` when you want one final disaster-recovery handoff under `ops/resilience/` that packages the latest continuity handoff, escalation packet, recovery chain, gate verdict, attestation, and release evidence into one portable resilience packet.

## Final Operator Runbook

```bash
pnpm ops:runbook -- --label release-runbook --require-release-output
```

Use `pnpm ops:runbook` when you want one final operator runbook under `ops/runbooks/` that packages the latest resilience handoff, continuity chain, escalation packet, rollback proof, gate verdict, attestation, and release evidence into one portable recovery execution guide.

## Final Integrity Packet

```bash
pnpm ops:integrity -- --label release-integrity --require-release-output
```

Use `pnpm ops:integrity` when you want one final integrity packet under `ops/integrity/` that verifies the latest runbook, resilience chain, rollback proof, gate verdict, attestation, and release evidence still agree before operator sign-off.

## Final Certification Packet

```bash
pnpm ops:certify -- --label release-certification --require-release-output
```

Use `pnpm ops:certify` when you want one final ship certificate under `ops/certifications/` that packages the latest compliance packet, integrity packet, gate verdict, attestation, release evidence, and operator docs into one final production sign-off handoff.

## Final Assurance Packet

```bash
pnpm ops:assure -- --label release-assurance --require-release-output
```

Use `pnpm ops:assure` when you want one final production assurance packet under `ops/assurances/` that packages the latest certification packet, compliance verdict, integrity verdict, release evidence, and operator docs into one last operator-facing approval handoff.

## Final Governance Packet

```bash
pnpm ops:govern -- --label release-governance --require-release-output
```

Use `pnpm ops:govern` when you want one final production governance packet under `ops/governance/` that packages the latest assurance packet, certification and compliance verdicts, integrity verdict, docs, env template, and packaged release output into one final production ship record.

## Final Oversight Packet

```bash
pnpm ops:oversight -- --label release-oversight --require-release-output
```

Use `pnpm ops:oversight` when you want one final production oversight packet under `ops/oversight/` that packages the latest governance packet, assurance chain, release evidence, docs, env template, and packaged release output into one final production oversight record.

## Final Control Packet

```bash
pnpm ops:control -- --label release-control --require-release-output
```

Use `pnpm ops:control` when you want one final production control packet under `ops/control/` that packages the latest oversight packet, governance chain, assurance chain, release evidence, docs, env template, and packaged release output into one last operator-facing control handoff.

## Final Authority Packet

```bash
pnpm ops:authority -- --label release-authority --require-release-output
```

Use `pnpm ops:authority` when you want one final production authority packet under `ops/authority/` that packages the latest control packet, oversight packet, governance chain, assurance chain, release evidence, docs, env template, and packaged release output into one final operator-facing authority handoff.

## Final Stewardship Packet

```bash
pnpm ops:stewardship -- --label release-stewardship --require-release-output
```

Use `pnpm ops:stewardship` when you want one final production stewardship packet under `ops/stewardship/` that packages the latest authority packet, control packet, oversight chain, governance chain, assurance chain, release evidence, docs, env template, and packaged release output into one final operator-facing stewardship handoff.

## What Gets Checked

- Release preflight files and metadata
- Electron security baseline in `electron/main.ts` and `electron/preload.ts`
- Runtime hygiene baseline for log retention and crash-dump retention in `electron/main.ts`
- Operations retention baseline so repeated production checks keep only the most recent snapshot, evidence, report, bundle, index, doctor, handoff, attestation, ready, gate, release pack, export, restore, recover, rollback, incident, escalation, continuity, resilience, runbook, integrity, compliance, certification, assurance, governance, oversight, control, authority, and stewardship directories by default
- Operations report under `ops/reports/` so operators get one consolidated Markdown and JSON handoff for the latest production audit state
- Operations bundle under `ops/bundles/` so operators can hand off one portable tarball with the latest production evidence set
- Operations index under `ops/index/` so operators can inspect the current snapshot, evidence, report, bundle, doctor, handoff, attestation, and ready inventory in one Markdown and JSON surface
- Operations doctor under `ops/doctors/` so operators get one final Markdown and JSON verdict that the latest ops surfaces are present and aligned before handoff or publish
- Operations handoff under `ops/handoffs/` so operators get one portable Markdown, JSON, and tarball handoff package built from the latest doctor, bundle, report, docs, env template, and release manifests
- Operations attestation under `ops/attestations/` so operators get one checksum-backed Markdown and JSON inventory for the latest bundle, handoff, ready surface, and release output
- Operations ready summary under `ops/ready/` so operators get one final Markdown and JSON production verdict that refreshes the full ops chain, including attestation, in one command
- Operations gate under `ops/gates/` so operators get one final Markdown and JSON go/no-go verdict that proves the latest ready, handoff, attestation, index, and release output are aligned
- Operations release pack under `ops/releasepacks/` so operators still get one intermediate portable tarball and evidence directory that includes the latest gate, handoff, attestation, ready, docs, env template, and packaged release output
- Operations export under `ops/exports/` so operators get one final offline-friendly tarball and evidence directory that packages the latest release pack plus the final gate, handoff, attestation, ready, index, docs, env template, and packaged release output
- Operations restore rehearsal under `ops/restores/` so operators still get one final Markdown and JSON proof that the latest offline export can be unpacked and verified outside CI artifacts before handoff
- Operations recovery rehearsal under `ops/recoveries/` so operators get one final Markdown and JSON proof that the latest restore record, gate verdict, and packaged payload are coherent enough for a recovery handoff
- Operations rollback rehearsal under `ops/rollbacks/` so operators get one final Markdown and JSON rollback go or no-go record built from the latest recovery proof before sign-off
- Operations incident packet under `ops/incidents/` so operators get one final Markdown, JSON, and tarball escalation bundle built from the latest rollback proof, handoff, and release evidence before sign-off
- Operations escalation handoff under `ops/escalations/` so operators get one final Markdown, JSON, and tarball escalation packet built from the latest incident packet, attestation, gate verdict, export, rollback proof, and release evidence before external handoff
- Operations continuity handoff under `ops/continuity/` so operators get one final Markdown, JSON, and tarball continuity packet built from the latest escalation packet, recovery chain, export surface, attestation, gate verdict, and release evidence before business-continuity handoff
- Operations resilience handoff under `ops/resilience/` so operators get one final Markdown, JSON, and tarball disaster-recovery packet built from the latest continuity handoff, escalation packet, recovery chain, gate verdict, attestation, and release evidence before final recovery sign-off
- Operations runbook under `ops/runbooks/` so operators get one final Markdown, JSON, and tarball recovery execution guide built from the latest resilience handoff, continuity chain, escalation packet, rollback proof, gate verdict, attestation, and release evidence before final operator handoff
- Operations integrity under `ops/integrity/` so operators get one final Markdown, JSON, and tarball integrity packet that verifies the latest runbook, resilience chain, rollback proof, gate verdict, attestation, and release evidence still agree before final sign-off
- Operations compliance under `ops/compliance/` so auditors and release approvers get one final Markdown, JSON, and tarball packet that packages the latest integrity packet, runbook, resilience chain, gate verdict, attestation, docs, and release evidence into one audit-ready handoff
- Operations certification under `ops/certifications/` so production approvers get one final Markdown, JSON, and tarball ship certificate that packages the latest compliance packet, integrity packet, gate verdict, attestation, docs, and release evidence into one production sign-off handoff
- Operations assurance under `ops/assurances/` so production approvers get one final Markdown, JSON, and tarball assurance packet that packages the latest certification packet, compliance verdict, integrity verdict, docs, and release evidence into one last production approval handoff
- Operations governance under `ops/governance/` so production approvers get one final Markdown, JSON, and tarball governance packet that packages the latest assurance packet, certification and compliance verdicts, integrity verdict, docs, env template, and packaged release output into one final production ship record
- Operations oversight under `ops/oversight/` so production approvers get one final Markdown, JSON, and tarball oversight packet that packages the latest governance packet, assurance chain, docs, env template, and packaged release output into one final production oversight record
- Operations control under `ops/control/` so production operators get one final Markdown, JSON, and tarball control packet that packages the latest oversight packet, governance chain, release evidence, docs, env template, and packaged release output into one last operator-facing control handoff
- Operations authority under `ops/authority/` so production operators get one final Markdown, JSON, and tarball authority packet that packages the latest control packet, oversight packet, governance chain, release evidence, docs, env template, and packaged release output into one last operator-facing authority handoff
- Operations stewardship under `ops/stewardship/` so production operators get one final Markdown, JSON, and tarball stewardship packet that packages the latest authority packet, control packet, oversight chain, governance chain, release evidence, docs, env template, and packaged release output into one last operator-facing stewardship handoff
- Operator-facing Markdown and JSON operations snapshot under `ops/snapshots/`
- Reusable operations evidence bundle under `ops/evidence/` with the latest snapshot, production docs, env template, and release manifest inventory
- TypeScript typecheck
- Python worker environment and bundled worker build
- Electron renderer and main-process build
- Publish environment variables for the requested channel
- Packaged installer and updater manifest verification when `release/` exists

If you only want to validate source and environment state before packaging, omit `--require-release-output`.
