import { readdir, readFile, writeFile, mkdir, stat, copyFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Template } from './templates.js';
import type { ScaffoldFeature } from './features.js';

export interface ScaffoldMetadata {
  productName?: string;
  appId?: string;
  githubOwner?: string;
  githubRepo?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function getTemplatesDir(): string {
  return join(__dirname, '..', 'templates');
}

function getWorkerRuntimeDir(): string {
  return join(__dirname, '..', '..', 'worker-runtime', 'forge_worker');
}

function getFrameworkVersion(): string {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  return pkg.version;
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
  template: Template,
  features: ScaffoldFeature[] = [],
  metadata: ScaffoldMetadata = {},
): Promise<void> {
  const templateDir = join(getTemplatesDir(), templateId);
  const frameworkVersion = getFrameworkVersion();

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
    pkg.version = frameworkVersion;

    // Replace workspace:* with actual versions
    const replaceWorkspace = (deps: Record<string, string> | undefined) => {
      if (!deps) return;
      for (const [key, value] of Object.entries(deps)) {
        if (value === 'workspace:*') {
          deps[key] = `^${frameworkVersion}`;
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

  await rewriteWorkerRequirements(targetDir, frameworkVersion);
  await vendorWorkerRuntime(targetDir);
  await writeReleasePreset(targetDir, projectName, frameworkVersion, features, metadata);
  await writeFeaturePack(targetDir, projectName, template, features, metadata);
  await writeFoundationLayer(targetDir, projectName, template, features, metadata);
  await rewriteProjectReadme(targetDir, projectName, template, frameworkVersion, features, metadata);
}

async function rewriteWorkerRequirements(targetDir: string, frameworkVersion: string): Promise<void> {
  const requirementsPath = join(targetDir, 'worker', 'requirements.txt');

  try {
    const raw = await readFile(requirementsPath, 'utf-8');
    const lines = raw
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== '');

    const filtered = lines.filter((line) => {
      return !line.includes('packages/worker-runtime')
        && !line.startsWith('forge-worker-runtime')
        && !line.includes('pip install -e');
    });

    const body = filtered.length > 0
      ? filtered.join('\n')
      : '# No extra Python dependencies are required for this template.';

    const header = [
      '# Optional Python dependencies for your worker actions',
      '# The Forge worker runtime is vendored into worker/forge_worker.',
      `# Generated by create-forge-desktop@${frameworkVersion}`,
      '',
    ];

    await writeFile(requirementsPath, `${header.join('\n')}${body}\n`, 'utf-8');
  } catch {
    // No worker requirements file for this template.
  }
}

async function vendorWorkerRuntime(targetDir: string): Promise<void> {
  const runtimeDir = getWorkerRuntimeDir();
  const targetRuntimeDir = join(targetDir, 'worker', 'forge_worker');

  try {
    await stat(runtimeDir);
    await copyDir(runtimeDir, targetRuntimeDir);
  } catch {
    // If the runtime is unavailable, leave the template as-is.
  }
}

async function rewriteProjectReadme(
  targetDir: string,
  projectName: string,
  template: Template,
  frameworkVersion: string,
  features: ScaffoldFeature[],
  metadata: ScaffoldMetadata,
): Promise<void> {
  const readmePath = join(targetDir, 'README.md');

  try {
    const original = await readFile(readmePath, 'utf-8');
    const templateNotes = stripFirstHeading(original).trim();

    const generated = [
      `# ${projectName}`,
      '',
      `${template.description}`,
      '',
      `Generated with \`create-forge-desktop@${frameworkVersion}\` using the \`${template.id}\` template.`,
      '',
      '## Release Identity',
      '',
      `- Product name: \`${resolveProductName(projectName, metadata)}\``,
      `- App ID: \`${resolveAppId(projectName, metadata)}\``,
      ...(metadata.githubOwner || metadata.githubRepo
        ? [`- GitHub publish target: \`${resolveGithubOwner(metadata)}/${resolveGithubRepo(projectName, metadata)}\``, '']
        : ['']),
      ...(features.length > 0
        ? [
            '## Enabled Feature Packs',
            '',
            ...features.map((feature) => `- \`${feature}\``),
            '',
          ]
        : []),
      ...(features.length > 0
        ? ['Feature packs currently target the `minimal` starter and are wired into the generated runtime shell.', '']
        : []),
      '## Quick Start',
      '',
      '```bash',
      'pnpm install',
      'python3 -m pip install -r worker/requirements.txt',
      'pnpm dev',
      '```',
      '',
      'If `python3` is not available on your system, use `python -m pip install -r worker/requirements.txt` instead.',
      '',
      '## What You Get',
      '',
      `- Template: \`${template.label}\``,
      `- Focus: ${template.hint}`,
      '- Electron + React renderer',
      '- Vendored Python worker runtime in `worker/forge_worker`',
      '- Vite-based local development',
      '- Release preset with electron-builder and worker packaging scripts',
      '- GitHub Actions validation and tagged release workflows',
      '',
      '## Common Commands',
      '',
      '```bash',
      'pnpm dev',
      'pnpm build',
      'pnpm typecheck',
      'pnpm release:check',
      'pnpm setup:python',
      'pnpm build:worker',
      'pnpm package',
      '```',
      '',
      '## Release Checklist',
      '',
      '- Verify the app in development mode with `pnpm dev`',
      '- Install any extra Python dependencies into `worker/requirements.txt`',
      '- Prepare the worker environment with `pnpm setup:python`',
      '- Copy `.env.example` to `.env` and fill in release metadata',
      '- Add GitHub Actions secrets before pushing a release tag',
      '- Run `pnpm release:check` to verify release prerequisites',
      '- Build the bundled worker with `pnpm build:worker`',
      '- Package the desktop app with `pnpm package`',
      '',
      'Detailed release steps live in `docs/release-playbook.md`.',
      '',
      '## Template Notes',
      '',
      templateNotes || '_No additional template notes provided._',
      '',
    ].join('\n');

    await writeFile(readmePath, generated, 'utf-8');
  } catch {
    // Ignore if README rewrite fails unexpectedly.
  }
}

function stripFirstHeading(markdown: string): string {
  const lines = markdown.split('\n');
  if (lines[0]?.startsWith('# ')) {
    return lines.slice(1).join('\n').trimStart();
  }

  return markdown;
}

async function writeReleasePreset(
  targetDir: string,
  projectName: string,
  frameworkVersion: string,
  features: ScaffoldFeature[],
  metadata: ScaffoldMetadata,
): Promise<void> {
  await updatePackageJsonForRelease(targetDir, frameworkVersion, features);
  await mkdir(join(targetDir, 'build'), { recursive: true });
  await mkdir(join(targetDir, '.github', 'workflows'), { recursive: true });
  await mkdir(join(targetDir, 'docs'), { recursive: true });
  await mkdir(join(targetDir, 'scripts'), { recursive: true });

  for (const dir of ['binaries', 'fonts', 'models', 'templates']) {
    const resourceDir = join(targetDir, 'resources', dir);
    await mkdir(resourceDir, { recursive: true });
    await writeFile(join(resourceDir, '.gitkeep'), '', 'utf-8');
  }

  await writeFile(join(targetDir, '.gitignore'), getGitignoreContents(), 'utf-8');
  await writeFile(join(targetDir, '.env.example'), getEnvExample(projectName, metadata), 'utf-8');
  await writeFile(join(targetDir, 'electron-builder.yml'), getElectronBuilderConfig(projectName, metadata), 'utf-8');
  await writeFile(join(targetDir, 'electron-builder.s3.yml'), getElectronBuilderS3Config(), 'utf-8');
  await writeFile(join(targetDir, '.github', 'workflows', 'validate.yml'), getValidateWorkflow(), 'utf-8');
  await writeFile(join(targetDir, '.github', 'workflows', 'release.yml'), getReleaseWorkflow(), 'utf-8');
  await writeFile(join(targetDir, 'build', 'entitlements.mac.plist'), getMacEntitlements(), 'utf-8');
  await writeFile(join(targetDir, 'docs', 'release-playbook.md'), getReleasePlaybook(projectName, metadata), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'preflight-release.sh'), getPreflightReleaseScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'setup-python.sh'), getSetupPythonScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'build-worker.sh'), getBuildWorkerScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'build-app.sh'), getBuildAppScript(), 'utf-8');
}

