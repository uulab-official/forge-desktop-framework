# forge-desktop-framework

## Project Overview
Open source local-engine desktop app framework. Electron (UI) + Python Worker (engine) with stdin/stdout JSON IPC.

## Tech Stack
- **Monorepo**: pnpm + Turborepo
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Desktop**: Electron (frameless window, contextBridge IPC)
- **Engine**: Python 3.12+ (PyInstaller for distribution)
- **IPC Protocol**: JSON over stdin/stdout (see packages/ipc-contract)

## Project Structure
- `packages/` — Framework core packages (@forge/*)
- `app/` — Main Electron app (with embedded Python worker)
- `examples/` — Example apps (minimal, file-processor, ai-tool, video-tools, dashboard, multi-module, chat, webrtc-demo, webgpu-compute)
- `python/worker/` — Framework's core Python worker template (used by examples)
- `app/python/worker/` — App's Python worker (lives inside the app)
- `scripts/` — Build and dev scripts
- `docs/` — Documentation

## Key Commands
```
pnpm install                    # Install all dependencies
pnpm build                      # Build all packages (turborepo)
pnpm typecheck                  # Type check all packages
pnpm dev                        # Start development
pnpm --filter @forge/app dev    # Start the app
pnpm --filter @forge/<pkg> dev  # Dev single package
pnpm --filter @forge-example/<name> dev  # Run an example
```

## Package Conventions
- Package names: `@forge/<name>` for framework, `@forge-example/<name>` for examples
- Each package: `src/index.ts` barrel export, `tsconfig.json` extends `../../tsconfig.base.json`
- Build: `tsc` only for packages (Vite handles final bundling in apps)
- Internal deps: `"workspace:*"` in package.json

## Python Worker Conventions
- Actions use `@register("action_name")` decorator in `python/worker/actions/`
- Protocol: stdout = JSON responses ONLY, stderr = logging
- New action: create file in actions/, import in actions/__init__.py
- Test: `echo '{"action":"name","payload":{}}' | python3 python/worker/main.py`

## IPC Flow
Renderer -> ipcRenderer.invoke() -> Electron Main -> child_process.spawn -> Python Worker
Python Worker -> stdout JSON -> Electron Main -> webContents.send -> Renderer

## Adding a New Package
1. Create `packages/<name>/` with package.json, tsconfig.json, src/index.ts
2. Name: `@forge/<name>`, type: module, exports map
3. Add to tsconfig references of dependent packages
4. `pnpm install` to link

## Adding a New Example
1. Copy `examples/minimal/` as starting point
2. Rename in package.json to `@forge-example/<name>`
3. Add Python actions in python/worker/actions/
4. Add to `packages/create-forge-app/src/templates.ts`

## Code Style
- TypeScript: strict mode, ESNext modules, .js extension in imports
- React: functional components, hooks only
- Tailwind: utility-first, dark mode via class strategy
- Python: PEP 8, type hints, stdlib preferred

## Testing
- Python worker: pipe JSON through stdin, check stdout
- Packages: `pnpm typecheck` (no test runner yet)
- Full app: `pnpm --filter @forge/app dev`

## Release Process
1. `./scripts/release.sh [patch|minor|major]` — bumps all versions
2. `git add -A && git commit && git tag v<version>`
3. `git push && git push --tags` — triggers CI release
