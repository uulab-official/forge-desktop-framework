#!/usr/bin/env node

/**
 * Backward-compatible entry point for `create-forge-app`.
 * Delegates to the `forge create` command.
 */

import { createCommand } from './commands/create.js';

async function main() {
  const args = process.argv.slice(2);
  let projectName: string | undefined = args[0];
  let template: string | undefined;

  // Parse --template flag
  const templateIdx = args.indexOf('--template');
  if (templateIdx !== -1 && args[templateIdx + 1]) {
    template = args[templateIdx + 1];
    if (projectName === '--template') {
      projectName = undefined;
    }
  }

  await createCommand(projectName, { template });
}

main().catch(console.error);
