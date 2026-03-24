import { readdir, readFile, writeFile, mkdir, stat, copyFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getTemplatesDir(): string {
  return join(__dirname, '..', 'templates');
}

async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    // Skip these directories
    if (['node_modules', 'dist', 'dist-electron', '.turbo', '__pycache__', '.venv'].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

export async function scaffold(
  projectName: string,
  templateId: string,
  targetDir: string,
): Promise<void> {
  const templateDir = join(getTemplatesDir(), templateId);

  // Check template exists
  try {
    await stat(templateDir);
  } catch {
    throw new Error(`Template "${templateId}" not found at ${templateDir}`);
  }

  // Copy template
  await copyDir(templateDir, targetDir);

  // Rewrite package.json
  const pkgPath = join(targetDir, 'package.json');
  try {
    const raw = await readFile(pkgPath, 'utf-8');
    let pkg = JSON.parse(raw);

    pkg.name = projectName;
    pkg.version = '0.1.0';

    // Replace workspace:* with actual versions
    const replaceWorkspace = (deps: Record<string, string> | undefined) => {
      if (!deps) return;
      for (const [key, value] of Object.entries(deps)) {
        if (value === 'workspace:*') {
          deps[key] = '^0.1.0';
        }
      }
    };

    replaceWorkspace(pkg.dependencies);
    replaceWorkspace(pkg.devDependencies);

    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } catch {
    // If no package.json, that's okay for some templates
  }

  // Rewrite tsconfig to not extend monorepo base
  for (const tsFile of ['tsconfig.json', 'tsconfig.node.json']) {
    const tsPath = join(targetDir, tsFile);
    try {
      const raw = await readFile(tsPath, 'utf-8');
      const config = JSON.parse(raw);

      // Remove extends to monorepo base and inline the essential settings
      if (config.extends && config.extends.includes('../../tsconfig.base.json')) {
        delete config.extends;
        config.compilerOptions = {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          isolatedModules: true,
          ...config.compilerOptions,
        };
      }

      // Remove project references (they're for monorepo only)
      delete config.references;

      await writeFile(tsPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    } catch {
      // File doesn't exist, skip
    }
  }
}

export function detectPackageManager(): 'pnpm' | 'npm' | 'yarn' {
  const ua = process.env['npm_config_user_agent'] ?? '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  return 'npm';
}
