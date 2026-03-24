import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';

function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (dir !== '/') {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  return process.cwd();
}

export async function devCommand(target?: string) {
  const root = findMonorepoRoot();

  let filterArg: string;
  let label: string;

  if (!target) {
    // Default: run the main app
    filterArg = '@forge/app';
    label = 'Forge App';
  } else if (target.startsWith('@')) {
    // Full package name provided
    filterArg = target;
    label = target;
  } else {
    // Try to resolve as example or package
    const exampleDir = resolve(root, 'examples', target);
    const packageDir = resolve(root, 'packages', target);

    if (existsSync(exampleDir)) {
      filterArg = `@forge-example/${target}`;
      label = `Example: ${target}`;
    } else if (existsSync(packageDir)) {
      filterArg = `@forge/${target}`;
      label = `Package: ${target}`;
    } else {
      // Try as-is, pnpm will resolve
      filterArg = target;
      label = target;
    }
  }

  p.intro(pc.bgGreen(pc.black(` forge dev → ${label} `)));

  try {
    execSync(`pnpm --filter ${filterArg} dev`, {
      stdio: 'inherit',
      cwd: root,
    });
  } catch (err) {
    // Normal exit from Ctrl+C
    if ((err as any)?.status === 130 || (err as any)?.signal === 'SIGINT') {
      return;
    }
    p.log.error(`Failed to start dev mode for ${filterArg}`);
    process.exit(1);
  }
}
