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
- Remote multi-version history fetch wrappers should stay in step with both GitHub and S3 single-tag fetch helpers so maintainer recovery paths do not fork by provider.
- The final remote rollback drill wrapper should stay in step with both provider-specific history wrappers and the local rollback drill so the maintainer recovery path remains one coherent product surface.
- The recovery-command summary should stay in step with the final remote rollback drill wrapper so maintainers can trust the emitted rerun command, selected rollback target, and next actions.
- The explicit `1.0` gate document should stay in step with release guards, CI, and public docs so Forge does not claim a stable product surface without a matching audit trail.
- The final `release-status` artifact should stay in step with the 1.0 gate, matrix summary, and provenance so maintainers always have one condensed release-health view.
- The final `one-point-zero-freeze` artifact should stay in step with both release-status and checklist formatting so the go/no-go decision remains reproducible.
- The final `one-point-zero-decision` artifact should stay in step with readiness, release-status, and freeze outputs so the last 1.0 handoff does not depend on manual interpretation.
- The final `one-point-zero-release-candidate` artifact should stay in step with the decision output so the `1.0.0` promotion path and next checklist target remain explicit.
- The `prepare-one-point-zero-major-checklist` helper should stay in step with the release-candidate artifact so the generated `v1.0.0` checklist draft does not drift from the audited promotion path.
- The final `one-point-zero-promotion-plan` artifact should stay in step with both the release-candidate output and prepared `v1.0.0` checklist so the first major-release staging handoff remains reproducible.
- The final `one-point-zero-major-release-runbook` artifact should stay in step with the promotion plan so the first `1.0.0` ship sequence remains reproducible and operator-friendly.
- The final `one-point-zero-major-release-approval` artifact should stay in step with the decision, promotion plan, and major-runbook layers so the first `1.0.0` approval handoff remains reproducible.
- The final `one-point-zero-major-release-cockpit` artifact should stay in step with readiness, release-status, decision, promotion, runbook, and approval outputs so the first `1.0.0` operator view remains reproducible.
- The final `one-point-zero-major-release-packet` artifact should stay in step with the cockpit output and prepared `v1.0.0` checklist so the first `1.0.0` human sign-off packet remains reproducible.
- The final `one-point-zero-major-release-signoff` artifact should stay in step with the packet and prepared `v1.0.0` checklist so the first `1.0.0` reviewer signoff sheet remains reproducible.
- The final `one-point-zero-major-release-board` artifact should stay in step with the signoff sheet and prepared `v1.0.0` checklist so the first `1.0.0` board review artifact remains reproducible.
- The final `one-point-zero-major-release-verdict` artifact should stay in step with the board artifact and prepared `v1.0.0` checklist so the first `1.0.0` maintainer go/no-go sheet remains reproducible.
- The final `one-point-zero-major-release-authorization` artifact should stay in step with the verdict artifact and prepared `v1.0.0` checklist so the first `1.0.0` execution authorization sheet remains reproducible.
- The final `one-point-zero-major-release-warrant` artifact should stay in step with the authorization artifact and prepared `v1.0.0` checklist so the first `1.0.0` launch-side warrant sheet remains reproducible.
- The final `one-point-zero-major-release-launch-sheet` artifact should stay in step with the warrant artifact and prepared `v1.0.0` checklist so the first `1.0.0` execution handoff remains reproducible.
- The final `one-point-zero-major-release-command-card` artifact should stay in step with the launch-sheet artifact and prepared `v1.0.0` checklist so the first `1.0.0` command surface remains reproducible.
- The final `one-point-zero-major-release-preflight` artifact should stay in step with the command-card artifact and prepared `v1.0.0` checklist so the first `1.0.0` preflight gate remains reproducible.
- The final `one-point-zero-major-release-trigger` artifact should stay in step with the preflight artifact and prepared `v1.0.0` checklist so the first `1.0.0` execution trigger remains reproducible.
- The final `one-point-zero-major-release-rehearsal` artifact should stay in step with the trigger artifact and prepared `v1.0.0` checklist so the first `1.0.0` dry-run rehearsal remains reproducible.
- The final `one-point-zero-major-release-go-live` artifact should stay in step with the rehearsal artifact and prepared `v1.0.0` checklist so the first `1.0.0` execution surface remains reproducible.
- Keep `examples/*`, `apps/*`, and `packages/*` on the same version line.

## Near-Term Priorities
1. Make `create-forge-desktop` the clean entry point for new users.
2. Reduce mismatch between "reference example" and "official template".
3. Harden release and publish commands against real workspace structure and repo-outside installs.
4. Add project-specific Codex playbooks so repeated framework work is consistent.
