#!/usr/bin/env node

import { Command } from 'commander';
import { createCommand } from './commands/create.js';
import { buildCommand } from './commands/build.js';
import { releaseCommand } from './commands/release.js';
import { publishCommand } from './commands/publish.js';
import { devCommand } from './commands/dev.js';
import { doctorCommand } from './commands/doctor.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('forge')
  .description('Forge Desktop Framework CLI — create, build, release, and publish desktop apps')
  .version(pkg.version);

program
  .command('create [name]')
  .description('Scaffold a new Forge Desktop app')
  .option('-t, --template <template>', 'Template to use')
  .option('--list', 'List available templates')
  .option('--list-features', 'List available feature packs')
  .option('--list-presets', 'List available starter presets')
  .option('-f, --feature <feature>', 'Enable a feature pack (repeatable)', (value, acc: string[]) => {
    acc.push(value);
    return acc;
  }, [])
  .option('-p, --preset <preset>', 'Enable a starter preset (repeatable)', (value, acc: string[]) => {
    acc.push(value);
    return acc;
  }, [])
  .option('--product-name <name>', 'Override the generated desktop product name')
  .option('--app-id <id>', 'Override the generated Electron appId')
  .option('--github-owner <owner>', 'Seed the default GitHub release owner')
  .option('--github-repo <repo>', 'Seed the default GitHub release repository')
  .option('-y, --yes', 'Use defaults for any missing prompts')
  .option('--package-manager <pm>', 'Override package manager hint (pnpm, npm, yarn)')
  .action(async (
    name: string | undefined,
    opts: {
      template?: string;
      list?: boolean;
      listFeatures?: boolean;
      listPresets?: boolean;
      feature?: string[];
      preset?: string[];
      productName?: string;
      appId?: string;
      githubOwner?: string;
      githubRepo?: string;
      yes?: boolean;
      packageManager?: string;
    },
  ) => {
    await createCommand(name, opts);
  });

program
  .command('doctor')
  .description('Check whether your local environment is ready for Forge')
  .action(async () => {
    await doctorCommand();
  });

program
  .command('build')
  .description('Build all packages, Python worker, and Electron app')
  .option('--skip-packages', 'Skip building packages')
  .option('--skip-worker', 'Skip building Python worker')
  .option('--skip-app', 'Skip building Electron app')
  .action(async (opts: { skipPackages?: boolean; skipWorker?: boolean; skipApp?: boolean }) => {
    await buildCommand(opts);
  });

program
  .command('release [type]')
  .description('Version bump + git tag (patch, minor, or major)')
  .action(async (type: string | undefined) => {
    await releaseCommand(type);
  });

program
  .command('publish')
  .description('Build and publish to GitHub Releases and/or S3/R2')
  .option('--s3', 'Publish to S3/R2 bucket')
  .option('--github', 'Publish to GitHub Releases (default)')
  .option('--skip-build', 'Skip the build step')
  .action(async (opts: { s3?: boolean; github?: boolean; skipBuild?: boolean }) => {
    await publishCommand(opts);
  });

program
  .command('dev [target]')
  .description('Start development mode (default: @forge/app)')
  .action(async (target: string | undefined) => {
    await devCommand(target);
  });

program.parse();