async function updatePackageJsonForRelease(
  targetDir: string,
  frameworkVersion: string,
  features: ScaffoldFeature[],
): Promise<void> {
  const pkgPath = join(targetDir, 'package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);
  const forgeVersion = `^${frameworkVersion}`;

  pkg.dependencies = {
    ...pkg.dependencies,
    '@forge/error-handler': pkg.dependencies?.['@forge/error-handler'] ?? forgeVersion,
    '@forge/ui-kit': pkg.dependencies?.['@forge/ui-kit'] ?? forgeVersion,
    ...(features.includes('settings')
      ? { '@forge/settings-core': pkg.dependencies?.['@forge/settings-core'] ?? forgeVersion }
      : {}),
    ...(features.includes('jobs')
      ? { '@forge/job-engine': pkg.dependencies?.['@forge/job-engine'] ?? forgeVersion }
      : {}),
    ...(features.includes('plugins')
      ? { '@forge/plugin-system': pkg.dependencies?.['@forge/plugin-system'] ?? forgeVersion }
      : {}),
    ...(features.includes('updater')
      ? { '@forge/updater': pkg.dependencies?.['@forge/updater'] ?? forgeVersion }
      : {}),
  };

  pkg.scripts = {
    ...pkg.scripts,
    typecheck: 'tsc --noEmit && tsc -p tsconfig.node.json --noEmit',
    clean: 'rm -rf dist dist-electron release worker/dist',
    'release:check': 'bash scripts/preflight-release.sh',
    'setup:python': 'bash scripts/setup-python.sh',
    'build:worker': 'bash scripts/build-worker.sh',
    'build:app': 'bash scripts/build-app.sh',
    package: 'electron-builder',
    'package:s3': 'electron-builder -c electron-builder.s3.yml',
  };

  pkg.devDependencies = {
    ...pkg.devDependencies,
    'electron-builder': pkg.devDependencies?.['electron-builder'] ?? '^26.0.0',
  };

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

async function writeFeaturePack(
  targetDir: string,
  projectName: string,
  template: Template,
  features: ScaffoldFeature[],
  metadata: ScaffoldMetadata,
): Promise<void> {
  if (features.length === 0 || template.id !== 'minimal') {
    return;
  }

  const forgeDir = join(targetDir, 'src', 'forge');
  await mkdir(forgeDir, { recursive: true });

  await writeFile(
    join(targetDir, 'electron', 'main.ts'),
    getMinimalElectronMainSource(projectName, features, metadata),
    'utf-8',
  );
  await writeFile(join(targetDir, 'electron', 'preload.ts'), getMinimalPreloadSource(features), 'utf-8');
  await writeFile(
    join(forgeDir, 'FeatureStudio.tsx'),
    getFeatureStudioSource(projectName, features, metadata),
    'utf-8',
  );

  if (features.includes('plugins')) {
    await writeFile(join(forgeDir, 'plugins.ts'), getPluginRegistrySource(projectName, metadata), 'utf-8');
  }
}

async function writeFoundationLayer(
  targetDir: string,
  projectName: string,
  template: Template,
  features: ScaffoldFeature[],
  metadata: ScaffoldMetadata,
): Promise<void> {
  const forgeDir = join(targetDir, 'src', 'forge');
  await mkdir(forgeDir, { recursive: true });

  await writeFile(join(forgeDir, 'AppShell.tsx'), getAppShellSource(projectName, template, features, metadata), 'utf-8');
  await rewriteMainEntry(targetDir);
}

async function rewriteMainEntry(targetDir: string): Promise<void> {
  const mainPath = join(targetDir, 'src', 'main.tsx');

  try {
    const raw = await readFile(mainPath, 'utf-8');
    const withImports = injectFoundationImports(raw);
    const rewritten = wrapAppRender(withImports);
    await writeFile(mainPath, rewritten, 'utf-8');
  } catch {
    // Skip if the template has no renderer entry.
  }
}

function injectFoundationImports(source: string): string {
  let next = source;

  if (!next.includes("import { ForgeErrorBoundary } from '@forge/error-handler';")) {
    next = `import { ForgeErrorBoundary } from '@forge/error-handler';\n${next}`;
  }

  if (!next.includes("import { ForgeAppShell } from './forge/AppShell';")) {
    next = next.replace(
      /import \{ App \} from '\.\/App';\n/,
      "import { App } from './App';\nimport { ForgeAppShell } from './forge/AppShell';\n",
    );
  }

  return next;
}

function wrapAppRender(source: string): string {
  if (source.includes('<ForgeAppShell>')) {
    return source;
  }

  const appTagPattern = /<App \/>/;
  if (!appTagPattern.test(source)) {
    return source;
  }

  return source.replace(
    appTagPattern,
    `<ForgeErrorBoundary>\n      <ForgeAppShell>\n        <App />\n      </ForgeAppShell>\n    </ForgeErrorBoundary>`,
  );
}

function getElectronBuilderConfig(projectName: string, metadata: ScaffoldMetadata): string {
  const appId = resolveAppId(projectName, metadata);
  const productName = resolveProductName(projectName, metadata);
  const githubOwner = resolveGithubOwner(metadata);
  const githubRepo = resolveGithubRepo(projectName, metadata);

  return [
    `appId: ${appId}`,
    `productName: ${productName}`,
    'directories:',
    '  output: release',
    'files:',
    '  - dist/**/*',
    '  - dist-electron/**/*',
    'extraResources:',
    '  - from: resources/',
    '    to: resources/',
    '  - from: worker/dist/',
    '    to: resources/worker/',
    '',
    'publish:',
    '  - provider: github',
    `    owner: \${env.GH_OWNER:-${githubOwner}}`,
    `    repo: \${env.GH_REPO:-${githubRepo}}`,
    '    private: true',
    '    token: ${env.GH_TOKEN}',
    '',
    'mac:',
    '  target:',
    '    - target: dmg',
    '      arch:',
    '        - arm64',
    '        - x64',
    '  category: public.app-category.developer-tools',
    '  hardenedRuntime: true',
    '  gatekeeperAssess: false',
    '  entitlements: build/entitlements.mac.plist',
    '  entitlementsInherit: build/entitlements.mac.plist',
    '  notarize:',
    '    teamId: ${env.APPLE_TEAM_ID}',
    '',
    'win:',
    '  target: nsis',
    '  signingHashAlgorithms:',
    '    - sha256',
    '',
    'linux:',
    '  target: AppImage',
    '',
  ].join('\n');
}

function getElectronBuilderS3Config(): string {
  return [
    'extends: electron-builder.yml',
    '',
    'publish:',
    '  - provider: generic',
    '    url: ${env.S3_UPDATE_URL}',
    '    channel: latest',
    '',
  ].join('\n');
}

function getMacEntitlements(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>com.apple.security.cs.allow-jit</key>',
    '  <true/>',
    '  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>',
    '  <true/>',
    '  <key>com.apple.security.cs.allow-dyld-environment-variables</key>',
    '  <true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

function getSetupPythonScript(): string {
  return [
    '#!/bin/bash',
    'set -e',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    'PYTHON_BIN="${PYTHON:-python3}"',
    '',
    'cd "$ROOT_DIR"',
    '',
    '$PYTHON_BIN -m venv worker/.venv',
    'source worker/.venv/bin/activate',
    'python -m pip install --upgrade pip',
    'python -m pip install -r worker/requirements.txt',
    '',
    'echo "Python environment ready: $ROOT_DIR/worker/.venv"',
    '',
  ].join('\n');
}

function getBuildWorkerScript(): string {
  return [
    '#!/bin/bash',
    'set -e',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'if [ ! -d "worker/.venv" ]; then',
    '  bash scripts/setup-python.sh',
    'fi',
    '',
    'source worker/.venv/bin/activate',
    'python -m pip install pyinstaller',
    '',
    'cd worker',
    'python -m PyInstaller --onefile --name forge-worker main.py',
    '',
    'echo "Worker built: $ROOT_DIR/worker/dist/forge-worker"',
    '',
  ].join('\n');
}

function getBuildAppScript(): string {
  return [
    '#!/bin/bash',
    'set -e',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'echo "=== Step 1: Build Python worker ==="',
    'bash scripts/build-worker.sh',
    '',
    'echo "=== Step 2: Build Electron app ==="',
    'pnpm build',
    '',
    'echo "=== Step 3: Package desktop app ==="',
    'pnpm package',
    '',
  ].join('\n');
}

function getPreflightReleaseScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'REQUIRED_FILES=(',
    '  "electron-builder.yml"',
    '  "scripts/build-worker.sh"',
    '  "scripts/build-app.sh"',
    '  "worker/main.py"',
    '  ".github/workflows/release.yml"',
    ')',
    '',
    'for file in "${REQUIRED_FILES[@]}"; do',
    '  if [ ! -f "$file" ]; then',
    '    echo "Missing required release file: $file"',
    '    exit 1',
    '  fi',
    'done',
    '',
    'if ! command -v pnpm >/dev/null 2>&1; then',
    '  echo "pnpm is required for local packaging."',
    '  exit 1',
    'fi',
    '',
    'PYTHON_BIN="${PYTHON:-python3}"',
    'if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then',
    '  echo "Python 3 is required. Set PYTHON if your binary is not python3."',
    '  exit 1',
    'fi',
    '',
    'if ! grep -q "^appId:" electron-builder.yml; then',
    '  echo "electron-builder.yml is missing appId."',
    '  exit 1',
    'fi',
    '',
    'if ! grep -q "^productName:" electron-builder.yml; then',
    '  echo "electron-builder.yml is missing productName."',
    '  exit 1',
    'fi',
    '',
    'echo "Release preset looks healthy."',
    'echo "Next:"',
    'echo "  1. Fill in .env for local packaging or GitHub Secrets for CI releases."',
    'echo "  2. Run pnpm setup:python"',
    'echo "  3. Run pnpm build:app"',
    '',
  ].join('\n');
}

function getGitignoreContents(): string {
  return [
    'node_modules',
    'dist',
    'dist-electron',
    'release',
    '.DS_Store',
    '.env',
    '.env.local',
    'worker/.venv',
    'worker/dist',
    'worker/build',
    'worker/__pycache__',
    '*.pyc',
    '',
  ].join('\n');
}

function getMinimalElectronMainSource(
  projectName: string,
  features: ScaffoldFeature[],
  metadata: ScaffoldMetadata,
): string {
  const useSettings = features.includes('settings');
  const useJobs = features.includes('jobs');
  const useUpdater = features.includes('updater');
  const useDiagnostics = features.includes('diagnostics');
  const useNotifications = features.includes('notifications');
  const useWindowing = features.includes('windowing');
  const useTray = features.includes('tray');
  const useDeepLink = features.includes('deep-link');
  const useMenuBar = features.includes('menu-bar');
  const useAutoLaunch = features.includes('auto-launch');
  const productName = resolveProductName(projectName, metadata);
  const appId = resolveAppId(projectName, metadata);
  const supportFolder = `${toIdentifier(projectName)}-support`;
  const protocolScheme = `${toIdentifier(projectName)}`;

  return `import { app, BrowserWindow, ipcMain${useNotifications ? ', Notification' : ''}${useTray || useMenuBar ? ', Menu' : ''}${useTray ? ', Tray, nativeImage' : ''}${useMenuBar ? ', type MenuItemConstructorOptions' : ''} } from 'electron';
import path from 'node:path';
${useDiagnostics || useWindowing ? `import { ${[useDiagnostics || useWindowing ? 'readFile' : '', 'writeFile', ...(useDiagnostics ? ['mkdir'] : [])].filter(Boolean).join(', ')} } from 'node:fs/promises';\n` : ''}import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';
${useSettings ? "import { createSettingsManager } from '@forge/settings-core';\n" : ''}${useJobs ? "import { createJobEngine } from '@forge/job-engine';\n" : ''}${useUpdater ? "import { createUpdater } from '@forge/updater';\n" : ''}
const logger = createLogger('main');
let mainWindow: BrowserWindow | null = null;
${useTray ? 'let appTray: Tray | null = null;\n' : ''}
${useMenuBar ? 'let menuInstalled = false;\n' : ''}

const isDev = !app.isPackaged;
const appRoot = isDev ? path.resolve(__dirname, '..') : app.getAppPath();
const monorepoRoot = isDev ? path.resolve(__dirname, '../../..') : undefined;

const resourceManager = createResourceManager({
  isDev,
  appRoot,
  resourcesPath: isDev && monorepoRoot ? path.join(monorepoRoot, 'resources') : undefined,
});

const workerClient = createWorkerClient({
  workerPath: resourceManager.getWorkerPath(),
  pythonPath: resourceManager.getPythonPath(),
  isDev,
});

const enabledFeatures = ${JSON.stringify(features)};
${useSettings ? "const settingsManager = createSettingsManager(path.join(app.getPath('userData'), 'settings.json'));\n" : ''}${useJobs ? 'const jobEngine = createJobEngine(workerClient);\n' : ''}${useUpdater ? "const updater = createUpdater({ autoDownload: false, autoInstallOnAppQuit: true });\n" : ''}${useWindowing ? `
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
type WindowState = {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  maximized: boolean;
};

const defaultWindowState: WindowState = {
  width: 900,
  height: 680,
  x: null,
  y: null,
  maximized: false,
};
let windowState: WindowState = { ...defaultWindowState };

async function loadWindowState() {
  try {
    const raw = await readFile(windowStatePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    windowState = {
      width: typeof parsed.width === 'number' ? parsed.width : defaultWindowState.width,
      height: typeof parsed.height === 'number' ? parsed.height : defaultWindowState.height,
      x: typeof parsed.x === 'number' ? parsed.x : null,
      y: typeof parsed.y === 'number' ? parsed.y : null,
      maximized: parsed.maximized === true,
    };
  } catch {
    windowState = { ...defaultWindowState };
  }
}

async function saveWindowState(win: BrowserWindow) {
  const bounds = win.getBounds();
  windowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    maximized: win.isMaximized(),
  };
  await writeFile(windowStatePath, JSON.stringify(windowState, null, 2), 'utf-8');
}

async function resetWindowState() {
  windowState = { ...defaultWindowState };
  await writeFile(windowStatePath, JSON.stringify(windowState, null, 2), 'utf-8');
}

function getCurrentWindowState() {
  const bounds = mainWindow?.getBounds() ?? {
    width: windowState.width,
    height: windowState.height,
    x: windowState.x ?? undefined,
    y: windowState.y ?? undefined,
  };

  return {
    width: bounds.width,
    height: bounds.height,
    x: typeof bounds.x === 'number' ? bounds.x : null,
    y: typeof bounds.y === 'number' ? bounds.y : null,
    maximized: mainWindow?.isMaximized() ?? windowState.maximized,
    focused: mainWindow?.isFocused() ?? false,
  };
}

` : ''}${useDiagnostics ? `
async function getDiagnosticsSummary() {
  return {
    productName: ${JSON.stringify(productName)},
    appId: ${JSON.stringify(appId)},
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    logsPath: app.getPath('logs'),
    workerPath: resourceManager.getWorkerPath(),
    pythonPath: resourceManager.getPythonPath(),
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron,
    enabledFeatures,
  };
}

function createDiagnosticsFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return \`${toIdentifier(projectName)}-diagnostics-\${stamp}.json\`;
}

async function exportDiagnosticsBundle() {
  const supportDir = path.join(app.getPath('downloads'), ${JSON.stringify(supportFolder)});
  await mkdir(supportDir, { recursive: true });
  const filePath = path.join(supportDir, createDiagnosticsFileName());
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: await getDiagnosticsSummary(),
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { filePath, generatedAt: payload.generatedAt };
}
` : ''}${useTray ? `
const trayIcon = nativeImage.createFromDataURL(
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Crect x=%222%22 y=%222%22 width=%2212%22 height=%2212%22 rx=%223%22 fill=%22black%22/%3E%3C/svg%3E',
);
trayIcon.setTemplateImage(true);

function getTrayStatus() {
  return {
    enabled: Boolean(appTray),
    windowVisible: mainWindow?.isVisible() ?? false,
  };
}

function toggleMainWindowVisibility() {
  if (!mainWindow) {
    createWindow();
    return getTrayStatus();
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }

  return getTrayStatus();
}

function createTray() {
  if (appTray) {
    return;
  }

  appTray = new Tray(trayIcon);
  appTray.setToolTip(${JSON.stringify(productName)});
  appTray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show or Hide',
      click: () => {
        toggleMainWindowVisibility();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]));
  appTray.on('click', () => {
    toggleMainWindowVisibility();
  });
}
` : ''}${useDeepLink ? `
let lastDeepLink: string | null = null;

function captureDeepLink(url: string | null | undefined) {
  if (!url) {
    return getDeepLinkState();
  }

  if (!url.startsWith(${JSON.stringify(`${protocolScheme}://`)})) {
    return getDeepLinkState();
  }

  lastDeepLink = url;
  return getDeepLinkState();
}

