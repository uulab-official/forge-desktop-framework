# __stewardship_repro__28934

Bare minimum app — one input, one Python action

Generated with `create-forge-desktop@0.1.150` using the `minimal` template.

## Release Identity

- Product name: `Stewardship Repro 28934`
- App ID: `com.forge.stewardshiprepro28934`

## Enabled Feature Packs

- `settings`
- `updater`
- `jobs`
- `plugins`
- `diagnostics`
- `notifications`
- `windowing`
- `menu-bar`
- `support-bundle`
- `log-archive`
- `incident-report`
- `diagnostics-timeline`
- `crash-recovery`
- `system-info`
- `network-status`
- `power-monitor`
- `idle-presence`
- `session-state`
- `file-association`
- `file-dialogs`
- `recent-files`

Feature packs currently target the `minimal` starter and are wired into the generated runtime shell.

## Quick Start

```bash
pnpm install
python3 -m pip install -r worker/requirements.txt
pnpm dev
```

If `python3` is not available on your system, use `python -m pip install -r worker/requirements.txt` instead.

## What You Get

- Template: `Minimal`
- Focus: Best for learning the core architecture
- Electron + React renderer
- Vendored Python worker runtime in `worker/forge_worker`
- Vite-based local development
- Release preset with electron-builder and worker packaging scripts
- GitHub Actions validation and tagged release workflows

