import { execSync } from 'node:child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (dir !== '/') {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  // Fallback to cwd
  return process.cwd();
}

function run(cmd: string, cwd?: string) {
  execSync(cmd, { stdio: 'inherit', cwd: cwd ?? process.cwd() });
}

export async function buildCommand(options?: { skipPackages?: boolean; skipWorker?: boolean; skipApp?: boolean }) {
  const root = findMonorepoRoot();

  p.intro(pc.bgMagenta(pc.black(' forge build ')));

  // Step 1: Build packages
  if (!options?.skipPackages) {
    const s = p.spinner();
    s.start('Building all packages...');
    try {
      run(`pnpm build --filter='./packages/*'`, root);
      s.stop(pc.green('Packages built successfully'));
    } catch (err) {
      s.stop(pc.red('Failed to build packages'));
      process.exit(1);
    }
  }

  // Step 2: Build Python worker
  if (!options?.skipWorker) {
    const workerDir = resolve(root, 'apps/forge-app/worker');
    if (existsSync(workerDir)) {
      const s = p.spinner();
      s.start('Building Python worker...');
      try {
        run('pip install pyinstaller', workerDir);
        run('pyinstaller --onefile --name forge-worker main.py', workerDir);
        s.stop(pc.green('Python worker built successfully'));
      } catch (err) {
        s.stop(pc.red('Failed to build Python worker'));
        p.log.warning('Make sure Python and pip are installed');
        process.exit(1);
      }
    } else {
      p.log.info('No Python worker found, skipping...');
    }
  }

  // Step 3: Build Electron app
  if (!options?.skipApp) {
    const s = p.spinner();
    s.start('Building Electron app...');
    try {
      run('pnpm --filter @forge/app build', root);
      s.stop(pc.green('Electron app built successfully'));
    } catch (err) {
      s.stop(pc.red('Failed to build Electron app'));
      process.exit(1);
    }
  }

  p.outro(pc.green('Build complete!'));
}
