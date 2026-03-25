#!/usr/bin/env node

/**
 * Backward-compatible entry point for `create-forge-app`.
 * Delegates to the `forge create` command.
 */

import { createCommand } from './commands/create.js';

async function main() {
  const args = process.argv.slice(2);
  let projectName: string | undefined = args.find((arg) => !arg.startsWith('-'));
  let template: string | undefined;
  const features: string[] = [];
  const presets: string[] = [];
  let productName: string | undefined;
  let appId: string | undefined;
  let githubOwner: string | undefined;
  let githubRepo: string | undefined;
  let list = false;
  let listFeatures = false;
  let listPresets = false;
  let yes = false;
  let packageManager: string | undefined;

  // Parse --template flag
  const templateIdx = args.indexOf('--template');
  if (templateIdx !== -1 && args[templateIdx + 1]) {
    template = args[templateIdx + 1];
  }

  const pmIdx = args.indexOf('--package-manager');
  if (pmIdx !== -1 && args[pmIdx + 1]) {
    packageManager = args[pmIdx + 1];
  }

  const productNameIdx = args.indexOf('--product-name');
  if (productNameIdx !== -1 && args[productNameIdx + 1]) {
    productName = args[productNameIdx + 1];
  }

  const appIdIdx = args.indexOf('--app-id');
  if (appIdIdx !== -1 && args[appIdIdx + 1]) {
    appId = args[appIdIdx + 1];
  }

  const githubOwnerIdx = args.indexOf('--github-owner');
  if (githubOwnerIdx !== -1 && args[githubOwnerIdx + 1]) {
    githubOwner = args[githubOwnerIdx + 1];
  }

  const githubRepoIdx = args.indexOf('--github-repo');
  if (githubRepoIdx !== -1 && args[githubRepoIdx + 1]) {
    githubRepo = args[githubRepoIdx + 1];
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' || args[i] === '-f') {
      const value = args[i + 1];
      if (value && !value.startsWith('-')) {
        features.push(value);
      }
    }

    if (args[i] === '--preset' || args[i] === '-p') {
      const value = args[i + 1];
      if (value && !value.startsWith('-')) {
        presets.push(value);
      }
    }
  }

  list = args.includes('--list');
  listFeatures = args.includes('--list-features');
  listPresets = args.includes('--list-presets');
  yes = args.includes('--yes') || args.includes('-y');

  if (projectName && projectName.startsWith('--')) {
    projectName = undefined;
  }

  await createCommand(projectName, {
    template,
    list,
    listFeatures,
    listPresets,
    feature: features,
    preset: presets,
    productName,
    appId,
    githubOwner,
    githubRepo,
    yes,
    packageManager,
  });
}

main().catch(console.error);
