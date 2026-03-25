import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { buildCommand } from './build.js';

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

function run(cmd: string, cwd: string, env?: Record<string, string>) {
  execSync(cmd, {
    stdio: 'inherit',
    cwd,
    env: { ...process.env, ...env },
  });
}

function checkEnvVar(name: string, required: boolean = true): string | undefined {
  const value = process.env[name];
  if (!value && required) {
    p.log.error(`Missing required environment variable: ${pc.bold(name)}`);
  }
  return value;
}

export async function publishCommand(opts: { s3?: boolean; github?: boolean; skipBuild?: boolean }) {
  const root = findMonorepoRoot();
  const defaultToGithub = !opts.s3 && !opts.github;

  p.intro(pc.bgBlue(pc.black(' forge publish ')));

  // Show environment variable requirements
  p.log.info(pc.bold('Checking environment variables...'));

  const envChecks: Array<{ name: string; target: string; required: boolean }> = [];

  if (opts.github || defaultToGithub) {
    envChecks.push(
      { name: 'GH_TOKEN', target: 'GitHub', required: true },
      { name: 'CSC_LINK', target: 'macOS code signing', required: false },
      { name: 'CSC_KEY_PASSWORD', target: 'macOS code signing', required: false },
      { name: 'APPLE_ID', target: 'macOS notarization', required: false },
      { name: 'APPLE_APP_SPECIFIC_PASSWORD', target: 'macOS notarization', required: false },
      { name: 'APPLE_TEAM_ID', target: 'macOS notarization', required: false },
      { name: 'WIN_CSC_LINK', target: 'Windows code signing', required: false },
      { name: 'WIN_CSC_KEY_PASSWORD', target: 'Windows code signing', required: false },
    );
  }

  if (opts.s3) {
    envChecks.push(
      { name: 'AWS_ACCESS_KEY_ID', target: 'S3/R2', required: true },
      { name: 'AWS_SECRET_ACCESS_KEY', target: 'S3/R2', required: true },
      { name: 'S3_BUCKET', target: 'S3/R2', required: true },
      { name: 'S3_ENDPOINT', target: 'S3/R2', required: true },
      { name: 'AWS_REGION', target: 'S3/R2', required: false },
    );
  }

  let hasRequiredMissing = false;
  for (const check of envChecks) {
    const value = process.env[check.name];
    if (value) {
      p.log.success(`${pc.green('✓')} ${check.name} ${pc.dim(`(${check.target})`)}`);
    } else if (check.required) {
      p.log.error(`${pc.red('✗')} ${check.name} ${pc.dim(`(${check.target})`)} — ${pc.red('REQUIRED')}`);
      hasRequiredMissing = true;
    } else {
      p.log.warning(`${pc.yellow('○')} ${check.name} ${pc.dim(`(${check.target})`)} — optional`);
    }
  }

  if (hasRequiredMissing) {
    p.cancel('Missing required environment variables. Set them and try again.');
    process.exit(1);
  }

  // Step 1: Build
  if (!opts.skipBuild) {
    p.log.step('Running build...');
    await buildCommand();
  }

  // Step 2: Publish to GitHub Releases
  if (opts.github || defaultToGithub) {
    const s = p.spinner();
    s.start('Publishing to GitHub Releases...');
    try {
      run(
        'pnpm --filter @forge/app package -- --publish always',
        root,
      );
      s.stop(pc.green('Published to GitHub Releases'));
    } catch (err) {
      s.stop(pc.red('Failed to publish to GitHub Releases'));
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  // Step 3: Publish to S3/R2
  if (opts.s3) {
    const s = p.spinner();
    s.start('Publishing to S3/R2...');

    const bucket = process.env['S3_BUCKET']!;
    const endpoint = process.env['S3_ENDPOINT']!;
    const releaseDir = resolve(root, 'apps/app/release');
    const region = process.env['AWS_REGION'] || 'auto';

    // Get version from package.json
    const rootPkg = JSON.parse(
      (await import('node:fs')).readFileSync(resolve(root, 'package.json'), 'utf-8')
    );
    const version = `v${rootPkg.version}`;

    try {
      // Build with S3 config
      run(
        'pnpm --filter @forge/app package -- -c electron-builder.s3.yml',
        root,
      );

      if (!existsSync(releaseDir)) {
        throw new Error(`Release directory not found after packaging: ${releaseDir}`);
      }

      // Sync release artifacts to S3
      run(
        `aws s3 sync "${releaseDir}" "s3://${bucket}/releases/${version}/" ` +
        `--endpoint-url "${endpoint}" ` +
        `--exclude "*.blockmap" ` +
        `--exclude "builder-debug.yml"`,
        root,
        { AWS_DEFAULT_REGION: region },
      );

      // Copy latest*.yml files for auto-update
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(releaseDir);
      for (const file of files) {
        if (file.startsWith('latest') && file.endsWith('.yml')) {
          run(
            `aws s3 cp "${resolve(releaseDir, file)}" "s3://${bucket}/releases/latest/${file}" ` +
            `--endpoint-url "${endpoint}"`,
            root,
            { AWS_DEFAULT_REGION: region },
          );
        }
      }

      s.stop(pc.green('Published to S3/R2'));
    } catch (err) {
      s.stop(pc.red('Failed to publish to S3/R2'));
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  p.outro(pc.green('Publish complete!'));
}