function getDeepLinkState() {
  return {
    scheme: ${JSON.stringify(protocolScheme)},
    lastUrl: lastDeepLink,
  };
}

function findProtocolArg(args: string[]) {
  return args.find((value) => value.startsWith(${JSON.stringify(`${protocolScheme}://`)})) ?? null;
}
` : ''}${useMenuBar ? `
function buildApplicationMenu() {
  const macMenu: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [{
        label: ${JSON.stringify(productName)},
        submenu: [
          { role: 'about' as const },
          { type: 'separator' as const },
          { role: 'services' as const },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
          { role: 'quit' as const },
        ] satisfies MenuItemConstructorOptions[],
      }]
    : [];

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'Show Main Window',
        click: () => {
          if (!mainWindow) {
            createWindow();
            return;
          }

          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }

          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' as const },
      ...(process.platform === 'darwin' ? [{ role: 'close' as const }] : [{ role: 'quit' as const }]),
    ] satisfies MenuItemConstructorOptions[],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { role: 'reload' as const },
      { role: 'forceReload' as const },
      { role: 'togglefullscreen' as const },
      ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
    ] satisfies MenuItemConstructorOptions[],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [
      { role: 'minimize' as const },
      { role: 'zoom' as const },
      ...(process.platform === 'darwin' ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
    ] satisfies MenuItemConstructorOptions[],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: 'Help',
    submenu: [
      {
        label: 'About ${productName}',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
    ] satisfies MenuItemConstructorOptions[],
  };

  return Menu.buildFromTemplate([...macMenu, fileMenu, viewMenu, windowMenu, helpMenu]);
}

