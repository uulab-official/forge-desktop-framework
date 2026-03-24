# Changelog

## 0.1.0 (2026-03-24)

### Initial Release

**Framework Core**
- 12 TypeScript packages: ipc-contract, logger, worker-client, job-engine, project-core, resource-manager, settings-core, ui-kit (18 components), plugin-system, error-handler, updater
- 1 Python package: forge-worker-runtime (pip installable)
- forge-cli: `forge create`, `forge build`, `forge release`, `forge publish`, `forge dev`

**App Structure**
- `apps/app/` — Electron desktop app with React 19 + Tailwind CSS v4
- `apps/worker/` — Python worker with stdin/stdout JSON IPC
- Custom frameless titlebar, collapsible sidebar, dashboard, worker console
- Dark mode auto-detection, smooth animations

**Examples (9)**
- minimal, file-processor, ai-tool, video-tools, dashboard, multi-module, chat, webrtc-demo, webgpu-compute

**DevOps**
- GitHub Actions CI (build + typecheck + prettier + python tests)
- GitHub Actions Release (multi-platform build + code signing + auto-publish)
- Dual update providers: GitHub Releases + S3/R2
- Auto-updater integration (electron-updater)
- Code signing docs (macOS notarization + Windows)

**DX**
- CLAUDE.md + 7 Claude Code skills (version-bump, ship, new-package, new-action, new-example, add-component, dev)
- Comprehensive docs: IPC patterns, code signing, deployment
- CONTRIBUTING.md, CODE_OF_CONDUCT.md
