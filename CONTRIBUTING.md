# Contributing to forge-desktop-framework

Thank you for your interest in contributing!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/uulab/forge-desktop-framework.git
cd forge-desktop-framework

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Setup Python worker
./scripts/setup-python.sh

# Start development
pnpm dev
```

## Project Structure

```
packages/                    # Framework core packages (@forge/*)
packages/worker-runtime/     # Python worker runtime (pip: forge-worker-runtime)
apps/forge-app/              # Main Electron app
apps/forge-app/worker/       # App's Python worker
examples/                    # Example apps demonstrating framework usage
scripts/                     # Build and dev scripts
docs/                        # Documentation
```

## Making Changes

### Packages

1. Make changes in `packages/<name>/src/`
2. Run `pnpm build --filter @forge/<name>` to build
3. Run `pnpm typecheck` to verify types

### Python Worker

1. Core runtime is in `packages/worker-runtime/` — install with `pip install -e packages/worker-runtime`
2. Edit action files in `apps/forge-app/worker/actions/` or `examples/<name>/worker/actions/`
3. Test directly: `echo '{"action":"health_check","payload":{}}' | python3 apps/forge-app/worker/main.py`

### Examples

1. Each example in `examples/` is self-contained
2. Test with `pnpm --filter @forge-example/<name> dev`

## Adding a New Package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `src/index.ts`
2. Follow the `@forge/<name>` naming convention
3. Use `workspace:*` for internal dependencies
4. Export from `src/index.ts`

## Adding a New Python Action

1. Create `worker/actions/<name>.py` in your app or example
2. Use `from forge_worker import register` and `@register("action_name")` decorator
3. Import in `worker/actions/__init__.py`

## Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure `pnpm build` and `pnpm typecheck` pass
5. Submit a pull request

## Code Style

- TypeScript: Prettier with the project `.prettierrc`
- Python: Standard Python conventions (PEP 8)
- Commits: Conventional commits recommended (`feat:`, `fix:`, `docs:`, etc.)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
