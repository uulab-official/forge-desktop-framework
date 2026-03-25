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
- Keep `examples/*`, `apps/*`, and `packages/*` on the same version line.

## Near-Term Priorities
1. Make `create-forge-desktop` the clean entry point for new users.
2. Reduce mismatch between "reference example" and "official template".
3. Harden release and publish commands against real workspace structure.
4. Add project-specific Codex playbooks so repeated framework work is consistent.