## Common Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm release:check
pnpm security:check
pnpm ops:check
pnpm ops:snapshot
pnpm ops:evidence
pnpm ops:report
pnpm ops:bundle
pnpm ops:index
pnpm ops:doctor
pnpm ops:handoff
pnpm ops:attest
pnpm ops:ready
pnpm ops:gate
pnpm ops:releasepack
pnpm ops:export
pnpm ops:restore
pnpm ops:recover
pnpm ops:rollback
pnpm ops:incident
pnpm ops:escalate
pnpm ops:continuity
pnpm ops:resilience
pnpm ops:runbook
pnpm ops:integrity
pnpm ops:compliance
pnpm ops:certify
pnpm ops:assure
pnpm ops:govern
pnpm ops:oversight
pnpm ops:control
pnpm ops:authority
pnpm ops:stewardship
pnpm ops:retention
pnpm production:check
pnpm setup:python
pnpm build:worker
pnpm package
```

## Release Checklist

- Verify the app in development mode with `pnpm dev`
- Install any extra Python dependencies into `worker/requirements.txt`
- Prepare the worker environment with `pnpm setup:python`
- Copy `.env.example` to `.env` and fill in release metadata
- Add GitHub Actions secrets before pushing a release tag
- Run `pnpm release:check` to verify release prerequisites
- Run `pnpm security:check` to confirm the Electron shell still matches the framework security baseline
- Run `pnpm ops:check` to confirm log retention and crash-dump retention still match the production baseline
- Run `pnpm ops:snapshot` when you want an operator-facing JSON and Markdown snapshot of the current release surface
- Run `pnpm ops:evidence` when you want a reusable evidence bundle with the latest ops snapshot, release manifests, and production docs
- Run `pnpm ops:report` when you want one operator-facing report that summarizes the latest snapshot, evidence bundle, index, and release output surface
- Run `pnpm ops:bundle` when you want one portable archive with the latest snapshot, evidence bundle, report, docs, env template, and release manifest inventory
- Run `pnpm ops:index` when you want one inventory view of the current `ops/snapshots/`, `ops/evidence/`, `ops/reports/`, `ops/bundles/`, `ops/doctors/`, `ops/handoffs/`, `ops/attestations/`, `ops/ready/`, `ops/gates/`, `ops/releasepacks/`, `ops/exports/`, `ops/restores/`, `ops/recoveries/`, `ops/rollbacks/`, `ops/incidents/`, `ops/escalations/`, `ops/continuity/`, `ops/resilience/`, `ops/runbooks/`, `ops/integrity/`, `ops/compliance/`, `ops/certifications/`, `ops/assurances/`, `ops/governance/`, `ops/oversight/`, `ops/control/`, `ops/authority/`, and `ops/stewardship/` directories
- Run `pnpm ops:doctor` when you want one final JSON and Markdown verdict that the latest ops surfaces are present and aligned before handoff or publish
- Run `pnpm ops:handoff` when you want one portable operator handoff package built from the latest doctor, bundle, report, docs, env template, and release manifests
- Run `pnpm ops:attest` when you want one checksum-backed Markdown and JSON attestation for the latest bundle, handoff, ready surface, and release output under `ops/attestations/`
- Run `pnpm ops:ready` when you want one production-grade command that refreshes snapshot, evidence, report, bundle, index, doctor, refreshed index, handoff, attestation, and final ready verdict under `ops/ready/`
- Run `pnpm ops:gate` when you want one final Markdown and JSON go or no-go verdict under `ops/gates/` that proves the latest ready, handoff, attestation, index, and release surface are aligned for operator sign-off
- Run `pnpm ops:releasepack` when you want one final portable release-evidence directory and tarball under `ops/releasepacks/` that packages the latest gate, handoff, attestation, ready, index, docs, env template, and packaged release output for operator sign-off or escalation
- Run `pnpm ops:export` when you want one final offline-friendly export directory and tarball under `ops/exports/` that packages the latest release pack, gate, handoff, attestation, ready, index, docs, env template, and packaged release output for operator handoff outside CI
- Run `pnpm ops:restore` when you want one final restore rehearsal under `ops/restores/` that rehydrates the latest offline export, verifies the restored payload, and leaves a Markdown and JSON proof before operator handoff outside CI
- Run `pnpm ops:recover` when you want one final recovery rehearsal under `ops/recoveries/` that proves the latest restore record, gate verdict, and packaged payload are coherent enough for operator-driven recovery handoff
- Run `pnpm ops:rollback` when you want one final rollback rehearsal under `ops/rollbacks/` that turns the latest recovery proof into an operator-facing rollback go or no-go record
- Run `pnpm ops:incident` when you want one final incident-response packet under `ops/incidents/` that packages the latest rollback verdict, proof chain, handoff surface, and release evidence into one portable operator escalation bundle
- Run `pnpm ops:escalate` when you want one final operator escalation package under `ops/escalations/` that turns the latest incident packet, attestation, and release proof chain into a portable escalation handoff
- Run `pnpm ops:continuity` when you want one final business-continuity handoff under `ops/continuity/` that packages the latest escalation, recovery chain, export surface, and release proof into one portable continuity packet
- Run `pnpm ops:resilience` when you want one final resilience packet under `ops/resilience/` that packages the latest continuity handoff, escalation packet, recovery chain, gate verdict, attestation, and release proof into one portable disaster-recovery handoff
- Run `pnpm ops:runbook` when you want one final operator runbook under `ops/runbooks/` that packages the latest resilience handoff, continuity chain, escalation packet, rollback proof, gate verdict, attestation, and release evidence into one portable recovery execution guide
- Run `pnpm ops:integrity` when you want one final integrity packet under `ops/integrity/` that verifies the latest runbook, resilience chain, rollback proof, gate verdict, attestation, and release evidence still agree before operator sign-off
- Run `pnpm ops:compliance` when you want one final compliance packet under `ops/compliance/` that packages the latest integrity packet, runbook, resilience chain, gate verdict, attestation, release evidence, and operator docs into one final audit-ready handoff
- Run `pnpm ops:certify` when you want one final ship certificate under `ops/certifications/` that packages the latest compliance packet, integrity packet, gate verdict, attestation, release evidence, and operator docs into one final production sign-off handoff
- Run `pnpm ops:assure` when you want one final assurance packet under `ops/assurances/` that packages the latest certification packet, compliance verdict, integrity verdict, release evidence, and operator docs into one last production assurance handoff
- Run `pnpm ops:govern` when you want one final governance packet under `ops/governance/` that packages the latest assurance packet, certification chain, release evidence, and operator docs into one last production governance handoff
- Run `pnpm ops:oversight` when you want one final oversight packet under `ops/oversight/` that packages the latest governance packet, assurance chain, release evidence, and operator docs into one last production oversight handoff
- Run `pnpm ops:control` when you want one final control packet under `ops/control/` that packages the latest oversight packet, governance chain, release evidence, operator docs, and env template into one last production control handoff
- Run `pnpm ops:authority` when you want one final authority packet under `ops/authority/` that packages the latest control packet, oversight packet, governance chain, release evidence, operator docs, and env template into one last production authority handoff
- Run `pnpm ops:stewardship` when you want one final stewardship packet under `ops/stewardship/` that packages the latest authority packet, control packet, oversight chain, governance chain, release evidence, operator docs, and env template into one last production stewardship handoff
- Run `pnpm ops:retention` to prune old `ops/snapshots/`, `ops/evidence/`, `ops/index/`, `ops/reports/`, `ops/bundles/`, `ops/doctors/`, `ops/handoffs/`, `ops/attestations/`, `ops/ready/`, `ops/gates/`, `ops/releasepacks/`, `ops/exports/`, `ops/restores/`, `ops/recoveries/`, `ops/rollbacks/`, `ops/incidents/`, `ops/escalations/`, `ops/continuity/`, `ops/resilience/`, `ops/runbooks/`, `ops/integrity/`, `ops/compliance/`, `ops/certifications/`, `ops/assurances/`, `ops/governance/`, `ops/oversight/`, `ops/control/`, `ops/authority/`, and `ops/stewardship/` directories before or after repeated production checks
- Run `pnpm production:check` for the default GitHub channel, or `pnpm production:check:all -- --require-release-output` after packaging when you need a full multi-channel audit
- Build the bundled worker with `pnpm build:worker`
- Package the desktop app with `pnpm package`

Detailed release steps live in `docs/release-playbook.md` and `docs/production-readiness.md`.

## Template Notes

The simplest possible Forge Desktop app. Demonstrates the core architecture:

1. **React renderer** — text input + button
2. **Electron main** — bridges IPC between renderer and Python
3. **Python worker** — reverses a string via stdin/stdout JSON

## Quick Start

```bash
pnpm install
pnpm dev
```

## Architecture

```
Renderer (React)
  ↓ ipcRenderer.invoke('worker:execute', { action: 'reverse', payload: { text } })
Electron Main
  ↓ workerClient.execute(request)
Python Worker (stdin/stdout JSON)
  ↓ dispatcher → actions/reverse.py
  ↑ { success: true, data: { reversed: "..." } }
```

## Adding a New Action

1. Create `worker/actions/my_action.py`
2. Use the `@register("my_action")` decorator
3. Import it in `worker/actions/__init__.py`
4. Call from renderer: `window.api.execute({ action: 'my_action', payload: {...} })`