function installApplicationMenu() {
  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu);
  menuInstalled = true;
}

function getMenuState() {
  return {
    enabled: menuInstalled,
    itemLabels: Menu.getApplicationMenu()?.items.map((item) => item.label || '').filter((value) => value.length > 0) ?? [],
  };
}
` : ''}${useAutoLaunch ? `
function isAutoLaunchSupported() {
  return process.platform === 'darwin' || process.platform === 'win32';
}

function getAutoLaunchState() {
  const supported = isAutoLaunchSupported();
  const settings = supported ? app.getLoginItemSettings() : null;

  return {
    supported,
    enabled: supported ? settings?.openAtLogin === true : false,
    openAsHidden: supported ? settings?.openAsHidden === true : false,
  };
}

function setAutoLaunchEnabled(enabled: boolean) {
  if (!isAutoLaunchSupported()) {
    return getAutoLaunchState();
  }

  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
    });
  } else {
    app.setLoginItemSettings({
      openAtLogin: enabled,
    });
  }

  return getAutoLaunchState();
}
` : ''}
function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

${useSettings ? `  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsManager.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, key: string, value: unknown) => {
    settingsManager.set(key as never, value as never);
    await settingsManager.save();
  });

` : ''}${useJobs ? `  ipcMain.handle(IPC_CHANNELS.JOB_SUBMIT, async (_event, action: string, payload: Record<string, unknown>) => {
    return jobEngine.submit(action, payload);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, async (_event, jobId: string) => {
    jobEngine.cancel(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_LIST, async () => {
    return jobEngine.getAllJobs();
  });

  ipcMain.handle(IPC_CHANNELS.JOB_STATUS, async (_event, jobId: string) => {
    return jobEngine.getJob(jobId);
  });

` : ''}${useUpdater ? `  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    return updater.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    await updater.downloadUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    updater.quitAndInstall();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_STATUS, async () => {
    return updater.getStatus();
  });

` : ''}${useDiagnostics ? `  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_SUMMARY, async () => {
    return getDiagnosticsSummary();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_EXPORT, async () => {
    return exportDiagnosticsBundle();
  });

` : ''}${useNotifications ? `  ipcMain.handle(IPC_CHANNELS.NOTIFY_SHOW, async (_event, title: string, body: string) => {
    const safeTitle = title.trim() || ${JSON.stringify(productName)};
    const safeBody = body.trim() || 'Background work completed successfully.';

    if (!Notification.isSupported()) {
      return { supported: false, delivered: false };
    }

    const notification = new Notification({
      title: safeTitle,
      body: safeBody,
      silent: false,
    });

    notification.show();
    return { supported: true, delivered: true };
  });

` : ''}${useWindowing ? `  ipcMain.handle(IPC_CHANNELS.WINDOW_STATE_GET, async () => {
    return getCurrentWindowState();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_FOCUS, async () => {
    if (!mainWindow) {
      createWindow();
      return getCurrentWindowState();
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
    return getCurrentWindowState();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_RESET, async () => {
    await resetWindowState();

    if (mainWindow) {
      mainWindow.unmaximize();
      mainWindow.setBounds({
        width: defaultWindowState.width,
        height: defaultWindowState.height,
      });
      mainWindow.center();
    }

    return getCurrentWindowState();
  });

` : ''}${useTray ? `  ipcMain.handle(IPC_CHANNELS.TRAY_STATUS_GET, async () => {
    return getTrayStatus();
  });

  ipcMain.handle(IPC_CHANNELS.TRAY_TOGGLE_WINDOW, async () => {
    return toggleMainWindowVisibility();
  });

` : ''}${useDeepLink ? `  ipcMain.handle(IPC_CHANNELS.DEEP_LINK_GET_LAST, async () => {
    return getDeepLinkState();
  });

  ipcMain.handle(IPC_CHANNELS.DEEP_LINK_OPEN, async (_event, url: string) => {
    return captureDeepLink(url);
  });

` : ''}${useMenuBar ? `  ipcMain.handle(IPC_CHANNELS.MENU_STATE_GET, async () => {
    return getMenuState();
  });

  ipcMain.handle(IPC_CHANNELS.MENU_REBUILD, async () => {
    installApplicationMenu();
    return getMenuState();
  });

` : ''}${useAutoLaunch ? `  ipcMain.handle(IPC_CHANNELS.AUTO_LAUNCH_GET_STATUS, async () => {
    return getAutoLaunchState();
  });

  ipcMain.handle(IPC_CHANNELS.AUTO_LAUNCH_SET_ENABLED, async (_event, enabled: boolean) => {
    return setAutoLaunchEnabled(enabled);
  });

` : ''}  logger.info('IPC handlers registered');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: ${useWindowing ? 'windowState.width' : '900'},
    height: ${useWindowing ? 'windowState.height' : '680'},
${useWindowing ? `    ...(typeof windowState.x === 'number' && typeof windowState.y === 'number'
      ? { x: windowState.x, y: windowState.y }
      : {}),` : ''}
    minWidth: 760,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

${useJobs ? `  jobEngine.onJobUpdate((job) => {
    mainWindow?.webContents.send(IPC_CHANNELS.JOB_UPDATE, job);
  });

` : ''}  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

${useWindowing ? `  const persistWindowState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      void saveWindowState(mainWindow);
    }
  };

  mainWindow.on('resize', persistWindowState);
  mainWindow.on('move', persistWindowState);
  mainWindow.on('maximize', persistWindowState);
  mainWindow.on('unmaximize', persistWindowState);
` : ''}

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

${useWindowing ? `  if (windowState.maximized) {
    mainWindow.maximize();
  }
` : ''}
}

${useWindowing || useDeepLink ? `const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
${useDeepLink ? '    captureDeepLink(findProtocolArg(argv));\n' : ''}    if (!mainWindow) {
      createWindow();
      return;
    }

${useWindowing || useDeepLink ? `    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
` : ''}  });
}

` : ''}${useDeepLink ? `app.on('open-url', (event, url) => {
  event.preventDefault();
  captureDeepLink(url);
});

` : ''}app.whenReady().then(async () => {
  logger.info('App starting', { isDev, appRoot });
${useSettings ? '  await settingsManager.load();\n' : ''}${useWindowing ? '  await loadWindowState();\n' : ''}  registerIpcHandlers();
${useDeepLink ? "  captureDeepLink(findProtocolArg(process.argv));\n" : ''}  createWindow();
${useTray ? '  createTray();\n' : ''}${useMenuBar ? '  installApplicationMenu();\n' : ''}${useUpdater ? `  if (app.isPackaged) {
    setTimeout(() => {
      updater.checkForUpdates().catch(() => {
        logger.info('Initial update check skipped');
      });
    }, 3000);
  }
