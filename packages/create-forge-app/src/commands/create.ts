import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { TEMPLATES } from '../templates.js';
import { scaffold, detectPackageManager } from '../scaffold.js';

export async function createCommand(projectName?: string, options?: { template?: string }) {
  let templateId = options?.template;

  p.intro(pc.bgCyan(pc.black(' create-forge-app ')));

  // Project name
  if (!projectName) {
    const result = await p.text({
      message: 'Project name:',
      placeholder: 'my-forge-app',
      validate(value) {
        if (!value) return 'Project name is required';
        if (!/^[a-z0-9-_]+$/i.test(value)) return 'Use only letters, numbers, hyphens, underscores';
        return undefined;
      },
    });

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
    projectName = result;
  }

  const targetDir = resolve(process.cwd(), projectName);

  if (existsSync(targetDir)) {
    p.cancel(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  // Template selection
  if (!templateId) {
    const result = await p.select({
      message: 'Select a template:',
      options: TEMPLATES.map((t) => ({
        value: t.id,
        label: t.label,
        hint: t.hint,
      })),
    });

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
    templateId = result as string;
  }

  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    p.cancel(`Unknown template: ${templateId}`);
    process.exit(1);
  }

  const s = p.spinner();
  s.start(`Creating ${projectName} from ${template.label} template...`);

  try {
    await scaffold(projectName, templateId, targetDir);
    s.stop(`Project created!`);
  } catch (err) {
    s.stop('Failed to create project');
    p.cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const pm = detectPackageManager();

  p.note(
    [
      `cd ${projectName}`,
      `${pm} install`,
      `${pm === 'npm' ? 'npm run' : pm} dev`,
    ].join('\n'),
    'Next steps',
  );

  p.outro(pc.green('Happy building!'));
}
