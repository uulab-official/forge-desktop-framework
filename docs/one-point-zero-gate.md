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
pnpm release:ship patch
pnpm version:check
```