` : ''}  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
${useWindowing ? '  if (mainWindow && !mainWindow.isDestroyed()) {\n    void saveWindowState(mainWindow);\n  }\n' : ''}${useTray ? '  appTray?.destroy();\n' : ''}${useUpdater ? '  updater.dispose();\n' : ''}${useJobs ? '  jobEngine.dispose();\n' : '  workerClient.dispose();\n'}});
`;
}

function getMinimalPreloadSource(features: ScaffoldFeature[]): string {
  const useSettings = features.includes('settings');
  const useJobs = features.includes('jobs');
  const useUpdater = features.includes('updater');
  const useDiagnostics = features.includes('diagnostics');
  const useNotifications = features.includes('notifications');
  const useWindowing = features.includes('windowing');
  const useTray = features.includes('tray');
  const useDeepLink = features.includes('deep-link');
  const useMenuBar = features.includes('menu-bar');
  const useAutoLaunch = features.includes('auto-launch');

  return `import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest${useJobs ? ', JobDefinition' : ''}${useSettings ? ', AppSettings' : ''} } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
${useSettings ? `  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (key: keyof AppSettings, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },
` : ''}${useJobs ? `  job: {
    submit: (action: string, payload: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_SUBMIT, action, payload),
    cancel: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
    list: (): Promise<JobDefinition[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_LIST),
    getStatus: (jobId: string): Promise<JobDefinition | undefined> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_STATUS, jobId),
    onUpdate: (cb: (job: JobDefinition) => void) => {
      const listener = (_event: unknown, job: JobDefinition) => cb(job);
      ipcRenderer.on(IPC_CHANNELS.JOB_UPDATE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_UPDATE, listener);
    },
  },
` : ''}${useUpdater ? `  updater: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_STATUS),
  },
` : ''}${useDiagnostics ? `  diagnostics: {
    getSummary: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_SUMMARY),
    exportBundle: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_EXPORT),
  },
` : ''}${useNotifications ? `  notifications: {
    show: (title: string, body: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFY_SHOW, title, body),
  },
` : ''}${useWindowing ? `  windowing: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_STATE_GET),
    focus: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FOCUS),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_RESET),
  },
` : ''}${useTray ? `  tray: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TRAY_STATUS_GET),
    toggleWindow: () => ipcRenderer.invoke(IPC_CHANNELS.TRAY_TOGGLE_WINDOW),
  },
` : ''}${useDeepLink ? `  deepLink: {
    getLast: () => ipcRenderer.invoke(IPC_CHANNELS.DEEP_LINK_GET_LAST),
    open: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.DEEP_LINK_OPEN, url),
  },
` : ''}${useMenuBar ? `  menuBar: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_STATE_GET),
    rebuild: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_REBUILD),
  },
` : ''}${useAutoLaunch ? `  autoLaunch: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AUTO_LAUNCH_GET_STATUS),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.AUTO_LAUNCH_SET_ENABLED, enabled),
  },
` : ''}};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
`;
}

