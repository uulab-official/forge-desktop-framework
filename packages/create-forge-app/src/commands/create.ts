import * as p from '@clack/prompts';
import pc from 'picocolors';
import { basename, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { TEMPLATES, getTemplateById } from '../templates.js';
import { scaffold, type ScaffoldMetadata } from '../scaffold.js';
import { detectPackageManager, inspectEnvironment } from '../environment.js';
import { FEATURE_DEFINITIONS, PRESET_DEFINITIONS, normalizeFeatureSelection } from '../features.js';

export async function createCommand(
  projectName?: string,
  options?: {
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
) {
  let templateId = options?.template;
  let selectedFeatures: ReturnType<typeof normalizeFeatureSelection>;

  p.intro(pc.bgCyan(pc.black(' create-forge-desktop ')));

  if (options?.list) {
    p.note(
      TEMPLATES.map((template) => `${template.id}  ${template.description}`).join('\n'),
      'Available templates',
    );
    p.outro(pc.green('Choose one with `--template <id>`.'));
    return;
  }

  if (options?.listFeatures) {
    p.note(
      FEATURE_DEFINITIONS.map((feature) => `${feature.id}  ${feature.description}`).join('\n'),
      'Available feature packs',
    );
    p.outro(pc.green('Add one or more with `--feature <id>`.'));
    return;
  }

  if (options?.listPresets) {
    p.note(
      PRESET_DEFINITIONS.map((preset) => `${preset.id}  ${preset.description}`).join('\n'),
      'Available presets',
    );
    p.outro(pc.green('Add one or more with `--preset <id>`.'));
    return;
  }

  try {
    selectedFeatures = normalizeFeatureSelection(options?.feature, options?.preset);
  } catch (error) {
    p.cancel(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Project name
  if (!projectName) {
    if (options?.yes) {
      p.cancel('Project name is required when using `--yes`.');
      process.exit(1);
    }

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
  const projectId = basename(targetDir);

  if (!/^[a-z0-9-_]+$/i.test(projectId)) {
    p.cancel(`Project name "${projectId}" must use only letters, numbers, hyphens, and underscores.`);
    process.exit(1);
  }

  if (existsSync(targetDir)) {
    p.cancel(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  // Template selection
  if (!templateId) {
    if (options?.yes) {
      templateId = 'minimal';
    }
  }

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

  const template = getTemplateById(templateId);
  if (!template) {
    p.cancel(`Unknown template: ${templateId}`);
    process.exit(1);
  }

  if (selectedFeatures.length > 0 && template.id !== 'minimal') {
    p.cancel('Feature packs are currently supported on the `minimal` template only.');
    process.exit(1);
  }

  const metadata: ScaffoldMetadata = {
    productName: options?.productName,
    appId: options?.appId,
    githubOwner: options?.githubOwner,
    githubRepo: options?.githubRepo,
  };

  const s = p.spinner();
  s.start(`Creating ${projectId} from ${template.label} template...`);

  try {
    await scaffold(projectId, templateId, targetDir, template, selectedFeatures, metadata);
    s.stop(`Project created!`);
  } catch (err) {
    s.stop('Failed to create project');
    p.cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const report = inspectEnvironment();
  const pm = normalizePackageManager(options?.packageManager) ?? detectPackageManager();
  const pythonCommand = report.python?.command ?? 'python3';

  if (!report.python) {
    p.log.warning('Python was not detected. Install Python 3.12+ before running the worker.');
  } else if (!report.pip?.ok) {
    p.log.warning(`pip was not detected via ${pythonCommand} -m pip. Dependency install may fail.`);
  }

  p.note(
    [
      `cd ${projectName === projectId ? projectId : targetDir}`,
      `${pm} install`,
      `${pythonCommand} -m pip install -r worker/requirements.txt`,
      ...(selectedFeatures.length > 0 ? [`${pm === 'npm' ? 'npm run' : pm} release:check`] : []),
      `${pm === 'npm' ? 'npm run' : pm} dev`,
    ].join('\n'),
    'Next steps',
  );

  p.outro(pc.green('Happy building!'));
}

function normalizePackageManager(value: string | undefined): 'pnpm' | 'npm' | 'yarn' | undefined {
  if (!value) return undefined;
  if (value === 'pnpm' || value === 'npm' || value === 'yarn') {
    return value;
  }
  return undefined;
}
