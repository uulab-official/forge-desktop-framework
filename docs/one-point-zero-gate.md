# Forge 1.0 Release Gate

Forge should ship `1.0.0` only after the framework can prove that the same product surface is stable for new app authors, maintainers, and release operators.

## 1.0 Official Surface

These are the official preset entry points that Forge should treat as frozen support targets for `1.0`:

- `launch-ready`
- `support-ready`
- `ops-ready`
- `document-ready`

These are the public framework entry points that must stay aligned with those presets:

- root `README.md`
- `docs/getting-started.md`
- `docs/deployment.md`
- `packages/create-forge-app/README.md`
- `packages/create-forge-app/` CLI binaries: `create-forge-desktop`, `forge-desktop`

## 1.0 Exit Criteria

### 1. External App Creation Is Real

Forge must prove that a new app can be scaffolded and built outside the monorepo with the published framework surface.

Required guard:

- `pnpm scaffold:external:test`

### 2. Official Presets Are Stable

Forge must keep the official presets release-ready, with their packaging files, publish checks, and generated workflows intact.

Required guard:

- `pnpm release:audit`

### 3. Release Evidence Is Auditable

Forge must keep a versioned checklist, release inventory, manifest audit, signing readiness audit, rollback readiness audit, rollback playbook, matrix summary, and provenance record for every shipped version.

Required guards:

- `pnpm release:checklist:verify patch`
- `pnpm release:artifacts:test`
- `pnpm release:manifests:test`
- `pnpm release:rollback:test`
- `pnpm release:playbook:test`
- `pnpm release:signing:test`
- `pnpm release:matrix:test`
- `pnpm release:provenance:test`

### 4. Recovery Path Is Operational

Forge must prove that archived release bundles can be fetched, indexed, selected, prepared, and drilled across GitHub and S3 recovery paths.

Required guards:

- `pnpm release:bundle:retrieve:test`
- `pnpm release:bundle:fetch:test`
- `pnpm release:bundle:fetch:s3:test`
- `pnpm release:history:test`
- `pnpm release:rollback:target:test`
- `pnpm release:rollback:prepare:test`
- `pnpm release:history:remote:test`
- `pnpm release:rollback:remote:test`

### 5. CI Mirrors The Ship Gate

Forge must catch release regressions on pull requests before maintainers run `release:ship`.

Required surfaces:

- `.github/workflows/ci.yml`
- Ubuntu `release-readiness` job
- `pnpm release:onepointzero:test`
- `pnpm release:status:test`
- `pnpm release:freeze:test`

### 6. Final 1.0 Decision Is Explicit

Forge must emit one final maintainer artifact that turns readiness, release health, and freeze evidence into a single decision handoff.

Required guard:

- `pnpm release:decision:test`

### 7. Release-Candidate Handoff Is Explicit

Forge must emit one final release-candidate handoff that points the current stable line at the `1.0.0` promotion path.

Required guard:

- `pnpm release:rc:test`

### 8. Major Release Checklist Preparation Is Explicit

Forge must provide one reproducible helper that turns the release-candidate handoff into a prefilled `v1.0.0` checklist draft.

Required guard:

- `pnpm release:major:prepare:test`

### 9. Promotion Plan Is Explicit

Forge must emit one final promotion-plan artifact that joins the audited release-candidate handoff with the prepared `v1.0.0` checklist draft.

Required guard:

- `pnpm release:promotion:test`

### 10. Major Release Runbook Is Explicit

Forge must emit one operator-focused runbook artifact that turns the promotion plan into the exact command sequence for the first `1.0.0` ship.

Required guard:

- `pnpm release:major:runbook:test`

### 11. Major Release Approval Is Explicit

Forge must emit one final approval artifact that joins the `1.0` decision, promotion plan, and major-release runbook into the last go/no-go handoff before the first major tag.

Required guard:

- `pnpm release:major:approval:test`

### 12. Major Release Cockpit Is Explicit

Forge must emit one final operator cockpit artifact that condenses readiness, release health, decision, promotion, runbook, and approval into one single-screen `1.0.0` summary.

Required guard:

- `pnpm release:major:cockpit:test`

## 1.0 Maintainer Rule

Before calling Forge `1.0.0`, keep these statements true:

1. The official presets above are the supported starter baselines.
2. The release and recovery audits above pass on `main`.
3. Public docs describe the same story as the CLI and release scripts.
4. New breaking changes require an explicit migration story instead of silent scaffold drift.

## 1.0 Maintainer Commands

Use these commands as the minimum readiness stack before a `1.0` decision:

```bash
pnpm scaffold:external:test
pnpm release:audit
pnpm release:onepointzero:test
pnpm release:status:test
pnpm release:freeze:test
pnpm release:decision:test
pnpm release:rc:test
pnpm release:major:prepare:test
pnpm release:promotion:test
pnpm release:major:runbook:test
pnpm release:major:approval:test
pnpm release:major:cockpit:test
pnpm release:ship patch
pnpm version:check
```