function getFeatureStudioSource(
  projectName: string,
  features: ScaffoldFeature[],
  metadata: ScaffoldMetadata,
): string {
  const useSettings = features.includes('settings');
  const useJobs = features.includes('jobs');
  const useUpdater = features.includes('updater');
  const usePlugins = features.includes('plugins');
  const useDiagnostics = features.includes('diagnostics');
  const useNotifications = features.includes('notifications');
  const useWindowing = features.includes('windowing');
  const useTray = features.includes('tray');
  const useDeepLink = features.includes('deep-link');
  const useMenuBar = features.includes('menu-bar');
  const useAutoLaunch = features.includes('auto-launch');
  const displayName = resolveProductName(projectName, metadata);
  const protocolScheme = `${toIdentifier(projectName)}`;

  return `import { useEffect, useState } from 'react';
${useSettings || useJobs ? `import type { ${[useSettings ? 'AppSettings' : '', useJobs ? 'JobDefinition' : ''].filter(Boolean).join(', ')} } from '@forge/ipc-contract';\n` : ''}${usePlugins ? "import { forgeFeaturePlugins } from './plugins';\n" : ''}
type DiagnosticsSummary = {
  productName: string;
  appId: string;
  version: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
  appPath: string;
  userDataPath: string;
  logsPath: string;
  workerPath: string;
  pythonPath: string;
  nodeVersion: string;
  chromeVersion: string;
  electronVersion: string;
  enabledFeatures: string[];
};

type WindowStateSummary = {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  maximized: boolean;
  focused: boolean;
};

type TrayStatus = {
  enabled: boolean;
  windowVisible: boolean;
};

type DeepLinkState = {
  scheme: string;
  lastUrl: string | null;
};

type MenuBarState = {
  enabled: boolean;
  itemLabels: string[];
};

type AutoLaunchState = {
  supported: boolean;
  enabled: boolean;
  openAsHidden: boolean;
};

type ForgeDesktopAPI = {
  settings?: {
    get: () => Promise<${useSettings ? 'AppSettings' : 'unknown'}>;
    set: (key: ${useSettings ? 'keyof AppSettings' : 'string'}, value: unknown) => Promise<void>;
  };
  job?: {
    submit: (action: string, payload: Record<string, unknown>) => Promise<string> | string;
    list: () => Promise<${useJobs ? 'JobDefinition[]' : 'unknown[]'}>;
    onUpdate: (cb: (job: ${useJobs ? 'JobDefinition' : 'unknown'}) => void) => () => void;
  };
  updater?: {
    check: () => Promise<unknown>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    getStatus: () => Promise<{
      status: string;
      version?: string;
      progress?: { percent: number };
      error?: string;
    }>;
  };
  diagnostics?: {
    getSummary: () => Promise<DiagnosticsSummary>;
    exportBundle: () => Promise<{ filePath: string; generatedAt: string }>;
  };
  notifications?: {
    show: (title: string, body: string) => Promise<{ supported: boolean; delivered: boolean }>;
  };
  windowing?: {
    getState: () => Promise<WindowStateSummary>;
    focus: () => Promise<WindowStateSummary>;
    reset: () => Promise<WindowStateSummary>;
  };
  tray?: {
    getStatus: () => Promise<TrayStatus>;
    toggleWindow: () => Promise<TrayStatus>;
  };
  deepLink?: {
    getLast: () => Promise<DeepLinkState>;
    open: (url: string) => Promise<DeepLinkState>;
  };
  menuBar?: {
    getState: () => Promise<MenuBarState>;
    rebuild: () => Promise<MenuBarState>;
  };
  autoLaunch?: {
    getStatus: () => Promise<AutoLaunchState>;
    setEnabled: (enabled: boolean) => Promise<AutoLaunchState>;
  };
};

function getDesktopApi(): ForgeDesktopAPI | undefined {
  const value = (window as unknown as Record<string, unknown>).api;
  return value as ForgeDesktopAPI | undefined;
}

export function FeatureStudio() {
  const api = getDesktopApi();
${useSettings ? `  const [settings, setSettings] = useState<AppSettings | null>(null);
` : ''}${useJobs ? `  const [jobs, setJobs] = useState<JobDefinition[]>([]);
` : ''}${useUpdater ? `  const [updateStatus, setUpdateStatus] = useState<{ status: string; version?: string; progress?: { percent: number }; error?: string }>({ status: 'idle' });
` : ''}${useDiagnostics ? `  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [diagnosticsExport, setDiagnosticsExport] = useState<{ filePath: string; generatedAt: string } | null>(null);
` : ''}${useNotifications ? `  const [notificationDraft, setNotificationDraft] = useState({ title: 'Forge Ready', body: '${displayName} is ready for customer testing.' });
  const [notificationState, setNotificationState] = useState<'idle' | 'sent' | 'unsupported'>('idle');
` : ''}${useWindowing ? `  const [windowState, setWindowState] = useState<WindowStateSummary | null>(null);
` : ''}${useTray ? `  const [trayStatus, setTrayStatus] = useState<TrayStatus | null>(null);
` : ''}${useMenuBar ? `  const [menuBarState, setMenuBarState] = useState<MenuBarState | null>(null);
` : ''}${useAutoLaunch ? `  const [autoLaunchState, setAutoLaunchState] = useState<AutoLaunchState | null>(null);
` : ''}${useDeepLink ? `  const [deepLinkState, setDeepLinkState] = useState<DeepLinkState | null>(null);
  const [deepLinkDraft, setDeepLinkDraft] = useState('${protocolScheme}://open?screen=home');
` : ''}  const featureNames = ${JSON.stringify(features)};

${useSettings ? `  useEffect(() => {
    api?.settings?.get().then((next) => {
      setSettings(next);
      applyTheme(next.theme);
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
    }
  }, [settings]);
` : ''}${useJobs ? `
  useEffect(() => {
    api?.job?.list?.().then((initial) => {
      setJobs(initial.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
    }).catch(() => {});

    if (!api?.job?.onUpdate) {
      return undefined;
    }

    return api.job.onUpdate((job) => {
      setJobs((prev) => {
        const next = [job, ...prev.filter((entry) => entry.id !== job.id)];
        return next.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
      });
    });
  }, [api]);
` : ''}${useUpdater ? `
  useEffect(() => {
    if (!api?.updater?.getStatus) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.updater?.getStatus?.();
        if (active && next) {
          setUpdateStatus(next);
        }
      } catch {
        // Ignore polling failures in development.
      }
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useDiagnostics ? `
  useEffect(() => {
    api?.diagnostics?.getSummary?.().then((next) => {
      setDiagnostics(next);
    }).catch(() => {});
  }, [api]);
` : ''}${useWindowing ? `
  useEffect(() => {
    api?.windowing?.getState?.().then((next) => {
      setWindowState(next);
    }).catch(() => {});
  }, [api]);
` : ''}${useTray ? `
  useEffect(() => {
    api?.tray?.getStatus?.().then((next) => {
      setTrayStatus(next);
    }).catch(() => {});
  }, [api]);
` : ''}${useMenuBar ? `
  useEffect(() => {
    api?.menuBar?.getState?.().then((next) => {
      setMenuBarState(next);
    }).catch(() => {});
  }, [api]);
` : ''}${useAutoLaunch ? `
  useEffect(() => {
    api?.autoLaunch?.getStatus?.().then((next) => {
      setAutoLaunchState(next);
    }).catch(() => {});
  }, [api]);
` : ''}${useDeepLink ? `
  useEffect(() => {
    api?.deepLink?.getLast?.().then((next) => {
      setDeepLinkState(next);
    }).catch(() => {});
  }, [api]);
` : ''}  return (
    <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">${displayName} Feature Packs</p>
        {featureNames.map((feature) => (
          <span key={feature} className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200">
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
${useSettings ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold text-white">Settings</h3>
          <p className="mt-1 text-xs text-slate-400">Persisted desktop preferences powered by Forge settings core.</p>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Theme
              <select
                value={settings?.theme ?? 'system'}
                onChange={(event) => updateSetting(api, settings, setSettings, 'theme', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="system">system</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Worker concurrency
              <input
                type="number"
                min={1}
                max={8}
                value={settings?.concurrency ?? 1}
                onChange={(event) => updateSetting(api, settings, setSettings, 'concurrency', Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
        </section>
` : ''}${useJobs ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Background Jobs</h3>
              <p className="mt-1 text-xs text-slate-400">Queue Python work without blocking the UI.</p>
            </div>
            <button
              onClick={() => queueDemoJob(api)}
              className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
            >
              Queue demo
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {jobs.length === 0 ? (
              <p className="text-xs text-slate-500">No queued jobs yet. Use the button above to submit the bundled reverse action.</p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{job.action}</span>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{job.status}</span>
                  </div>
                  {job.progress && (
                    <p className="mt-1 text-xs text-slate-500">
                      {job.progress.current}/{job.progress.total} {job.progress.message ?? ''}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
` : ''}${useUpdater ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Updater</h3>
              <p className="mt-1 text-xs text-slate-400">Checks packaged builds against the publish target from electron-builder.</p>
            </div>
            <button
              onClick={() => api?.updater?.check?.()}
              className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
            >
              Check now
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-400">
            <p>Status: <span className="text-white">{updateStatus.status}</span></p>
            {updateStatus.version && <p>Version: <span className="text-white">{updateStatus.version}</span></p>}
            {updateStatus.progress && <p>Download: <span className="text-white">{Math.round(updateStatus.progress.percent)}%</span></p>}
            {updateStatus.error && <p className="text-rose-300">{updateStatus.error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => api?.updater?.download?.()}
                className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
              >
                Download
              </button>
              <button
                onClick={() => api?.updater?.install?.()}
                className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
              >
                Install
              </button>
            </div>
          </div>
        </section>
` : ''}${useDiagnostics ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Diagnostics</h3>
              <p className="mt-1 text-xs text-slate-400">Built-in support snapshot for release checks, bug reports, and customer handoff.</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const next = await api?.diagnostics?.exportBundle?.();
                  if (next) {
                    setDiagnosticsExport(next);
                  }
                } catch {
                  // Ignore export failures in starter apps.
                }
              }}
              className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
            >
              Export bundle
            </button>
          </div>
          {diagnostics ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Version" value={diagnostics.version} />
              <DiagnosticRow label="Runtime" value={diagnostics.isPackaged ? 'packaged' : 'development'} />
              <DiagnosticRow label="Platform" value={\`\${diagnostics.platform} / \${diagnostics.arch}\`} />
              <DiagnosticRow label="App ID" value={diagnostics.appId} />
              <DiagnosticRow label="Electron" value={diagnostics.electronVersion} />
              <DiagnosticRow label="Node / Chrome" value={\`\${diagnostics.nodeVersion} / \${diagnostics.chromeVersion}\`} />
              <DiagnosticRow label="Worker" value={diagnostics.workerPath} />
              <DiagnosticRow label="Python" value={diagnostics.pythonPath} />
              <DiagnosticRow label="Logs" value={diagnostics.logsPath} />
              <DiagnosticRow label="User Data" value={diagnostics.userDataPath} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Diagnostics summary is unavailable until the desktop bridge finishes booting.</p>
          )}
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
            Enabled features: <span className="text-white">{featureNames.join(', ')}</span>
          </div>
          {diagnosticsExport && (
            <p className="mt-2 text-xs text-amber-200">
              Support bundle exported to <span className="text-white">{diagnosticsExport.filePath}</span>
            </p>
          )}
        </section>
` : ''}${useNotifications ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              <p className="mt-1 text-xs text-slate-400">Trigger native desktop notifications for reminders, completions, and support follow-ups.</p>
            </div>
            <button
              onClick={() => sendNotification(api, notificationDraft, setNotificationState)}
              className="rounded-full border border-fuchsia-500/40 px-3 py-1 text-xs font-medium text-fuchsia-300 hover:border-fuchsia-400 hover:text-fuchsia-100"
            >
              Send sample
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Title
              <input
                type="text"
                value={notificationDraft.title}
                onChange={(event) => setNotificationDraft((prev) => ({ ...prev, title: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Body
              <textarea
                rows={3}
                value={notificationDraft.body}
                onChange={(event) => setNotificationDraft((prev) => ({ ...prev, body: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <p className="text-xs text-slate-500">
              Status:{' '}
              <span className="text-white">
                {notificationState === 'idle' ? 'ready' : notificationState === 'sent' ? 'delivered' : 'not supported on this platform'}
              </span>
            </p>
          </div>
        </section>
` : ''}${useWindowing ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Windowing</h3>
              <p className="mt-1 text-xs text-slate-400">Restore window bounds between launches and keep duplicate launches focused on the active window.</p>
            </div>
            <button
              onClick={() => runWindowAction(api, 'focus', setWindowState)}
              className="rounded-full border border-indigo-500/40 px-3 py-1 text-xs font-medium text-indigo-300 hover:border-indigo-400 hover:text-indigo-100"
            >
              Focus app
            </button>
          </div>
          {windowState ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Size" value={\`\${windowState.width} × \${windowState.height}\`} />
              <DiagnosticRow label="Position" value={windowState.x === null || windowState.y === null ? 'centered' : \`\${windowState.x}, \${windowState.y}\`} />
              <DiagnosticRow label="Maximized" value={windowState.maximized ? 'yes' : 'no'} />
              <DiagnosticRow label="Focused" value={windowState.focused ? 'yes' : 'no'} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Window state becomes available after the desktop bridge initializes.</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => runWindowAction(api, 'reset', setWindowState)}
              className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
            >
              Reset bounds
            </button>
          </div>
        </section>
` : ''}${useTray ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">System Tray</h3>
              <p className="mt-1 text-xs text-slate-400">Keep the app one click away with a tray icon and starter show or hide controls.</p>
            </div>
            <button
              onClick={() => toggleTrayWindow(api, setTrayStatus)}
              className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
            >
              {trayStatus?.windowVisible ? 'Hide window' : 'Show window'}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Tray Enabled" value={trayStatus?.enabled ? 'yes' : 'no'} />
            <DiagnosticRow label="Window Visible" value={trayStatus?.windowVisible ? 'yes' : 'no'} />
          </div>
        </section>
` : ''}${useDeepLink ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Deep Links</h3>
              <p className="mt-1 text-xs text-slate-400">Capture app protocol URLs and simulate link-driven navigation flows during development.</p>
            </div>
            <button
              onClick={() => openDeepLink(api, deepLinkDraft, setDeepLinkState)}
              className="rounded-full border border-lime-500/40 px-3 py-1 text-xs font-medium text-lime-300 hover:border-lime-400 hover:text-lime-100"
            >
              Open link
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Protocol URL
              <input
                type="text"
                value={deepLinkDraft}
                onChange={(event) => setDeepLinkDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Scheme" value={deepLinkState?.scheme ?? '${protocolScheme}'} />
              <DiagnosticRow label="Last URL" value={deepLinkState?.lastUrl ?? 'none captured yet'} />
            </div>
          </div>
        </section>
` : ''}${useMenuBar ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Menu Bar</h3>
              <p className="mt-1 text-xs text-slate-400">Ship a starter application menu with the standard desktop commands users expect.</p>
            </div>
            <button
              onClick={() => rebuildMenuBar(api, setMenuBarState)}
              className="rounded-full border border-orange-500/40 px-3 py-1 text-xs font-medium text-orange-300 hover:border-orange-400 hover:text-orange-100"
            >
              Rebuild menu
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Menu Enabled" value={menuBarState?.enabled ? 'yes' : 'no'} />
            <DiagnosticRow label="Top Level Items" value={menuBarState?.itemLabels.join(', ') || 'none'} />
          </div>
        </section>
` : ''}${useAutoLaunch ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Auto Launch</h3>
              <p className="mt-1 text-xs text-slate-400">Toggle whether the packaged app starts automatically at user login on supported desktop platforms.</p>
            </div>
            <button
              onClick={() => toggleAutoLaunch(api, autoLaunchState, setAutoLaunchState)}
              className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
            >
              {autoLaunchState?.enabled ? 'Disable launch at login' : 'Enable launch at login'}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Supported" value={autoLaunchState?.supported ? 'yes' : 'no'} />
            <DiagnosticRow label="Enabled" value={autoLaunchState?.enabled ? 'yes' : 'no'} />
            <DiagnosticRow label="Hidden Start" value={autoLaunchState?.openAsHidden ? 'yes' : 'no'} />
            <DiagnosticRow label="Scope" value="current user login" />
          </div>
        </section>
` : ''}${usePlugins ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length === 1 ? 'md:col-span-2' : ''}">
          <h3 className="text-sm font-semibold text-white">Plugin Registry</h3>
          <p className="mt-1 text-xs text-slate-400">Sample plugin slots are ready for feature-oriented modules.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {forgeFeaturePlugins.map((plugin) => (
              <div key={plugin.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{plugin.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{plugin.version}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{plugin.description ?? 'No description provided.'}</p>
              </div>
            ))}
          </div>
        </section>
` : ''}      </div>
    </div>
  );
}

${useSettings ? `function updateSetting(
  api: ForgeDesktopAPI | undefined,
  current: AppSettings | null,
  setState: (next: AppSettings) => void,
  key: keyof AppSettings,
  value: AppSettings[keyof AppSettings],
) {
  const next = { ...(current ?? {}), [key]: value } as AppSettings;
  setState(next);
  api?.settings?.set(key, value).catch(() => {});
}

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement;
  const resolved = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme === 'dark';
  root.classList.toggle('dark', resolved);
}

` : ''}${useJobs ? `async function queueDemoJob(api: ForgeDesktopAPI | undefined) {
  try {
    await api?.job?.submit?.('reverse', { text: 'Queued from Feature Studio' });
  } catch {
    // Ignore demo failures in starter apps.
  }
}
` : ''}${useNotifications ? `

async function sendNotification(
  api: ForgeDesktopAPI | undefined,
  draft: { title: string; body: string },
  setState: (next: 'idle' | 'sent' | 'unsupported') => void,
) {
  try {
    const result = await api?.notifications?.show?.(draft.title, draft.body);
    setState(result?.supported ? 'sent' : 'unsupported');
  } catch {
    setState('unsupported');
  }
}
` : ''}${useWindowing ? `

async function runWindowAction(
  api: ForgeDesktopAPI | undefined,
  action: 'focus' | 'reset',
  setState: (next: WindowStateSummary) => void,
) {
  try {
    const next = action === 'focus'
      ? await api?.windowing?.focus?.()
      : await api?.windowing?.reset?.();

    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter windowing failures.
  }
}
` : ''}${useTray ? `

async function toggleTrayWindow(
  api: ForgeDesktopAPI | undefined,
  setState: (next: TrayStatus) => void,
) {
  try {
    const next = await api?.tray?.toggleWindow?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter tray failures.
  }
}
` : ''}${useDeepLink ? `

async function openDeepLink(
  api: ForgeDesktopAPI | undefined,
  url: string,
  setState: (next: DeepLinkState) => void,
) {
  try {
    const next = await api?.deepLink?.open?.(url);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter deep-link failures.
  }
}
` : ''}${useMenuBar ? `

async function rebuildMenuBar(
  api: ForgeDesktopAPI | undefined,
  setState: (next: MenuBarState) => void,
) {
  try {
    const next = await api?.menuBar?.rebuild?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter menu-bar failures.
  }
}
` : ''}${useAutoLaunch ? `

async function toggleAutoLaunch(
  api: ForgeDesktopAPI | undefined,
  current: AutoLaunchState | null,
  setState: (next: AutoLaunchState) => void,
) {
  try {
    const next = await api?.autoLaunch?.setEnabled?.(!(current?.enabled ?? false));
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter auto-launch failures.
  }
}
` : ''}${useDiagnostics || useWindowing || useTray || useDeepLink || useMenuBar || useAutoLaunch ? `

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 break-all text-xs text-white">{value}</p>
    </div>
  );
}
` : ''}
`;
}

function getPluginRegistrySource(projectName: string, metadata: ScaffoldMetadata): string {
  const productName = resolveProductName(projectName, metadata);

  return `import { createPluginRegistry } from '@forge/plugin-system';

export const forgePluginRegistry = createPluginRegistry();

forgePluginRegistry.register({
  id: 'workspace-overview',
  name: 'Workspace Overview',
  version: '1.0.0',
  description: 'Starter navigation and release surface for ${productName}.',
});

forgePluginRegistry.register({
  id: 'automation-lab',
  name: 'Automation Lab',
  version: '1.0.0',
  description: 'Reserved slot for background worker and job-oriented tools.',
});

forgePluginRegistry.register({
  id: 'inspector',
  name: 'Inspector',
  version: '1.0.0',
  description: 'Reserved slot for diagnostics, logs, and support workflows.',
});

export const forgeFeaturePlugins = forgePluginRegistry.getAll();
`;
}

function toProductName(projectName: string): string {
  return projectName
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(' ');
}

function toIdentifier(projectName: string): string {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function resolveProductName(projectName: string, metadata: ScaffoldMetadata): string {
  return metadata.productName?.trim() || toProductName(projectName);
}

function resolveAppId(projectName: string, metadata: ScaffoldMetadata): string {
  return metadata.appId?.trim() || `com.forge.${toIdentifier(projectName)}`;
}

function resolveGithubOwner(metadata: ScaffoldMetadata): string {
  return metadata.githubOwner?.trim() || 'your-github-org-or-user';
}

function resolveGithubRepo(projectName: string, metadata: ScaffoldMetadata): string {
  return metadata.githubRepo?.trim() || toIdentifier(projectName);
}

function getEnvExample(projectName: string, metadata: ScaffoldMetadata): string {
  const productName = resolveProductName(projectName, metadata);
  const repository = resolveGithubRepo(projectName, metadata);
  const githubOwner = resolveGithubOwner(metadata);

  return [
    `# ${productName} release environment`,
    '# Copy to .env for local packaging helpers, or map the same values to GitHub Actions secrets and variables.',
    '',
    '# GitHub release publishing',
    `GH_OWNER=${githubOwner}`,
    `GH_REPO=${repository}`,
    'GH_TOKEN=ghp_your_token',
    '',
    '# macOS signing and notarization',
    'CSC_LINK=base64://your-macos-certificate',
    'CSC_KEY_PASSWORD=your-macos-certificate-password',
    'APPLE_ID=your-apple-id@example.com',
    'APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx',
    'APPLE_TEAM_ID=YOUR_TEAM_ID',
    '',
    '# Windows signing',
    'WIN_CSC_LINK=base64://your-windows-certificate',
    'WIN_CSC_KEY_PASSWORD=your-windows-certificate-password',
    '',
    '# Optional generic/S3 auto-update publishing',
    'S3_UPDATE_URL=https://downloads.example.com/releases',
    'AWS_ACCESS_KEY_ID=your-access-key',
    'AWS_SECRET_ACCESS_KEY=your-secret-key',
    'AWS_REGION=auto',
    'S3_BUCKET=your-bucket',
    'S3_ENDPOINT=https://your-r2-or-s3-endpoint',
    '',
  ].join('\n');
}

function getValidateWorkflow(): string {
  return [
    'name: Validate',
    '',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '    branches: [main]',
    '',
    'jobs:',
    '  validate:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '',
    '      - uses: pnpm/action-setup@v4',
    '        with:',
    '          version: 10',
    '',
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '20'",
    "          cache: 'pnpm'",
    '',
    '      - uses: actions/setup-python@v5',
    '        with:',
    "          python-version: '3.12'",
    '',
    '      - name: Install dependencies',
    '        run: pnpm install',
    '',
    '      - name: Release preflight',
    '        run: pnpm release:check',
    '',
    '      - name: Type check',
    '        run: pnpm typecheck',
    '',
    '      - name: Build worker bundle',
    '        run: pnpm build:worker',
    '',
    '      - name: Build desktop app',
    '        run: pnpm build',
    '',
  ].join('\n');
}

function getReleaseWorkflow(): string {
  return [
    'name: Release',
    '',
    'on:',
    '  push:',
    '    tags:',
    "      - 'v*'",
    '',
    'jobs:',
    '  package:',
    '    runs-on: ${{ matrix.os }}',
    '    strategy:',
    '      matrix:',
    '        include:',
    '          - os: ubuntu-latest',
    '            platform: linux',
    '          - os: windows-latest',
    '            platform: win',
    '          - os: macos-14',
    '            platform: mac',
    '',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '',
    '      - uses: pnpm/action-setup@v4',
    '        with:',
    '          version: 10',
    '',
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '20'",
    "          cache: 'pnpm'",
    '',
    '      - uses: actions/setup-python@v5',
    '        with:',
    "          python-version: '3.12'",
    '',
    '      - name: Install dependencies',
    '        run: pnpm install',
    '',
    '      - name: Verify release preset',
    '        run: pnpm release:check',
    '',
    '      - name: Build worker bundle',
    '        run: pnpm build:worker',
    '',
    '      - name: Build desktop app',
    '        run: pnpm build',
    '',
    '      - name: Publish desktop artifacts',
    '        env:',
    '          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    '          CSC_LINK: ${{ secrets.CSC_LINK }}',
    '          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}',
    '          APPLE_ID: ${{ secrets.APPLE_ID }}',
    '          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}',
    '          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}',
    '          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}',
    '          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}',
    '          GH_OWNER: ${{ vars.GH_OWNER }}',
    '          GH_REPO: ${{ vars.GH_REPO }}',
    '        run: pnpm package -- --publish always',
    '',
  ].join('\n');
}

function getReleasePlaybook(projectName: string, metadata: ScaffoldMetadata): string {
  const productName = resolveProductName(projectName, metadata);
  const appId = resolveAppId(projectName, metadata);
  const githubTarget = `${resolveGithubOwner(metadata)}/${resolveGithubRepo(projectName, metadata)}`;

  return [
    `# ${productName} Release Playbook`,
    '',
    '## 1. Set Metadata',
    '',
    `- Verify \`electron-builder.yml\` still matches your release identity: \`${productName}\` / \`${appId}\`.`,
    '- Replace placeholder icons and assets inside `build/` and `resources/`.',
    '- Confirm `package.json` version before tagging a release.',
    '',
    '## 2. Configure Secrets',
    '',
    '- Copy `.env.example` to `.env` for local packaging smoke tests.',
    '- Add the same values as GitHub Actions secrets and variables for CI releases.',
    `- Default GitHub target for publishing is \`${githubTarget}\`. Override with \`GH_OWNER\` and \`GH_REPO\` if needed.`,
    '- macOS signing requires `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.',
    '- Windows signing requires `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.',
    '',
    '## 3. Local Smoke Test',
    '',
    '```bash',
    'pnpm install',
    'pnpm release:check',
    'pnpm setup:python',
    'pnpm build:app',
    '```',
    '',
    '## 4. CI Release',
    '',
    '```bash',
    'git tag v0.1.0',
    'git push origin v0.1.0',
    '```',
    '',
    'Pushing a `v*` tag triggers `.github/workflows/release.yml` and publishes artifacts via `electron-builder`.',
    '',
    '## 5. Auto-Update Channel',
    '',
    `- GitHub Releases works out of the box for \`${githubTarget}\` unless you override \`GH_OWNER\` and \`GH_REPO\`.`,
    '- For generic/S3 hosting, switch to `electron-builder.s3.yml` and populate the S3 variables in `.env.example`.',
    '',
  ].join('\n');
}

function getAppShellSource(
  projectName: string,
  template: Template,
  features: ScaffoldFeature[],
  metadata: ScaffoldMetadata,
): string {
  const displayName = resolveProductName(projectName, metadata);
  const featureStudioImport = features.length > 0
    ? "import { FeatureStudio } from './FeatureStudio';\n"
    : '';
  const featureStudioPanel = features.length > 0
    ? '            <FeatureStudio />\n'
    : '';

  return `import { useEffect, useState, type ReactNode } from 'react';
import { LogConsole, type LogItem } from '@forge/ui-kit';
${featureStudioImport}

const APP_NAME = ${JSON.stringify(displayName)};
const TEMPLATE_NAME = ${JSON.stringify(template.label)};
const MAX_LOGS = 200;

export interface ForgeAppShellProps {
  children: ReactNode;
}

export function ForgeAppShell({ children }: ForgeAppShellProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);

  useEffect(() => {
    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    const push = (level: LogItem['level'], source: string, message: string) => {
      setLogs((prev) => {
        const next = [...prev, { timestamp: Date.now(), level, source, message }];
        return next.slice(-MAX_LOGS);
      });
    };

    push('info', 'forge', \`\${APP_NAME} booted (\${TEMPLATE_NAME} template)\`);

    console.log = (...args) => {
      push('info', 'renderer', formatArgs(args));
      original.log(...args);
    };

    console.info = (...args) => {
      push('info', 'renderer', formatArgs(args));
      original.info(...args);
    };

    console.warn = (...args) => {
      push('warn', 'renderer', formatArgs(args));
      original.warn(...args);
    };

    console.error = (...args) => {
      push('error', 'renderer', formatArgs(args));
      original.error(...args);
    };

    const handleError = (event: ErrorEvent) => {
      push('error', 'window', event.message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      push('error', 'promise', formatArgs([event.reason]));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.log = original.log;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950/5">
      {children}

      <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
        {open && (
          <div className="w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Forge Runtime</p>
                <h2 className="text-sm font-semibold text-white">{APP_NAME}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Close
              </button>
            </div>
${featureStudioPanel}            <LogConsole logs={logs} maxHeight={240} />
          </div>
        )}

        <button
          onClick={() => setOpen((value) => !value)}
          className="rounded-full border border-slate-800 bg-slate-950 px-4 py-3 text-left shadow-xl transition hover:border-slate-600"
        >
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Forge</p>
              <p className="text-sm font-medium text-white">Logs {logs.length > 0 ? \`(\${logs.length})\` : ''}</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function formatArgs(args: unknown[]): string {
  return args
    .map((value) => {
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(' ');
}
`;
}
