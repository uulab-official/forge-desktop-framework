# Codex Project Notes

## Current Direction
Forge should feel like a productized framework:
- clear scaffolding entry point
- examples as authoritative patterns
- docs that match the CLI
- build/release flows that match the real monorepo layout

## Current Gaps
- onboarding still centers on cloning the monorepo instead of the scaffold CLI
- template behavior is split between `examples/` and copied templates
- release and publish code can drift from actual workspace paths
- repo-outside scaffold install and build flows still need explicit release verification
- docs sometimes describe packaging output paths incorrectly

## Change Standard
When a task touches one of these surfaces, check the others before finishing:
1. CLI behavior in `packages/create-forge-app/`
2. docs in `docs/` and root `README.md`
3. examples in `examples/`
4. template copies in `packages/create-forge-app/templates/`
5. repo version and changelog

## Versioning Rule
- Every completed framework enhancement bumps the version.
- Default bump: `patch`
- Use `minor` for new user-facing capabilities and `major` for breaking changes.
- Prefer `scripts/ship-release.sh` when a framework change is ready to validate, version, commit, tag, and push as one release unit.
- Create the next version checklist in `docs/release-checklists/` before shipping, and mark it `ready` before `release:ship`.
- Use `pnpm release:audit` when you need a quick maintainer check that the official presets still scaffold the expected release files, scripts, and workflow surface.
- Treat the Ubuntu `release-readiness` CI path as the pre-merge mirror of `release:ship`: external scaffold installs, official preset release-surface audit, and rollback target selection smoke should stay green there too.
- Treat tagged release jobs as auditable surfaces too: signing-readiness, publish-audit, manifest-audit, publish-channel-parity, rollback-readiness, rollback-playbooks, channel-recovery, per-platform summaries, the final matrix summary, and release provenance should stay aligned with the actual installer and manifest outputs.
- Treat rollback drills against archived release metadata as the maintainer-side proof that a candidate rollback target still matches the generated playbook before you change any live release channel.
- Keep archived release inventory bundles stable because they are becoming the canonical input shape for future rollback drills and release retrieval tooling.
- Retrieval helpers should resolve archived bundles by platform, arch, and version before any rollback drill tries to interpret loose release files.
- Bundle index generation should stay in step with retrieval helpers so archived rollback target discovery does not depend on manual artifact browsing.
- Release history indexing should stay in step with remote fetch helpers so multi-tag rollback discovery does not depend on ad hoc folder inspection.
- Rollback target selectors should stay in step with the bundle index so maintainers can automatically choose the newest valid prior version for a recovery mode.
- History-root rollback preparation should stay in step with both selectors and retrieval helpers so maintainers can go from accumulated archives to a drill-ready bundle without manual path stitching.
- Remote GitHub artifact fetch helpers should restore the same archive shape locally so rollback drills do not depend on ad hoc artifact download steps.
- Object-storage mirrors should preserve that same archive shape and bundle metadata so `aws`-based retrieval paths stay equivalent to GitHub artifact fetches.
- Keep `examples/*`, `apps/*`, and `packages/*` on the same version line.

## Near-Term Priorities
1. Make `create-forge-desktop` the clean entry point for new users.
2. Reduce mismatch between "reference example" and "official template".
3. Harden release and publish commands against real workspace structure and repo-outside installs.
4. Add project-specific Codex playbooks so repeated framework work is consistent.
