import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
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

function readPkgVersion(filePath: string): string {
  const pkg = JSON.parse(readFileSync(filePath, 'utf-8'));
  return pkg.version;
}

function writePkgVersion(filePath: string, version: string): void {
  const pkg = JSON.parse(readFileSync(filePath, 'utf-8'));
  pkg.version = version;
  writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function collectWorkspacePackageJsons(root: string): string[] {
  const packageJsons: string[] = [];

  for (const dir of ['packages', 'apps', 'examples']) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;

    const entries = readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pkgPath = join(fullDir, entry.name, 'package.json');
      if (existsSync(pkgPath)) {
        packageJsons.push(pkgPath);
      }
    }
  }

  return packageJsons;
}

function bumpVersion(current: string, type: 'patch' | 'minor' | 'major'): string {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
  }
}

export async function releaseCommand(type?: string) {
  const root = findMonorepoRoot();

  p.intro(pc.bgYellow(pc.black(' forge release ')));

  // Validate type
  let bumpType: 'patch' | 'minor' | 'major';
  if (type && ['patch', 'minor', 'major'].includes(type)) {
    bumpType = type as 'patch' | 'minor' | 'major';
  } else if (type) {
    p.cancel(`Invalid release type: ${type}. Use patch, minor, or major.`);
    process.exit(1);
  } else {
    const result = await p.select({
      message: 'Select release type:',
      options: [
        { value: 'patch', label: 'Patch', hint: 'Bug fixes (0.1.0 → 0.1.1)' },
        { value: 'minor', label: 'Minor', hint: 'New features (0.1.0 → 0.2.0)' },
        { value: 'major', label: 'Major', hint: 'Breaking changes (0.1.0 → 1.0.0)' },
      ],
    });
    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
    bumpType = result as 'patch' | 'minor' | 'major';
  }

  // Get current version from root package.json
  const rootPkgPath = join(root, 'package.json');
  const currentVersion = readPkgVersion(rootPkgPath);
  const newVersion = bumpVersion(currentVersion, bumpType);

  p.log.info(`Current version: ${pc.dim(currentVersion)}`);
  p.log.info(`New version:     ${pc.green(newVersion)}`);

  const confirm = await p.confirm({
    message: `Release v${newVersion}?`,
  });

  if (p.isCancel(confirm) || !confirm) {
    p.cancel('Release cancelled.');
    process.exit(0);
  }

  const s = p.spinner();

  // Update root package.json
  s.start('Updating versions...');
  writePkgVersion(rootPkgPath, newVersion);

  // Update all workspace package.json files
  let updatedCount = 1; // root already updated

  for (const pkgPath of collectWorkspacePackageJsons(root)) {
    writePkgVersion(pkgPath, newVersion);
    updatedCount++;
  }

  s.stop(pc.green(`Updated ${updatedCount} package.json files`));

  // Git operations
  s.start('Creating git commit and tag...');
  try {
    execSync('git add -A', { cwd: root, stdio: 'pipe' });
    execSync(`git commit -m "release: v${newVersion}"`, { cwd: root, stdio: 'pipe' });
    execSync(`git tag v${newVersion}`, { cwd: root, stdio: 'pipe' });
    s.stop(pc.green(`Created commit and tag v${newVersion}`));
  } catch (err) {
    s.stop(pc.red('Failed to create git commit/tag'));
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  p.note(
    [
      `git push && git push --tags`,
      '',
      'This will trigger the GitHub Actions release workflow.',
    ].join('\n'),
    'Next steps',
  );

  p.outro(pc.green(`Released v${newVersion}!`));
}
