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
      'pnpm security:check',
      'pnpm ops:check',
      'pnpm ops:snapshot',
      'pnpm ops:evidence',
      'pnpm ops:report',
      'pnpm ops:bundle',
      'pnpm ops:index',
      'pnpm ops:doctor',
      'pnpm ops:handoff',
      'pnpm ops:attest',
      'pnpm ops:ready',
      'pnpm ops:gate',
      'pnpm ops:releasepack',
      'pnpm ops:export',
      'pnpm ops:restore',
      'pnpm ops:recover',
      'pnpm ops:retention',
      'pnpm production:check',
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
      '- Run `pnpm security:check` to confirm the Electron shell still matches the framework security baseline',
      '- Run `pnpm ops:check` to confirm log retention and crash-dump retention still match the production baseline',
      '- Run `pnpm ops:snapshot` when you want an operator-facing JSON and Markdown snapshot of the current release surface',
      '- Run `pnpm ops:evidence` when you want a reusable evidence bundle with the latest ops snapshot, release manifests, and production docs',
      '- Run `pnpm ops:report` when you want one operator-facing report that summarizes the latest snapshot, evidence bundle, index, and release output surface',
      '- Run `pnpm ops:bundle` when you want one portable archive with the latest snapshot, evidence bundle, report, docs, env template, and release manifest inventory',
      '- Run `pnpm ops:index` when you want one inventory view of the current `ops/snapshots/`, `ops/evidence/`, `ops/reports/`, `ops/bundles/`, `ops/doctors/`, `ops/handoffs/`, `ops/attestations/`, `ops/ready/`, `ops/gates/`, `ops/releasepacks/`, `ops/exports/`, `ops/restores/`, and `ops/recoveries/` directories',
      '- Run `pnpm ops:doctor` when you want one final JSON and Markdown verdict that the latest ops surfaces are present and aligned before handoff or publish',
      '- Run `pnpm ops:handoff` when you want one portable operator handoff package built from the latest doctor, bundle, report, docs, env template, and release manifests',
      '- Run `pnpm ops:attest` when you want one checksum-backed Markdown and JSON attestation for the latest bundle, handoff, ready surface, and release output under `ops/attestations/`',
      '- Run `pnpm ops:ready` when you want one production-grade command that refreshes snapshot, evidence, report, bundle, index, doctor, refreshed index, handoff, attestation, and final ready verdict under `ops/ready/`',
      '- Run `pnpm ops:gate` when you want one final Markdown and JSON go or no-go verdict under `ops/gates/` that proves the latest ready, handoff, attestation, index, and release surface are aligned for operator sign-off',
      '- Run `pnpm ops:releasepack` when you want one final portable release-evidence directory and tarball under `ops/releasepacks/` that packages the latest gate, handoff, attestation, ready, index, docs, env template, and packaged release output for operator sign-off or escalation',
      '- Run `pnpm ops:export` when you want one final offline-friendly export directory and tarball under `ops/exports/` that packages the latest release pack, gate, handoff, attestation, ready, index, docs, env template, and packaged release output for operator handoff outside CI',
      '- Run `pnpm ops:restore` when you want one final restore rehearsal under `ops/restores/` that rehydrates the latest offline export, verifies the restored payload, and leaves a Markdown and JSON proof before operator handoff outside CI',
      '- Run `pnpm ops:recover` when you want one final recovery rehearsal under `ops/recoveries/` that proves the latest restore record, gate verdict, and packaged payload are coherent enough for operator-driven recovery handoff',
      '- Run `pnpm ops:retention` to prune old `ops/snapshots/`, `ops/evidence/`, `ops/index/`, `ops/reports/`, `ops/bundles/`, `ops/doctors/`, `ops/handoffs/`, `ops/attestations/`, `ops/ready/`, `ops/gates/`, `ops/releasepacks/`, `ops/exports/`, `ops/restores/`, and `ops/recoveries/` directories before or after repeated production checks',
      '- Run `pnpm production:check` for the default GitHub channel, or `pnpm production:check:all -- --require-release-output` after packaging when you need a full multi-channel audit',
      '- Build the bundled worker with `pnpm build:worker`',
      '- Package the desktop app with `pnpm package`',
      '',
      'Detailed release steps live in `docs/release-playbook.md` and `docs/production-readiness.md`.',
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
  await writeFile(join(targetDir, 'electron-builder.yml'), getElectronBuilderConfig(projectName, metadata, features), 'utf-8');
  await writeFile(join(targetDir, 'electron-builder.s3.yml'), getElectronBuilderS3Config(), 'utf-8');
  await writeFile(join(targetDir, '.github', 'workflows', 'validate.yml'), getValidateWorkflow(), 'utf-8');
  await writeFile(join(targetDir, '.github', 'workflows', 'release.yml'), getReleaseWorkflow(), 'utf-8');
  await writeFile(join(targetDir, 'build', 'entitlements.mac.plist'), getMacEntitlements(), 'utf-8');
  await writeFile(join(targetDir, 'docs', 'release-playbook.md'), getReleasePlaybook(projectName, metadata), 'utf-8');
  await writeFile(join(targetDir, 'docs', 'production-readiness.md'), getProductionReadinessGuide(projectName, metadata), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'preflight-release.sh'), getPreflightReleaseScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'check-publish-env.sh'), getPublishEnvCheckScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'verify-package-output.sh'), getVerifyPackageOutputScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'audit-package-output.sh'), getAuditPackageOutputScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'security-baseline.sh'), getSecurityBaselineScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'runtime-hygiene.sh'), getRuntimeHygieneScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-snapshot.sh'), getOpsSnapshotScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-evidence.sh'), getOpsEvidenceScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-index.sh'), getOpsIndexScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-report.sh'), getOpsReportScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-bundle.sh'), getOpsBundleScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-doctor.sh'), getOpsDoctorScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-handoff.sh'), getOpsHandoffScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-attest.sh'), getOpsAttestationScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-ready.sh'), getOpsReadyScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-gate.sh'), getOpsGateScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-releasepack.sh'), getOpsReleasePackScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-export.sh'), getOpsExportScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-restore.sh'), getOpsRestoreScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-recover.sh'), getOpsRecoverScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'ops-retention.sh'), getOpsRetentionScript(), 'utf-8');
  await writeFile(join(targetDir, 'scripts', 'production-readiness.sh'), getProductionReadinessScript(), 'utf-8');
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
    'publish:check': 'bash scripts/check-publish-env.sh github',
    'publish:check:github': 'bash scripts/check-publish-env.sh github',
    'publish:check:s3': 'bash scripts/check-publish-env.sh s3',
    'package:verify': 'bash scripts/verify-package-output.sh github',
    'package:verify:s3': 'bash scripts/verify-package-output.sh s3',
    'package:audit': 'bash scripts/audit-package-output.sh github',
    'package:audit:s3': 'bash scripts/audit-package-output.sh s3',
    'security:check': 'bash scripts/security-baseline.sh',
    'ops:check': 'bash scripts/runtime-hygiene.sh',
    'ops:snapshot': 'bash scripts/ops-snapshot.sh',
    'ops:evidence': 'bash scripts/ops-evidence.sh',
    'ops:report': 'bash scripts/ops-report.sh',
    'ops:bundle': 'bash scripts/ops-bundle.sh',
    'ops:index': 'bash scripts/ops-index.sh',
    'ops:doctor': 'bash scripts/ops-doctor.sh',
    'ops:handoff': 'bash scripts/ops-handoff.sh',
    'ops:attest': 'bash scripts/ops-attest.sh',
    'ops:ready': 'bash scripts/ops-ready.sh',
    'ops:gate': 'bash scripts/ops-gate.sh',
    'ops:releasepack': 'bash scripts/ops-releasepack.sh',
    'ops:export': 'bash scripts/ops-export.sh',
    'ops:restore': 'bash scripts/ops-restore.sh',
    'ops:recover': 'bash scripts/ops-recover.sh',
    'ops:retention': 'bash scripts/ops-retention.sh',
    'production:check': 'bash scripts/production-readiness.sh github',
    'production:check:github': 'bash scripts/production-readiness.sh github',
    'production:check:s3': 'bash scripts/production-readiness.sh s3',
    'production:check:all': 'bash scripts/production-readiness.sh github s3',
    'setup:python': 'bash scripts/setup-python.sh',
    'build:worker': 'bash scripts/build-worker.sh',
    'build:app': 'bash scripts/build-app.sh',
    package: 'electron-builder',
    'package:s3': 'electron-builder -c electron-builder.s3.yml',
    'package:local': 'bash scripts/build-app.sh && bash scripts/verify-package-output.sh github && bash scripts/audit-package-output.sh github',
    'publish:github': 'bash scripts/check-publish-env.sh github && electron-builder --publish always',
    'publish:s3': 'bash scripts/check-publish-env.sh s3 && electron-builder -c electron-builder.s3.yml',
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

function getElectronBuilderConfig(
  projectName: string,
  metadata: ScaffoldMetadata,
  features: ScaffoldFeature[],
): string {
  const appId = resolveAppId(projectName, metadata);
  const productName = resolveProductName(projectName, metadata);
  const githubOwner = resolveGithubOwner(metadata);
  const githubRepo = resolveGithubRepo(projectName, metadata);
  const fileAssociationExtension = `${toIdentifier(projectName)}doc`;

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
    ...(features.includes('file-association')
      ? [
          '',
          'fileAssociations:',
          `  - ext: ${fileAssociationExtension}`,
          `    name: ${productName} Document`,
          `    description: Open ${productName} project documents`,
          '    role: Editor',
        ]
      : []),
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

function getPublishEnvCheckScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'TARGETS=("$@")',
    'if [ "${#TARGETS[@]}" -eq 0 ]; then',
    '  TARGETS=("github")',
    'fi',
    '',
    'for target in "${TARGETS[@]}"; do',
    '  case "$target" in',
    '    github|s3) ;;',
    '    *)',
    '      echo "Unsupported publish target: $target"',
    '      echo "Use github and/or s3."',
    '      exit 1',
    '      ;;',
    '  esac',
    'done',
    '',
    'bash scripts/preflight-release.sh',
    '',
    'missing=0',
    '',
    'require_var() {',
    '  local name="$1"',
    '  local context="$2"',
    '  if [ -z "${!name:-}" ]; then',
    '    echo "Missing required environment variable for ${context}: ${name}"',
    '    missing=1',
    '  else',
    '    echo "✓ ${name} (${context})"',
    '  fi',
    '}',
    '',
    'optional_var() {',
    '  local name="$1"',
    '  local context="$2"',
    '  if [ -z "${!name:-}" ]; then',
    '    echo "○ ${name} (${context}) optional"',
    '  else',
    '    echo "✓ ${name} (${context})"',
    '  fi',
    '}',
    '',
    'for target in "${TARGETS[@]}"; do',
    '  if [ "$target" = "github" ]; then',
    '    if [ ! -f "electron-builder.yml" ]; then',
    '      echo "Missing electron-builder.yml for GitHub publishing."',
    '      missing=1',
    '    fi',
    '    require_var "GH_TOKEN" "GitHub publish"',
    '    optional_var "GH_OWNER" "GitHub publish override"',
    '    optional_var "GH_REPO" "GitHub publish override"',
    '    optional_var "CSC_LINK" "macOS signing"',
    '    optional_var "CSC_KEY_PASSWORD" "macOS signing"',
    '    optional_var "APPLE_ID" "macOS notarization"',
    '    optional_var "APPLE_APP_SPECIFIC_PASSWORD" "macOS notarization"',
    '    optional_var "APPLE_TEAM_ID" "macOS notarization"',
    '    optional_var "WIN_CSC_LINK" "Windows signing"',
    '    optional_var "WIN_CSC_KEY_PASSWORD" "Windows signing"',
    '  fi',
    '',
    '  if [ "$target" = "s3" ]; then',
    '    if [ ! -f "electron-builder.s3.yml" ]; then',
    '      echo "Missing electron-builder.s3.yml for S3 publishing."',
    '      missing=1',
    '    fi',
    '    require_var "AWS_ACCESS_KEY_ID" "S3 publish"',
    '    require_var "AWS_SECRET_ACCESS_KEY" "S3 publish"',
    '    require_var "S3_BUCKET" "S3 publish"',
    '    require_var "S3_ENDPOINT" "S3 publish"',
    '    require_var "S3_UPDATE_URL" "S3 auto-update publish"',
    '    optional_var "AWS_REGION" "S3 publish region"',
    '  fi',
    'done',
    '',
    'if [ "$missing" -ne 0 ]; then',
    '  echo "Publish preflight failed."',
    '  exit 1',
    'fi',
    '',
    'echo "Publish preflight passed for: ${TARGETS[*]}"',
    '',
  ].join('\n');
}

function getVerifyPackageOutputScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'TARGET="${1:-github}"',
    'RELEASE_DIR="${RELEASE_DIR:-release}"',
    '',
    'case "$TARGET" in',
    '  github|s3) ;;',
    '  *)',
    '    echo "Unsupported package verification target: $TARGET"',
    '    echo "Use github or s3."',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'if [ ! -d "$RELEASE_DIR" ]; then',
    '  echo "Release directory not found: $RELEASE_DIR"',
    '  exit 1',
    'fi',
    '',
    'if [ "$TARGET" = "github" ] && [ ! -f "electron-builder.yml" ]; then',
    '  echo "Missing electron-builder.yml for package verification."',
    '  exit 1',
    'fi',
    '',
    'if [ "$TARGET" = "s3" ] && [ ! -f "electron-builder.s3.yml" ]; then',
    '  echo "Missing electron-builder.s3.yml for package verification."',
    '  exit 1',
    'fi',
    '',
    'find_matches() {',
    '  find "$RELEASE_DIR" -maxdepth 1 -type f \\( "$@" \\)',
    '}',
    '',
    'installer_files=$(find_matches -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.zip" -o -name "*.pkg" -o -name "*.deb" -o -name "*.rpm")',
    'manifest_files=$(find_matches -name "latest*.yml")',
    '',
    'if [ -z "$installer_files" ]; then',
    '  echo "No packaged installers found in $RELEASE_DIR"',
    '  exit 1',
    'fi',
    '',
    'if [ -z "$manifest_files" ]; then',
    '  echo "No update manifest files found in $RELEASE_DIR"',
    '  exit 1',
    'fi',
    '',
    'echo "Packaged installers:"',
    'printf "%s\\n" "$installer_files"',
    'echo ""',
    'echo "Update manifests:"',
    'printf "%s\\n" "$manifest_files"',
    'echo ""',
    'echo "Package output verification passed for $TARGET"',
    '',
  ].join('\n');
}

function getAuditPackageOutputScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'TARGET="${1:-github}"',
    'RELEASE_DIR="${RELEASE_DIR:-release}"',
    'APP_VERSION="$(node -p "require(\'./package.json\').version")"',
    '',
    'case "$TARGET" in',
    '  github|s3) ;;',
    '  *)',
    '    echo "Unsupported package audit target: $TARGET"',
    '    echo "Use github or s3."',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'bash scripts/verify-package-output.sh "$TARGET"',
    '',
    'manifest_files=$(find "$RELEASE_DIR" -maxdepth 1 -type f -name "latest*.yml" | sort)',
    'if [ -z "$manifest_files" ]; then',
    '  echo "No update manifests available for audit."',
    '  exit 1',
    'fi',
    '',
    'audited=0',
    'while IFS= read -r manifest; do',
    '  [ -n "$manifest" ] || continue',
    '  manifest_version="$(sed -n "s/^version:[[:space:]]*//p" "$manifest" | head -n1 | tr -d \'\\r\\\"\')"',
    '  if [ -z "$manifest_version" ]; then',
    '    echo "Manifest is missing version: $manifest"',
    '    exit 1',
    '  fi',
    '  if [ "$manifest_version" != "$APP_VERSION" ]; then',
    '    echo "Manifest version mismatch in $manifest: expected $APP_VERSION, got $manifest_version"',
    '    exit 1',
    '  fi',
    '',
    '  manifest_paths="$(sed -n "s/^path:[[:space:]]*//p" "$manifest" | tr -d \'\\r\\\"\')"',
    '  if [ -z "$manifest_paths" ]; then',
    '    echo "Manifest is missing referenced package path: $manifest"',
    '    exit 1',
    '  fi',
    '',
    '  manifest_sha="$(sed -n "s/^sha512:[[:space:]]*//p" "$manifest" | head -n1 | tr -d \'\\r\\\"\')"',
    '  if [ -z "$manifest_sha" ]; then',
    '    echo "Manifest is missing sha512: $manifest"',
    '    exit 1',
    '  fi',
    '',
    '  while IFS= read -r relative_path; do',
    '    [ -n "$relative_path" ] || continue',
    '    if [ ! -f "$RELEASE_DIR/$relative_path" ]; then',
    '      echo "Manifest references missing file: $RELEASE_DIR/$relative_path"',
    '      exit 1',
    '    fi',
    '  done <<< "$manifest_paths"',
    '',
    '  audited=$((audited + 1))',
    '  echo "Audited manifest: $manifest"',
    'done <<< "$manifest_files"',
    '',
    'if [ "$audited" -eq 0 ]; then',
    '  echo "No manifests were audited."',
    '  exit 1',
    'fi',
    '',
    'echo "Package audit passed for $TARGET at version $APP_VERSION"',
    '',
  ].join('\n');
}

function getProductionReadinessScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'REQUIRE_RELEASE_OUTPUT=0',
    'TARGETS=()',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    github|s3)',
    '      TARGETS+=("$1")',
    '      ;;',
    '    --)',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    *)',
    '      echo "Unsupported production readiness argument: $1"',
    '      echo "Use github, s3, and optionally --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'if [ "${#TARGETS[@]}" -eq 0 ]; then',
    '  TARGETS=("github")',
    'fi',
    '',
    'RELEASE_DIR="${RELEASE_DIR:-release}"',
    '',
    'echo "=== Release preflight ==="',
    'bash scripts/preflight-release.sh',
    '',
    'echo "=== Type check ==="',
    'pnpm typecheck',
    '',
    'echo "=== Electron security baseline ==="',
    'pnpm security:check',
    '',
    'echo "=== Runtime hygiene baseline ==="',
    'pnpm ops:check',
    '',
    'echo "=== Operations retention baseline ==="',
    'pnpm ops:retention',
    '',
    'snapshot_label="production-$(printf "%s-" "${TARGETS[@]}" | sed "s/-$//")"',
    '',
    'if [ -f "worker/main.py" ]; then',
    '  echo "=== Python worker environment ==="',
    '  pnpm setup:python',
    '  echo "=== Worker bundle ==="',
    '  pnpm build:worker',
    'fi',
    '',
    'echo "=== Desktop build ==="',
    'pnpm build',
    '',
    'for target in "${TARGETS[@]}"; do',
    '  echo "=== Publish preflight (${target}) ==="',
    '  pnpm "publish:check:${target}"',
    '',
    '  if [ -d "$RELEASE_DIR" ]; then',
    '    echo "=== Packaged artifact audit (${target}) ==="',
    '    if [ "$target" = "github" ]; then',
    '      pnpm package:verify',
    '      pnpm package:audit',
    '    else',
    '      pnpm package:verify:s3',
    '      pnpm package:audit:s3',
    '    fi',
    '  elif [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '    echo "Release directory not found: $RELEASE_DIR"',
    '    echo "Run pnpm package first or omit --require-release-output."',
    '    exit 1',
    '  else',
    '    echo "Skipping packaged artifact checks for ${target}; ${RELEASE_DIR} does not exist yet."',
    '  fi',
    'done',
    '',
    'echo "=== Operations recovery rehearsal (${snapshot_label}) ==="',
    'recover_args=(-- --label "$snapshot_label" --skip-retention)',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  recover_args+=(--require-release-output)',
    'fi',
    'pnpm ops:recover "${recover_args[@]}"',
    '',
    'echo "Production readiness checks passed for: ${TARGETS[*]}"',
    '',
  ].join('\n');
}

function getSecurityBaselineScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'assert_contains() {',
    '  local path="$1"',
    '  local pattern="$2"',
    '  local description="$3"',
    '',
    '  if ! grep -Fq "$pattern" "$path"; then',
    '    echo "Security baseline check failed: $description"',
    '    echo "Missing pattern: $pattern"',
    '    echo "File: $path"',
    '    exit 1',
    '  fi',
    '}',
    '',
    'assert_not_contains() {',
    '  local path="$1"',
    '  local pattern="$2"',
    '  local description="$3"',
    '',
    '  if grep -Fq "$pattern" "$path"; then',
    '    echo "Security baseline check failed: $description"',
    '    echo "Unexpected pattern: $pattern"',
    '    echo "File: $path"',
    '    exit 1',
    '  fi',
    '}',
    '',
    'MAIN_FILE="electron/main.ts"',
    'PRELOAD_FILE="electron/preload.ts"',
    '',
    'if [ ! -f "$MAIN_FILE" ]; then',
    '  echo "Missing Electron main entry: $MAIN_FILE"',
    '  exit 1',
    'fi',
    '',
    'if [ ! -f "$PRELOAD_FILE" ]; then',
    '  echo "Missing Electron preload entry: $PRELOAD_FILE"',
    '  exit 1',
    'fi',
    '',
    'assert_contains "$MAIN_FILE" "contextIsolation: true" "renderer isolation must stay enabled"',
    'assert_contains "$MAIN_FILE" "nodeIntegration: false" "Node.js integration must stay disabled in the renderer"',
    'assert_contains "$MAIN_FILE" "sandbox: true" "Chromium sandbox must stay enabled"',
    'assert_contains "$MAIN_FILE" "webSecurity: true" "webSecurity must stay enabled"',
    'assert_contains "$MAIN_FILE" "setWindowOpenHandler" "new windows must be explicitly denied or redirected"',
    'assert_contains "$MAIN_FILE" "will-navigate" "unexpected navigations must be guarded"',
    'assert_contains "$MAIN_FILE" "shell.openExternal" "external links must leave the Electron renderer"',
    'assert_contains "$PRELOAD_FILE" "contextBridge.exposeInMainWorld" "preload must expose a bridged API"',
    'assert_contains "$PRELOAD_FILE" "Object.freeze(" "exposed preload API should be frozen"',
    'assert_not_contains "$PRELOAD_FILE" "ipcRenderer.sendSync" "sync IPC should not be exposed to the renderer"',
    '',
    'echo "Electron security baseline checks passed."',
    '',
  ].join('\n');
}

function getRuntimeHygieneScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'assert_contains() {',
    '  local path="$1"',
    '  local pattern="$2"',
    '  local description="$3"',
    '',
    '  if ! grep -Fq "$pattern" "$path"; then',
    '    echo "Runtime hygiene check failed: $description"',
    '    echo "Missing pattern: $pattern"',
    '    echo "File: $path"',
    '    exit 1',
    '  fi',
    '}',
    '',
    'MAIN_FILE="electron/main.ts"',
    '',
    'if [ ! -f "$MAIN_FILE" ]; then',
    '  echo "Missing Electron main entry: $MAIN_FILE"',
    '  exit 1',
    'fi',
    '',
    'assert_contains "$MAIN_FILE" "setAppLogsPath(" "app logs path must be explicitly managed"',
    'assert_contains "$MAIN_FILE" "setPath(\'crashDumps\'" "crash dump path must be explicitly managed"',
    'assert_contains "$MAIN_FILE" "runtimeRetentionPolicy" "runtime retention policy must be declared"',
    'assert_contains "$MAIN_FILE" "pruneRuntimeDirectory" "runtime retention cleanup helper must exist"',
    'assert_contains "$MAIN_FILE" "enforceRuntimeHygiene" "runtime hygiene boot hook must exist"',
    'assert_contains "$MAIN_FILE" "Runtime hygiene completed" "runtime hygiene should log cleanup results"',
    '',
    'echo "Runtime hygiene baseline checks passed."',
    '',
  ].join('\n');
}

function getOpsSnapshotScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_SNAPSHOT_DIR:-ops/snapshots}"',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops snapshot argument: $1"',
    '      echo "Use --label <name> and optional --output-dir <dir>."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'safe_label="$(printf "%s" "$LABEL" | tr "[:upper:]" "[:lower:]" | tr -cs "a-z0-9._-" "-")"',
    'timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"',
    'snapshot_dir="$OUTPUT_ROOT/${timestamp}-${safe_label}"',
    'mkdir -p "$snapshot_dir"',
    '',
    'json_path="$snapshot_dir/ops-snapshot.json"',
    'markdown_path="$snapshot_dir/ops-snapshot.md"',
    '',
    'node - "$ROOT_DIR" "$json_path" "$markdown_path" "$LABEL" "$timestamp" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, jsonPath, markdownPath, label, timestamp] = process.argv.slice(2);',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const docsDir = path.join(rootDir, \'docs\');',
    'const scriptsDir = path.join(rootDir, \'scripts\');',
    '',
    'const listIfExists = (dir, filter) => fs.existsSync(dir)',
    '  ? fs.readdirSync(dir).filter((entry) => !filter || filter(entry)).sort()',
    '  : [];',
    '',
    'const readLines = (file) => fs.existsSync(file)',
    '  ? fs.readFileSync(file, \'utf8\').split(/\\r?\\n/)',
    '  : [];',
    '',
    'const envExamplePath = path.join(rootDir, \'.env.example\');',
    'const envLines = readLines(envExamplePath);',
    'const releaseFiles = listIfExists(releaseDir);',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    'const ci = {',
    '  provider: process.env.GITHUB_ACTIONS === \'true\' ? \'github-actions\' : \'local\',',
    '  workflow: process.env.GITHUB_WORKFLOW ?? null,',
    '  runId: process.env.GITHUB_RUN_ID ?? null,',
    '  refName: process.env.GITHUB_REF_NAME ?? null,',
    '  sha: process.env.GITHUB_SHA ?? null,',
    '  runnerOs: process.env.RUNNER_OS ?? process.platform,',
    '};',
    '',
    'const snapshot = {',
    '  label,',
    '  capturedAt: timestamp,',
    '  package: {',
    '    name: pkg.name,',
    '    version: pkg.version,',
    '  },',
    '  commands: {',
    '    releaseCheck: pkg.scripts?.[\'release:check\'] ?? null,',
    '    securityCheck: pkg.scripts?.[\'security:check\'] ?? null,',
    '    opsCheck: pkg.scripts?.[\'ops:check\'] ?? null,',
    '    opsSnapshot: pkg.scripts?.[\'ops:snapshot\'] ?? null,',
    '    opsEvidence: pkg.scripts?.[\'ops:evidence\'] ?? null,',
    '    opsReport: pkg.scripts?.[\'ops:report\'] ?? null,',
    '    opsBundle: pkg.scripts?.[\'ops:bundle\'] ?? null,',
    '    opsIndex: pkg.scripts?.[\'ops:index\'] ?? null,',
    '    opsDoctor: pkg.scripts?.[\'ops:doctor\'] ?? null,',
    '    opsHandoff: pkg.scripts?.[\'ops:handoff\'] ?? null,',
    '    opsAttest: pkg.scripts?.[\'ops:attest\'] ?? null,',
    '    opsReady: pkg.scripts?.[\'ops:ready\'] ?? null,',
    '    opsGate: pkg.scripts?.[\'ops:gate\'] ?? null,',
    '    opsReleasePack: pkg.scripts?.[\'ops:releasepack\'] ?? null,',
    '    opsExport: pkg.scripts?.[\'ops:export\'] ?? null,',
    '    opsRestore: pkg.scripts?.[\'ops:restore\'] ?? null,',
    '    opsRecover: pkg.scripts?.[\'ops:recover\'] ?? null,',
    '    opsRetention: pkg.scripts?.[\'ops:retention\'] ?? null,',
    '    productionCheck: pkg.scripts?.[\'production:check\'] ?? null,',
    '  },',
    '  files: {',
    '    releasePlaybook: fs.existsSync(path.join(docsDir, \'release-playbook.md\')),',
    '    productionReadiness: fs.existsSync(path.join(docsDir, \'production-readiness.md\')),',
    '    preflightRelease: fs.existsSync(path.join(scriptsDir, \'preflight-release.sh\')),',
    '    securityBaseline: fs.existsSync(path.join(scriptsDir, \'security-baseline.sh\')),',
    '    runtimeHygiene: fs.existsSync(path.join(scriptsDir, \'runtime-hygiene.sh\')),',
    '    opsSnapshot: fs.existsSync(path.join(scriptsDir, \'ops-snapshot.sh\')),',
    '    opsEvidence: fs.existsSync(path.join(scriptsDir, \'ops-evidence.sh\')),',
    '    opsReport: fs.existsSync(path.join(scriptsDir, \'ops-report.sh\')),',
    '    opsBundle: fs.existsSync(path.join(scriptsDir, \'ops-bundle.sh\')),',
    '    opsIndex: fs.existsSync(path.join(scriptsDir, \'ops-index.sh\')),',
    '    opsDoctor: fs.existsSync(path.join(scriptsDir, \'ops-doctor.sh\')),',
    '    opsHandoff: fs.existsSync(path.join(scriptsDir, \'ops-handoff.sh\')),',
    '    opsAttest: fs.existsSync(path.join(scriptsDir, \'ops-attest.sh\')),',
    '    opsReady: fs.existsSync(path.join(scriptsDir, \'ops-ready.sh\')),',
    '    opsGate: fs.existsSync(path.join(scriptsDir, \'ops-gate.sh\')),',
    '    opsReleasePack: fs.existsSync(path.join(scriptsDir, \'ops-releasepack.sh\')),',
    '    opsExport: fs.existsSync(path.join(scriptsDir, \'ops-export.sh\')),',
    '    opsRestore: fs.existsSync(path.join(scriptsDir, \'ops-restore.sh\')),',
    '    opsRecover: fs.existsSync(path.join(scriptsDir, \'ops-recover.sh\')),',
    '    opsRetention: fs.existsSync(path.join(scriptsDir, \'ops-retention.sh\')),',
    '    productionReadinessScript: fs.existsSync(path.join(scriptsDir, \'production-readiness.sh\')),',
    '  },',
    '  release: {',
    '    exists: fs.existsSync(releaseDir),',
    '    manifests: manifestFiles,',
    '    installers: installerFiles,',
    '  },',
    '  envTemplate: {',
    '    githubOwner: envLines.some((line) => line.startsWith(\'GH_OWNER=\')),',
    '    githubRepo: envLines.some((line) => line.startsWith(\'GH_REPO=\')),',
    '    s3UpdateUrl: envLines.some((line) => line.startsWith(\'S3_UPDATE_URL=\')),',
    '  },',
    '  ci,',
    '};',
    '',
    'fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Snapshot\',',
    '  \'\',',
    '  `- Label: ${label}`,',
    '  `- Captured At (UTC): ${timestamp}`,',
    '  `- Package: ${snapshot.package.name}@${snapshot.package.version}`,',
    '  \'\',',
    '  \'## Commands\',',
    '  \'\',',
    '  `- release:check: ${snapshot.commands.releaseCheck ?? \'missing\'}`,',
    '  `- security:check: ${snapshot.commands.securityCheck ?? \'missing\'}`,',
    '  `- ops:check: ${snapshot.commands.opsCheck ?? \'missing\'}`,',
    '  `- ops:snapshot: ${snapshot.commands.opsSnapshot ?? \'missing\'}`,',
    '  `- ops:evidence: ${snapshot.commands.opsEvidence ?? \'missing\'}`,',
    '  `- ops:report: ${snapshot.commands.opsReport ?? \'missing\'}`,',
    '  `- ops:bundle: ${snapshot.commands.opsBundle ?? \'missing\'}`,',
    '  `- ops:index: ${snapshot.commands.opsIndex ?? \'missing\'}`,',
    '  `- ops:doctor: ${snapshot.commands.opsDoctor ?? \'missing\'}`,',
    '  `- ops:handoff: ${snapshot.commands.opsHandoff ?? \'missing\'}`,',
    '  `- ops:attest: ${snapshot.commands.opsAttest ?? \'missing\'}`,',
    '  `- ops:ready: ${snapshot.commands.opsReady ?? \'missing\'}`,',
    '  `- ops:gate: ${snapshot.commands.opsGate ?? \'missing\'}`,',
    '  `- ops:releasepack: ${snapshot.commands.opsReleasePack ?? \'missing\'}`,',
    '  `- ops:export: ${snapshot.commands.opsExport ?? \'missing\'}`,',
    '  `- ops:restore: ${snapshot.commands.opsRestore ?? \'missing\'}`,',
    '  `- ops:recover: ${snapshot.commands.opsRecover ?? \'missing\'}`,',
    '  `- ops:retention: ${snapshot.commands.opsRetention ?? \'missing\'}`,',
    '  `- production:check: ${snapshot.commands.productionCheck ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Surface Files\',',
    '  \'\',',
    '  `- docs/release-playbook.md: ${snapshot.files.releasePlaybook ? \'present\' : \'missing\'}`,',
    '  `- docs/production-readiness.md: ${snapshot.files.productionReadiness ? \'present\' : \'missing\'}`,',
    '  `- scripts/preflight-release.sh: ${snapshot.files.preflightRelease ? \'present\' : \'missing\'}`,',
    '  `- scripts/security-baseline.sh: ${snapshot.files.securityBaseline ? \'present\' : \'missing\'}`,',
    '  `- scripts/runtime-hygiene.sh: ${snapshot.files.runtimeHygiene ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-snapshot.sh: ${snapshot.files.opsSnapshot ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-evidence.sh: ${snapshot.files.opsEvidence ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-report.sh: ${snapshot.files.opsReport ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-bundle.sh: ${snapshot.files.opsBundle ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-index.sh: ${snapshot.files.opsIndex ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-doctor.sh: ${snapshot.files.opsDoctor ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-handoff.sh: ${snapshot.files.opsHandoff ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-attest.sh: ${snapshot.files.opsAttest ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-ready.sh: ${snapshot.files.opsReady ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-gate.sh: ${snapshot.files.opsGate ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-releasepack.sh: ${snapshot.files.opsReleasePack ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-export.sh: ${snapshot.files.opsExport ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-restore.sh: ${snapshot.files.opsRestore ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-recover.sh: ${snapshot.files.opsRecover ? \'present\' : \'missing\'}`,',
    '  `- scripts/ops-retention.sh: ${snapshot.files.opsRetention ? \'present\' : \'missing\'}`,',
    '  `- scripts/production-readiness.sh: ${snapshot.files.productionReadinessScript ? \'present\' : \'missing\'}`,',
    '  \'\',',
    '  \'## Release Directory\',',
    '  \'\',',
    '  `- Present: ${snapshot.release.exists ? \'yes\' : \'no\'}`,',
    '  `- Manifest count: ${snapshot.release.manifests.length}`,',
    '  `- Installer count: ${snapshot.release.installers.length}`,',
    '  snapshot.release.manifests.length > 0 ? `- Manifests: ${snapshot.release.manifests.join(\', \')}` : \'- Manifests: none\',',
    '  snapshot.release.installers.length > 0 ? `- Installers: ${snapshot.release.installers.join(\', \')}` : \'- Installers: none\',',
    '  \'\',',
    '  \'## Env Template\',',
    '  \'\',',
    '  `- GH_OWNER present: ${snapshot.envTemplate.githubOwner ? \'yes\' : \'no\'}`,',
    '  `- GH_REPO present: ${snapshot.envTemplate.githubRepo ? \'yes\' : \'no\'}`,',
    '  `- S3_UPDATE_URL present: ${snapshot.envTemplate.s3UpdateUrl ? \'yes\' : \'no\'}`,',
    '  \'\',',
    '  \'## CI Context\',',
    '  \'\',',
    '  `- Provider: ${snapshot.ci.provider}`,',
    '  `- Workflow: ${snapshot.ci.workflow ?? \'n/a\'}`,',
    '  `- Run ID: ${snapshot.ci.runId ?? \'n/a\'}`,',
    '  `- Ref Name: ${snapshot.ci.refName ?? \'n/a\'}`,',
    '  `- SHA: ${snapshot.ci.sha ?? \'n/a\'}`,',
    '  `- Runner OS: ${snapshot.ci.runnerOs}`,',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(markdownPath, lines.join(\'\\n\') + \'\\n\');',
    'NODE',
    '',
    'echo "Operations snapshot written to: $snapshot_dir"',
    '',
  ].join('\n');
}

function getOpsEvidenceScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_EVIDENCE_DIR:-ops/evidence}"',
    'SNAPSHOT_ROOT="${OPS_SNAPSHOT_DIR:-ops/snapshots}"',
    'SKIP_SNAPSHOT=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --snapshot-root)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --snapshot-root"',
    '        exit 1',
    '      fi',
    '      SNAPSHOT_ROOT="$1"',
    '      ;;',
    '    --skip-snapshot)',
    '      SKIP_SNAPSHOT=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops evidence argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, optional --snapshot-root <dir>, and optional --skip-snapshot."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'if [ "$SKIP_SNAPSHOT" -eq 0 ]; then',
    '  pnpm ops:snapshot -- --label "$LABEL" --output-dir "$SNAPSHOT_ROOT"',
    'fi',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$SNAPSHOT_ROOT" "$OUTPUT_ROOT" "$LABEL" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, snapshotRoot, outputRoot, label] = process.argv.slice(2);',
    '',
    'if (!fs.existsSync(snapshotRoot)) {',
    '  console.error(`Snapshot root does not exist: ${snapshotRoot}`);',
    '  process.exit(1);',
    '}',
    '',
    'const snapshotDirs = fs.readdirSync(snapshotRoot)',
    '  .map((entry) => path.join(snapshotRoot, entry))',
    '  .filter((entry) => fs.existsSync(path.join(entry, \'ops-snapshot.json\')))',
    '  .map((entry) => ({',
    '    dir: entry,',
    '    stat: fs.statSync(entry),',
    '  }))',
    '  .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '',
    'if (snapshotDirs.length === 0) {',
    '  console.error(`No ops snapshots found under ${snapshotRoot}`);',
    '  process.exit(1);',
    '}',
    '',
    'const latestSnapshotDir = snapshotDirs[0].dir;',
    'const snapshotJsonPath = path.join(latestSnapshotDir, \'ops-snapshot.json\');',
    'const snapshotMarkdownPath = path.join(latestSnapshotDir, \'ops-snapshot.md\');',
    'const snapshot = JSON.parse(fs.readFileSync(snapshotJsonPath, \'utf8\'));',
    '',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = snapshot.capturedAt ?? new Date().toISOString().replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const evidenceDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'const snapshotOutDir = path.join(evidenceDir, \'snapshot\');',
    'const docsOutDir = path.join(evidenceDir, \'docs\');',
    'const releaseOutDir = path.join(evidenceDir, \'release-manifests\');',
    'const envOutDir = path.join(evidenceDir, \'env\');',
    '',
    'fs.mkdirSync(snapshotOutDir, { recursive: true });',
    'fs.mkdirSync(docsOutDir, { recursive: true });',
    'fs.mkdirSync(releaseOutDir, { recursive: true });',
    'fs.mkdirSync(envOutDir, { recursive: true });',
    '',
    'fs.copyFileSync(snapshotJsonPath, path.join(snapshotOutDir, \'ops-snapshot.json\'));',
    'if (fs.existsSync(snapshotMarkdownPath)) {',
    '  fs.copyFileSync(snapshotMarkdownPath, path.join(snapshotOutDir, \'ops-snapshot.md\'));',
    '}',
    '',
    'const copiedDocs = [];',
    'for (const relativeDoc of [',
    '  path.join(\'docs\', \'release-playbook.md\'),',
    '  path.join(\'docs\', \'production-readiness.md\'),',
    ']) {',
    '  const source = path.join(rootDir, relativeDoc);',
    '  if (!fs.existsSync(source)) continue;',
    '  const destination = path.join(docsOutDir, path.basename(relativeDoc));',
    '  fs.copyFileSync(source, destination);',
    '  copiedDocs.push(relativeDoc);',
    '}',
    '',
    'const envExample = path.join(rootDir, \'.env.example\');',
    'if (fs.existsSync(envExample)) {',
    '  fs.copyFileSync(envExample, path.join(envOutDir, \'.env.example\'));',
    '}',
    '',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'for (const manifestFile of manifestFiles) {',
    '  fs.copyFileSync(path.join(releaseDir, manifestFile), path.join(releaseOutDir, manifestFile));',
    '}',
    '',
    'const installerInventory = releaseFiles',
    '  .filter((file) => !manifestFiles.includes(file))',
    '  .map((file) => ({',
    '    file,',
    '    sizeBytes: fs.statSync(path.join(releaseDir, file)).size,',
    '  }));',
    '',
    'const summary = {',
    '  label,',
    '  capturedAt: snapshot.capturedAt ?? null,',
    '  package: snapshot.package ?? null,',
    '  ci: snapshot.ci ?? null,',
    '  sourceSnapshotDir: path.relative(rootDir, latestSnapshotDir),',
    '  evidenceDir: path.relative(rootDir, evidenceDir),',
    '  included: {',
    '    snapshot: [\'snapshot/ops-snapshot.json\', ...(fs.existsSync(snapshotMarkdownPath) ? [\'snapshot/ops-snapshot.md\'] : [])],',
    '    docs: copiedDocs,',
    '    envExample: fs.existsSync(envExample),',
    '    manifests: manifestFiles,',
    '    installerInventory,',
    '  },',
    '};',
    '',
    'fs.writeFileSync(path.join(evidenceDir, \'ops-evidence-summary.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Evidence Bundle\',',
    '  \'\',',
    '  `- Label: ${summary.label}`,',
    '  `- Captured At (UTC): ${summary.capturedAt ?? \'n/a\'}`,',
    '  `- Evidence Dir: ${summary.evidenceDir}`,',
    '  `- Source Snapshot Dir: ${summary.sourceSnapshotDir}`,',
    '  `- Package: ${summary.package ? `${summary.package.name}@${summary.package.version}` : \'n/a\'}`,',
    '  \'\',',
    '  \'## Included Evidence\',',
    '  \'\',',
    '  `- Snapshot JSON: ${summary.included.snapshot.includes(\'snapshot/ops-snapshot.json\') ? \'yes\' : \'no\'}`,',
    '  `- Snapshot Markdown: ${summary.included.snapshot.includes(\'snapshot/ops-snapshot.md\') ? \'yes\' : \'no\'}`,',
    '  `- Docs Copied: ${summary.included.docs.length > 0 ? summary.included.docs.join(\', \') : \'none\'}`,',
    '  `- .env.example copied: ${summary.included.envExample ? \'yes\' : \'no\'}`,',
    '  `- Release manifests: ${summary.included.manifests.length > 0 ? summary.included.manifests.join(\', \') : \'none\'}`,',
    '  `- Installers inventoried: ${summary.included.installerInventory.length}` ,',
    '  \'\',',
    '  \'## CI Context\',',
    '  \'\',',
    '  `- Provider: ${summary.ci?.provider ?? \'n/a\'}`,',
    '  `- Workflow: ${summary.ci?.workflow ?? \'n/a\'}`,',
    '  `- Run ID: ${summary.ci?.runId ?? \'n/a\'}`,',
    '  `- Ref Name: ${summary.ci?.refName ?? \'n/a\'}`,',
    '  `- SHA: ${summary.ci?.sha ?? \'n/a\'}`,',
    '  `- Runner OS: ${summary.ci?.runnerOs ?? \'n/a\'}`,',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(evidenceDir, \'ops-evidence-summary.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations evidence bundle written to: ${evidenceDir}`);',
    'NODE',
    '',
  ].join('\n');
}

function getOpsIndexScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_INDEX_DIR:-ops/index}"',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops index argument: $1"',
    '      echo "Use --label <name> and optional --output-dir <dir>."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label] = process.argv.slice(2);',
    'const snapshotsRoot = path.join(rootDir, \'ops\', \'snapshots\');',
    'const evidenceRoot = path.join(rootDir, \'ops\', \'evidence\');',
    'const reportsRoot = path.join(rootDir, \'ops\', \'reports\');',
    'const bundlesRoot = path.join(rootDir, \'ops\', \'bundles\');',
    'const doctorsRoot = path.join(rootDir, \'ops\', \'doctors\');',
    'const handoffsRoot = path.join(rootDir, \'ops\', \'handoffs\');',
    'const attestationsRoot = path.join(rootDir, \'ops\', \'attestations\');',
    'const readyRoot = path.join(rootDir, \'ops\', \'ready\');',
    'const gatesRoot = path.join(rootDir, \'ops\', \'gates\');',
    'const releasePacksRoot = path.join(rootDir, \'ops\', \'releasepacks\');',
    'const exportsRoot = path.join(rootDir, \'ops\', \'exports\');',
    'const restoresRoot = path.join(rootDir, \'ops\', \'restores\');',
    'const recoveriesRoot = path.join(rootDir, \'ops\', \'recoveries\');',
    'const packageJsonPath = path.join(rootDir, \'package.json\');',
    '',
    'const listDirs = (root, expectedFile) => {',
    '  if (!fs.existsSync(root)) return [];',
    '  return fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, expectedFile)))',
    '    .map((entry) => ({',
    '      name: path.basename(entry),',
    '      relativeDir: path.relative(rootDir, entry),',
    '      stat: fs.statSync(entry),',
    '    }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)',
    '    .map(({ stat, ...entry }) => ({',
    '      ...entry,',
    '      modifiedAt: new Date(stat.mtimeMs).toISOString(),',
    '    }));',
    '};',
    '',
    'const snapshots = listDirs(snapshotsRoot, \'ops-snapshot.json\');',
    'const evidence = listDirs(evidenceRoot, \'ops-evidence-summary.json\');',
    'const reports = listDirs(reportsRoot, \'ops-report.json\');',
    'const bundles = listDirs(bundlesRoot, \'ops-bundle-summary.json\');',
    'const doctors = listDirs(doctorsRoot, \'ops-doctor.json\');',
    'const handoffs = listDirs(handoffsRoot, \'ops-handoff.json\');',
    'const attestations = listDirs(attestationsRoot, \'ops-attestation.json\');',
    'const readys = listDirs(readyRoot, \'ops-ready.json\');',
    'const gates = listDirs(gatesRoot, \'ops-gate.json\');',
    'const releasePacks = listDirs(releasePacksRoot, \'ops-releasepack.json\');',
    'const exports = listDirs(exportsRoot, \'ops-export.json\');',
    'const restores = listDirs(restoresRoot, \'ops-restore.json\');',
    'const recoveries = listDirs(recoveriesRoot, \'ops-recover.json\');',
    'const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, \'utf8\')) : null;',
    'const now = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = now.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const indexDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'fs.mkdirSync(indexDir, { recursive: true });',
    '',
    'const summary = {',
    '  capturedAt: now,',
    '  label,',
    '  package: pkg ? { name: pkg.name, version: pkg.version } : null,',
    '  indexDir: path.relative(rootDir, indexDir),',
    '  counts: { snapshots: snapshots.length, evidence: evidence.length, reports: reports.length, bundles: bundles.length, doctors: doctors.length, handoffs: handoffs.length, attestations: attestations.length, ready: readys.length, gates: gates.length, releasePacks: releasePacks.length, exports: exports.length, restores: restores.length, recoveries: recoveries.length },',
    '  latest: {',
    '    snapshot: snapshots[0] ?? null,',
    '    evidence: evidence[0] ?? null,',
    '    report: reports[0] ?? null,',
    '    bundle: bundles[0] ?? null,',
    '    doctor: doctors[0] ?? null,',
    '    handoff: handoffs[0] ?? null,',
    '    attestation: attestations[0] ?? null,',
    '    ready: readys[0] ?? null,',
    '    gate: gates[0] ?? null,',
    '    releasePack: releasePacks[0] ?? null,',
    '    export: exports[0] ?? null,',
    '    restore: restores[0] ?? null,',
    '    recovery: recoveries[0] ?? null,',
    '  },',
    '  snapshots,',
    '  evidence,',
    '  reports,',
    '  bundles,',
    '  doctors,',
    '  handoffs,',
    '  attestations,',
    '  readys,',
    '  gates,',
    '  releasePacks,',
    '  exports,',
    '  restores,',
    '  recoveries,',
    '};',
    '',
    'fs.writeFileSync(path.join(indexDir, \'ops-index.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Index\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Index Dir: ${summary.indexDir}`,',
    '  `- Package: ${summary.package ? `${summary.package.name}@${summary.package.version}` : \'n/a\'}`,',
    '  `- Snapshot directories: ${summary.counts.snapshots}`,',
    '  `- Evidence directories: ${summary.counts.evidence}`,',
    '  `- Report directories: ${summary.counts.reports}`,',
    '  `- Bundle directories: ${summary.counts.bundles}`,',
    '  `- Doctor directories: ${summary.counts.doctors}`,',
    '  `- Handoff directories: ${summary.counts.handoffs}`,',
    '  `- Attestation directories: ${summary.counts.attestations}`,',
    '  `- Ready directories: ${summary.counts.ready}`,',
    '  `- Gate directories: ${summary.counts.gates}`,',
    '  `- Release pack directories: ${summary.counts.releasePacks}`,',
    '  `- Export directories: ${summary.counts.exports}`,',
    '  `- Restore directories: ${summary.counts.restores}`,',
    '  `- Recovery directories: ${summary.counts.recoveries}`,',
    '  \'\',',
    '  \'## Latest Snapshot\',',
    '  \'\',',
    '  summary.latest.snapshot ? `- ${summary.latest.snapshot.relativeDir} (${summary.latest.snapshot.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Evidence\',',
    '  \'\',',
    '  summary.latest.evidence ? `- ${summary.latest.evidence.relativeDir} (${summary.latest.evidence.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Report\',',
    '  \'\',',
    '  summary.latest.report ? `- ${summary.latest.report.relativeDir} (${summary.latest.report.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Bundle\',',
    '  \'\',',
    '  summary.latest.bundle ? `- ${summary.latest.bundle.relativeDir} (${summary.latest.bundle.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Doctor\',',
    '  \'\',',
    '  summary.latest.doctor ? `- ${summary.latest.doctor.relativeDir} (${summary.latest.doctor.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Handoff\',',
    '  \'\',',
    '  summary.latest.handoff ? `- ${summary.latest.handoff.relativeDir} (${summary.latest.handoff.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Attestation\',',
    '  \'\',',
    '  summary.latest.attestation ? `- ${summary.latest.attestation.relativeDir} (${summary.latest.attestation.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Ready\',',
    '  \'\',',
    '  summary.latest.ready ? `- ${summary.latest.ready.relativeDir} (${summary.latest.ready.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Gate\',',
    '  \'\',',
    '  summary.latest.gate ? `- ${summary.latest.gate.relativeDir} (${summary.latest.gate.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Release Pack\',',
    '  \'\',',
    '  summary.latest.releasePack ? `- ${summary.latest.releasePack.relativeDir} (${summary.latest.releasePack.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Export\',',
    '  \'\',',
    '  summary.latest.export ? `- ${summary.latest.export.relativeDir} (${summary.latest.export.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Restore\',',
    '  \'\',',
    '  summary.latest.restore ? `- ${summary.latest.restore.relativeDir} (${summary.latest.restore.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Latest Recovery\',',
    '  \'\',',
    '  summary.latest.recovery ? `- ${summary.latest.recovery.relativeDir} (${summary.latest.recovery.modifiedAt})` : \'- none\',',
    '  \'\',',
    '  \'## Snapshot Inventory\',',
    '  \'\',',
    '  ...(summary.snapshots.length > 0 ? summary.snapshots.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Evidence Inventory\',',
    '  \'\',',
    '  ...(summary.evidence.length > 0 ? summary.evidence.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Report Inventory\',',
    '  \'\',',
    '  ...(summary.reports.length > 0 ? summary.reports.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Bundle Inventory\',',
    '  \'\',',
    '  ...(summary.bundles.length > 0 ? summary.bundles.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Doctor Inventory\',',
    '  \'\',',
    '  ...(summary.doctors.length > 0 ? summary.doctors.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Handoff Inventory\',',
    '  \'\',',
    '  ...(summary.handoffs.length > 0 ? summary.handoffs.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Attestation Inventory\',',
    '  \'\',',
    '  ...(summary.attestations.length > 0 ? summary.attestations.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Ready Inventory\',',
    '  \'\',',
    '  ...(summary.readys.length > 0 ? summary.readys.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Gate Inventory\',',
    '  \'\',',
    '  ...(summary.gates.length > 0 ? summary.gates.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Release Pack Inventory\',',
    '  \'\',',
    '  ...(summary.releasePacks.length > 0 ? summary.releasePacks.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Export Inventory\',',
    '  \'\',',
    '  ...(summary.exports.length > 0 ? summary.exports.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Restore Inventory\',',
    '  \'\',',
    '  ...(summary.restores.length > 0 ? summary.restores.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '  \'## Recovery Inventory\',',
    '  \'\',',
    '  ...(summary.recoveries.length > 0 ? summary.recoveries.map((entry) => `- ${entry.relativeDir} (${entry.modifiedAt})`) : [\'- none\']),',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(indexDir, \'ops-index.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations index written to: ${indexDir}`);',
    'NODE',
    '',
  ].join('\n');
}

function getOpsReportScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_REPORT_DIR:-ops/reports}"',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops report argument: $1"',
    '      echo "Use --label <name> and optional --output-dir <dir>."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label] = process.argv.slice(2);',
    'const packageJsonPath = path.join(rootDir, \'package.json\');',
    'const releaseDir = path.join(rootDir, \'release\');',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  const jsonPath = path.join(latestDir, fileName);',
    '  return {',
    '    dir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(jsonPath, \'utf8\')),',
    '  };',
    '};',
    '',
    'const snapshot = readLatest(path.join(rootDir, \'ops\', \'snapshots\'), \'ops-snapshot.json\');',
    'const evidence = readLatest(path.join(rootDir, \'ops\', \'evidence\'), \'ops-evidence-summary.json\');',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, \'utf8\')) : null;',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const reportDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'fs.mkdirSync(reportDir, { recursive: true });',
    '',
    'const report = {',
    '  capturedAt,',
    '  label,',
    '  package: pkg ? { name: pkg.name, version: pkg.version } : null,',
    '  reportDir: path.relative(rootDir, reportDir),',
    '  latest: {',
    '    snapshot: snapshot ? { dir: snapshot.dir, modifiedAt: snapshot.modifiedAt, capturedAt: snapshot.payload.capturedAt ?? null } : null,',
    '    evidence: evidence ? { dir: evidence.dir, modifiedAt: evidence.modifiedAt, capturedAt: evidence.payload.capturedAt ?? null } : null,',
    '    index: index ? { dir: index.dir, modifiedAt: index.modifiedAt, capturedAt: index.payload.capturedAt ?? null } : null,',
    '  },',
    '  release: {',
    '    manifestCount: manifestFiles.length,',
    '    installerCount: installerFiles.length,',
    '    manifests: manifestFiles,',
    '    installers: installerFiles,',
    '  },',
    '  snapshotCounts: index?.payload?.counts ?? {',
    '    snapshots: snapshot ? 1 : 0,',
    '    evidence: evidence ? 1 : 0,',
    '  },',
    '  ci: snapshot?.payload?.ci ?? evidence?.payload?.ci ?? null,',
    '};',
    '',
    'fs.writeFileSync(path.join(reportDir, \'ops-report.json\'), JSON.stringify(report, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Report\',',
    '  \'\',',
    '  `- Captured At (UTC): ${report.capturedAt}`,',
    '  `- Label: ${report.label}`,',
    '  `- Report Dir: ${report.reportDir}`,',
    '  `- Package: ${report.package ? `${report.package.name}@${report.package.version}` : \'n/a\'}`,',
    '  \'\',',
    '  \'## Latest Operations Surfaces\',',
    '  \'\',',
    '  report.latest.snapshot ? `- Snapshot: ${report.latest.snapshot.dir} (${report.latest.snapshot.modifiedAt})` : \'- Snapshot: none\',',
    '  report.latest.evidence ? `- Evidence: ${report.latest.evidence.dir} (${report.latest.evidence.modifiedAt})` : \'- Evidence: none\',',
    '  report.latest.index ? `- Index: ${report.latest.index.dir} (${report.latest.index.modifiedAt})` : \'- Index: none\',',
    '  \'\',',
    '  \'## Release Output\',',
    '  \'\',',
    '  `- Manifest count: ${report.release.manifestCount}`,',
    '  `- Installer count: ${report.release.installerCount}`,',
    '  report.release.manifests.length > 0 ? `- Manifests: ${report.release.manifests.join(\', \')}` : \'- Manifests: none\',',
    '  report.release.installers.length > 0 ? `- Installers: ${report.release.installers.join(\', \')}` : \'- Installers: none\',',
    '  \'\',',
    '  \'## Inventory Counts\',',
    '  \'\',',
    '  `- Snapshot directories retained: ${report.snapshotCounts.snapshots ?? 0}`,',
    '  `- Evidence directories retained: ${report.snapshotCounts.evidence ?? 0}`,',
    '  \'\',',
    '  \'## CI Context\',',
    '  \'\',',
    '  `- Provider: ${report.ci?.provider ?? \'n/a\'}`,',
    '  `- Workflow: ${report.ci?.workflow ?? \'n/a\'}`,',
    '  `- Run ID: ${report.ci?.runId ?? \'n/a\'}`,',
    '  `- Ref Name: ${report.ci?.refName ?? \'n/a\'}`,',
    '  `- SHA: ${report.ci?.sha ?? \'n/a\'}`,',
    '  `- Runner OS: ${report.ci?.runnerOs ?? \'n/a\'}`,',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(reportDir, \'ops-report.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations report written to: ${reportDir}`);',
    'NODE',
    '',
  ].join('\n');
}

function getOpsBundleScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_BUNDLE_DIR:-ops/bundles}"',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops bundle argument: $1"',
    '      echo "Use --label <name> and optional --output-dir <dir>."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label] = process.argv.slice(2);',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    jsonPath: path.join(latestDir, fileName),',
    '  };',
    '};',
    '',
    'const copyIfExists = (source, destination) => {',
    '  if (!fs.existsSync(source)) return false;',
    '  fs.mkdirSync(path.dirname(destination), { recursive: true });',
    '  fs.copyFileSync(source, destination);',
    '  return true;',
    '};',
    '',
    'const packageJsonPath = path.join(rootDir, \'package.json\');',
    'const pkg = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, \'utf8\')) : null;',
    'const snapshot = readLatest(path.join(rootDir, \'ops\', \'snapshots\'), \'ops-snapshot.json\');',
    'const evidence = readLatest(path.join(rootDir, \'ops\', \'evidence\'), \'ops-evidence-summary.json\');',
    'const report = readLatest(path.join(rootDir, \'ops\', \'reports\'), \'ops-report.json\');',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    '',
    'for (const [labelName, value] of [',
    '  [\'snapshot\', snapshot],',
    '  [\'evidence\', evidence],',
    '  [\'report\', report],',
    ']) {',
    '  if (!value) {',
    '    console.error(`Latest ops ${labelName} surface is missing.`);',
    '    process.exit(1);',
    '  }',
    '}',
    '',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    '',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const bundleDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'const payloadDir = path.join(bundleDir, \'payload\');',
    'const docsDir = path.join(payloadDir, \'docs\');',
    'const envDir = path.join(payloadDir, \'env\');',
    'const releaseOutDir = path.join(payloadDir, \'release\');',
    'fs.mkdirSync(payloadDir, { recursive: true });',
    'fs.mkdirSync(docsDir, { recursive: true });',
    'fs.mkdirSync(envDir, { recursive: true });',
    'fs.mkdirSync(releaseOutDir, { recursive: true });',
    '',
    'const copied = {',
    '  snapshot: [],',
    '  evidence: [],',
    '  report: [],',
    '  index: [],',
    '  docs: [],',
    '  env: [],',
    '  manifests: [],',
    '};',
    '',
    'const copySurface = (surface, key, names) => {',
    '  for (const name of names) {',
    '    const source = path.join(surface.absoluteDir, name);',
    '    const destination = path.join(payloadDir, key, name);',
    '    if (copyIfExists(source, destination)) {',
    '      copied[key].push(path.join(key, name));',
    '    }',
    '  }',
    '};',
    '',
    'copySurface(snapshot, \'snapshot\', [\'ops-snapshot.json\', \'ops-snapshot.md\']);',
    'copySurface(evidence, \'evidence\', [\'ops-evidence-summary.json\', \'ops-evidence-summary.md\']);',
    'copySurface(report, \'report\', [\'ops-report.json\', \'ops-report.md\']);',
    'if (index) {',
    '  copySurface(index, \'index\', [\'ops-index.json\', \'ops-index.md\']);',
    '}',
    '',
    'for (const relativeDoc of [',
    '  path.join(\'docs\', \'release-playbook.md\'),',
    '  path.join(\'docs\', \'production-readiness.md\'),',
    ']) {',
    '  const source = path.join(rootDir, relativeDoc);',
    '  const destination = path.join(docsDir, path.basename(relativeDoc));',
    '  if (copyIfExists(source, destination)) {',
    '    copied.docs.push(relativeDoc);',
    '  }',
    '}',
    '',
    'const envExample = path.join(rootDir, \'.env.example\');',
    'if (copyIfExists(envExample, path.join(envDir, \'.env.example\'))) {',
    '  copied.env.push(\'.env.example\');',
    '}',
    '',
    'for (const manifestFile of manifestFiles) {',
    '  const source = path.join(releaseDir, manifestFile);',
    '  const destination = path.join(releaseOutDir, manifestFile);',
    '  if (copyIfExists(source, destination)) {',
    '    copied.manifests.push(path.join(\'release\', manifestFile));',
    '  }',
    '}',
    '',
    'const installerInventory = installerFiles.map((file) => ({',
    '  file,',
    '  sizeBytes: fs.statSync(path.join(releaseDir, file)).size,',
    '}));',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  package: pkg ? { name: pkg.name, version: pkg.version } : null,',
    '  bundleDir: path.relative(rootDir, bundleDir),',
    '  archivePath: path.join(path.relative(rootDir, bundleDir), \'ops-bundle.tgz\'),',
    '  latest: {',
    '    snapshot: { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt },',
    '    evidence: { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt },',
    '    report: { dir: report.relativeDir, modifiedAt: report.modifiedAt },',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '  },',
    '  copied,',
    '  release: {',
    '    manifestCount: manifestFiles.length,',
    '    installerCount: installerInventory.length,',
    '    installerInventory,',
    '  },',
    '};',
    '',
    'fs.writeFileSync(path.join(bundleDir, \'ops-bundle-summary.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Bundle\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Bundle Dir: ${summary.bundleDir}`,',
    '  `- Archive Path: ${summary.archivePath}`,',
    '  `- Package: ${summary.package ? `${summary.package.name}@${summary.package.version}` : \'n/a\'}`,',
    '  \'\',',
    '  \'## Included Surfaces\',',
    '  \'\',',
    '  `- Snapshot dir: ${summary.latest.snapshot.dir}`,',
    '  `- Evidence dir: ${summary.latest.evidence.dir}`,',
    '  `- Report dir: ${summary.latest.report.dir}`,',
    '  `- Index dir: ${summary.latest.index ? summary.latest.index.dir : \'none\'}`,',
    '  `- Docs copied: ${summary.copied.docs.length > 0 ? summary.copied.docs.join(\', \') : \'none\'}`,',
    '  `- Env files copied: ${summary.copied.env.length > 0 ? summary.copied.env.join(\', \') : \'none\'}`,',
    '  `- Release manifests copied: ${summary.copied.manifests.length > 0 ? summary.copied.manifests.join(\', \') : \'none\'}`,',
    '  `- Installers inventoried: ${summary.release.installerCount}`,',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(bundleDir, \'ops-bundle-summary.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations bundle prepared at: ${bundleDir}`);',
    'NODE',
    '',
    'bundle_dir="$(find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"',
    'if [ -z "$bundle_dir" ]; then',
    '  echo "Failed to locate generated ops bundle directory in $OUTPUT_ROOT"',
    '  exit 1',
    'fi',
    'tar -czf "$bundle_dir/ops-bundle.tgz" -C "$bundle_dir" payload',
    'echo "Operations bundle archive written to: $bundle_dir/ops-bundle.tgz"',
    '',
  ].join('\n');
}

function getOpsDoctorScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_DOCTOR_DIR:-ops/doctors}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops doctor argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const snapshot = readLatest(path.join(rootDir, \'ops\', \'snapshots\'), \'ops-snapshot.json\');',
    'const evidence = readLatest(path.join(rootDir, \'ops\', \'evidence\'), \'ops-evidence-summary.json\');',
    'const report = readLatest(path.join(rootDir, \'ops\', \'reports\'), \'ops-report.json\');',
    'const bundle = readLatest(path.join(rootDir, \'ops\', \'bundles\'), \'ops-bundle-summary.json\');',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => {',
    '  checks.push({ id, ok, detail });',
    '};',
    '',
    'addCheck(\'snapshot-present\', Boolean(snapshot), snapshot ? snapshot.relativeDir : \'Latest ops snapshot is missing\');',
    'addCheck(\'evidence-present\', Boolean(evidence), evidence ? evidence.relativeDir : \'Latest ops evidence bundle is missing\');',
    'addCheck(\'report-present\', Boolean(report), report ? report.relativeDir : \'Latest ops report is missing\');',
    'addCheck(\'bundle-present\', Boolean(bundle), bundle ? bundle.relativeDir : \'Latest ops bundle is missing\');',
    'addCheck(\'index-present\', Boolean(index), index ? index.relativeDir : \'Latest ops index is missing\');',
    '',
    'const packageVersion = `${pkg.name}@${pkg.version}`;',
    'for (const [id, surface] of [[',
    '  \'snapshot-package-match\', snapshot],',
    '  [\'evidence-package-match\', evidence],',
    '  [\'report-package-match\', report],',
    '  [\'bundle-package-match\', bundle],',
    '  [\'index-package-match\', index],',
    ']) {',
    '  if (!surface) continue;',
    '  const surfacePkg = surface.payload?.package;',
    '  const surfaceVersion = surfacePkg ? `${surfacePkg.name}@${surfacePkg.version}` : null;',
    '  addCheck(id, surfaceVersion === packageVersion, surfaceVersion ? `${surface.relativeDir} -> ${surfaceVersion}` : `${surface.relativeDir} -> missing package metadata`);',
    '}',
    '',
    'if (index?.payload?.latest) {',
    '  addCheck(',
    '    \'index-latest-bundle-aligned\',',
    '    index.payload.latest.bundle?.relativeDir === bundle?.relativeDir,',
    '    index.payload.latest.bundle?.relativeDir ? `index bundle=${index.payload.latest.bundle.relativeDir}` : \'index missing latest bundle reference\',',
    '  );',
    '  addCheck(',
    '    \'index-latest-report-aligned\',',
    '    index.payload.latest.report?.relativeDir === report?.relativeDir,',
    '    index.payload.latest.report?.relativeDir ? `index report=${index.payload.latest.report.relativeDir}` : \'index missing latest report reference\',',
    '  );',
    '}',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'release-dir-present\', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : \'release directory missing\');',
    '  addCheck(\'release-manifest-present\', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(\', \') : \'No updater manifests found\');',
    '  addCheck(\'release-installer-present\', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(\', \') : \'No installer artifacts found\');',
    '} else {',
    '  addCheck(\'release-output-optional\', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const doctorDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'fs.mkdirSync(doctorDir, { recursive: true });',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  doctorDir: path.relative(rootDir, doctorDir),',
    '  requireReleaseOutput,',
    '  latest: {',
    '    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,',
    '    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,',
    '    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,',
    '    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '  },',
    '  release: {',
    '    manifestCount: manifestFiles.length,',
    '    installerCount: installerFiles.length,',
    '    manifests: manifestFiles,',
    '    installers: installerFiles,',
    '  },',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(doctorDir, \'ops-doctor.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Doctor\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Snapshot: ${summary.latest.snapshot?.dir ?? \'missing\'}`,',
    '  `- Evidence: ${summary.latest.evidence?.dir ?? \'missing\'}`,',
    '  `- Report: ${summary.latest.report?.dir ?? \'missing\'}`,',
    '  `- Bundle: ${summary.latest.bundle?.dir ?? \'missing\'}`,',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Release Output\',',
    '  \'\',',
    '  `- Manifest count: ${summary.release.manifestCount}`,',
    '  `- Installer count: ${summary.release.installerCount}`,',
    '  summary.release.manifests.length > 0 ? `- Manifests: ${summary.release.manifests.join(\', \')}` : \'- Manifests: none\',',
    '  summary.release.installers.length > 0 ? `- Installers: ${summary.release.installers.join(\', \')}` : \'- Installers: none\',',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(doctorDir, \'ops-doctor.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations doctor written to: ${doctorDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
  ].join('\n');
}

function getOpsHandoffScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_HANDOFF_DIR:-ops/handoffs}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops handoff argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const copyIfExists = (source, destination) => {',
    '  if (!fs.existsSync(source)) return false;',
    '  fs.mkdirSync(path.dirname(destination), { recursive: true });',
    '  fs.copyFileSync(source, destination);',
    '  return true;',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const snapshot = readLatest(path.join(rootDir, \'ops\', \'snapshots\'), \'ops-snapshot.json\');',
    'const evidence = readLatest(path.join(rootDir, \'ops\', \'evidence\'), \'ops-evidence-summary.json\');',
    'const report = readLatest(path.join(rootDir, \'ops\', \'reports\'), \'ops-report.json\');',
    'const bundle = readLatest(path.join(rootDir, \'ops\', \'bundles\'), \'ops-bundle-summary.json\');',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const doctor = readLatest(path.join(rootDir, \'ops\', \'doctors\'), \'ops-doctor.json\');',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => {',
    '  checks.push({ id, ok, detail });',
    '};',
    '',
    'for (const [id, surface] of [',
    '  [\'snapshot-present\', snapshot],',
    '  [\'evidence-present\', evidence],',
    '  [\'report-present\', report],',
    '  [\'bundle-present\', bundle],',
    '  [\'index-present\', index],',
    '  [\'doctor-present\', doctor],',
    ']) {',
    '  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);',
    '}',
    '',
    'const packageVersion = `${pkg.name}@${pkg.version}`;',
    'for (const [id, surface] of [',
    '  [\'snapshot-package-match\', snapshot],',
    '  [\'evidence-package-match\', evidence],',
    '  [\'report-package-match\', report],',
    '  [\'bundle-package-match\', bundle],',
    '  [\'index-package-match\', index],',
    '  [\'doctor-package-match\', doctor],',
    ']) {',
    '  if (!surface) continue;',
    '  const surfacePkg = surface.payload?.package;',
    '  const surfaceVersion = surfacePkg ? `${surfacePkg.name}@${surfacePkg.version}` : null;',
    '  addCheck(id, surfaceVersion === packageVersion, surfaceVersion ? `${surface.relativeDir} -> ${surfaceVersion}` : `${surface.relativeDir} -> missing package metadata`);',
    '}',
    '',
    'addCheck(\'doctor-verdict-pass\', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? \'pass\' : \'fail\'}` : \'doctor missing\');',
    'addCheck(\'bundle-archive-present\', bundle ? fs.existsSync(path.join(bundle.absoluteDir, \'ops-bundle.tgz\')) : false, bundle ? path.join(bundle.relativeDir, \'ops-bundle.tgz\') : \'bundle missing\');',
    '',
    'if (index?.payload?.latest) {',
    '  addCheck(\'index-latest-doctor-aligned\', index.payload.latest.doctor?.relativeDir === doctor?.relativeDir, index.payload.latest.doctor?.relativeDir ? `index doctor=${index.payload.latest.doctor.relativeDir}` : \'index missing latest doctor reference\');',
    '  addCheck(\'index-latest-bundle-aligned\', index.payload.latest.bundle?.relativeDir === bundle?.relativeDir, index.payload.latest.bundle?.relativeDir ? `index bundle=${index.payload.latest.bundle.relativeDir}` : \'index missing latest bundle reference\');',
    '}',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'release-dir-present\', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : \'release directory missing\');',
    '  addCheck(\'release-manifest-present\', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(\', \') : \'No updater manifests found\');',
    '  addCheck(\'release-installer-present\', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(\', \') : \'No installer artifacts found\');',
    '} else {',
    '  addCheck(\'release-output-optional\', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const handoffDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'const payloadDir = path.join(handoffDir, \'payload\');',
    'fs.mkdirSync(payloadDir, { recursive: true });',
    '',
    'const copySurface = (surface, key, names) => {',
    '  if (!surface) return [];',
    '  const copied = [];',
    '  for (const name of names) {',
    '    const source = path.join(surface.absoluteDir, name);',
    '    const destination = path.join(payloadDir, key, name);',
    '    if (copyIfExists(source, destination)) {',
    '      copied.push(path.join(\'payload\', key, name));',
    '    }',
    '  }',
    '  return copied;',
    '};',
    '',
    'const copied = {',
    '  snapshot: copySurface(snapshot, \'snapshot\', [\'ops-snapshot.json\', \'ops-snapshot.md\']),',
    '  evidence: copySurface(evidence, \'evidence\', [\'ops-evidence-summary.json\', \'ops-evidence-summary.md\']),',
    '  report: copySurface(report, \'report\', [\'ops-report.json\', \'ops-report.md\']),',
    '  bundle: copySurface(bundle, \'bundle\', [\'ops-bundle-summary.json\', \'ops-bundle-summary.md\', \'ops-bundle.tgz\']),',
    '  index: copySurface(index, \'index\', [\'ops-index.json\', \'ops-index.md\']),',
    '  doctor: copySurface(doctor, \'doctor\', [\'ops-doctor.json\', \'ops-doctor.md\']),',
    '  docs: [],',
    '  env: [],',
    '  manifests: [],',
    '};',
    '',
    'for (const relativeDoc of [',
    '  path.join(\'docs\', \'release-playbook.md\'),',
    '  path.join(\'docs\', \'production-readiness.md\'),',
    ']) {',
    '  const source = path.join(rootDir, relativeDoc);',
    '  const destination = path.join(payloadDir, \'docs\', path.basename(relativeDoc));',
    '  if (copyIfExists(source, destination)) copied.docs.push(relativeDoc);',
    '}',
    '',
    'const envExample = path.join(rootDir, \'.env.example\');',
    'if (copyIfExists(envExample, path.join(payloadDir, \'env\', \'.env.example\'))) {',
    '  copied.env.push(\'.env.example\');',
    '}',
    '',
    'for (const manifestFile of manifestFiles) {',
    '  const source = path.join(releaseDir, manifestFile);',
    '  const destination = path.join(payloadDir, \'release\', manifestFile);',
    '  if (copyIfExists(source, destination)) copied.manifests.push(path.join(\'payload\', \'release\', manifestFile));',
    '}',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  handoffDir: path.relative(rootDir, handoffDir),',
    '  archivePath: path.join(path.relative(rootDir, handoffDir), \'ops-handoff.tgz\'),',
    '  requireReleaseOutput,',
    '  latest: {',
    '    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,',
    '    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,',
    '    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,',
    '    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,',
    '  },',
    '  copied,',
    '  release: { manifests: manifestFiles, installers: installerFiles },',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(handoffDir, \'ops-handoff.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Handoff\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Handoff Dir: ${summary.handoffDir}`,',
    '  `- Archive Path: ${summary.archivePath}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Snapshot: ${summary.latest.snapshot?.dir ?? \'missing\'}`,',
    '  `- Evidence: ${summary.latest.evidence?.dir ?? \'missing\'}`,',
    '  `- Report: ${summary.latest.report?.dir ?? \'missing\'}`,',
    '  `- Bundle: ${summary.latest.bundle?.dir ?? \'missing\'}`,',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  `- Doctor: ${summary.latest.doctor?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Copied Payload\',',
    '  \'\',',
    '  `- Snapshot files: ${summary.copied.snapshot.length}`,',
    '  `- Evidence files: ${summary.copied.evidence.length}`,',
    '  `- Report files: ${summary.copied.report.length}`,',
    '  `- Bundle files: ${summary.copied.bundle.length}`,',
    '  `- Index files: ${summary.copied.index.length}`,',
    '  `- Doctor files: ${summary.copied.doctor.length}`,',
    '  `- Docs copied: ${summary.copied.docs.length > 0 ? summary.copied.docs.join(\', \') : \'none\'}`,',
    '  `- Env copied: ${summary.copied.env.length > 0 ? summary.copied.env.join(\', \') : \'none\'}`,',
    '  `- Release manifests copied: ${summary.copied.manifests.length > 0 ? summary.copied.manifests.join(\', \') : \'none\'}`,',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## Operator Next Steps\',',
    '  \'\',',
    '  \'- Attach `ops-handoff.tgz` to the operator handoff or release ticket.\',',
    '  \'- Use the embedded doctor, bundle, and report files as the primary evidence set.\',',
    '  \'- If release output is required, confirm the copied updater manifests and installer names match the target release channel.\',',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(handoffDir, \'ops-handoff.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations handoff written to: ${handoffDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
    'handoff_dir="$(find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"',
    'if [ -z "$handoff_dir" ]; then',
    '  echo "Failed to locate generated ops handoff directory in $OUTPUT_ROOT"',
    '  exit 1',
    'fi',
    'tar -czf "$handoff_dir/ops-handoff.tgz" -C "$handoff_dir" payload',
    'echo "Operations handoff archive written to: $handoff_dir/ops-handoff.tgz"',
    '',
  ].join('\n');
}

function getOpsAttestationScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_ATTESTATION_DIR:-ops/attestations}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops attest argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" <<\'NODE\'',
    'const crypto = require(\'node:crypto\');',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const hashFile = (filePath) => crypto.createHash(\'sha256\').update(fs.readFileSync(filePath)).digest(\'hex\');',
    '',
    'const collectArtifacts = (surface, key, names) => {',
    '  if (!surface) return [];',
    '  return names',
    '    .map((name) => {',
    '      const filePath = path.join(surface.absoluteDir, name);',
    '      if (!fs.existsSync(filePath)) return null;',
    '      const stat = fs.statSync(filePath);',
    '      return {',
    '        surface: key,',
    '        file: name,',
    '        relativePath: path.join(surface.relativeDir, name),',
    '        sizeBytes: stat.size,',
    '        sha256: hashFile(filePath),',
    '      };',
    '    })',
    '    .filter(Boolean);',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const doctor = readLatest(path.join(rootDir, \'ops\', \'doctors\'), \'ops-doctor.json\');',
    'const bundle = readLatest(path.join(rootDir, \'ops\', \'bundles\'), \'ops-bundle-summary.json\');',
    'const handoff = readLatest(path.join(rootDir, \'ops\', \'handoffs\'), \'ops-handoff.json\');',
    'const ready = readLatest(path.join(rootDir, \'ops\', \'ready\'), \'ops-ready.json\');',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });',
    '',
    'for (const [id, surface] of [[',
    '  \'index-present\', index],',
    '  [\'doctor-present\', doctor],',
    '  [\'bundle-present\', bundle],',
    '  [\'handoff-present\', handoff],',
    '  [\'ready-present\', ready],',
    ']) {',
    '  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);',
    '}',
    '',
    'const packageVersion = `${pkg.name}@${pkg.version}`;',
    'for (const [id, surface] of [[',
    '  \'index-package-match\', index],',
    '  [\'doctor-package-match\', doctor],',
    '  [\'bundle-package-match\', bundle],',
    '  [\'handoff-package-match\', handoff],',
    '  [\'ready-package-match\', ready],',
    ']) {',
    '  if (!surface) continue;',
    '  const surfacePkg = surface.payload?.package;',
    '  const surfaceVersion = surfacePkg ? `${surfacePkg.name}@${surfacePkg.version}` : null;',
    '  addCheck(id, surfaceVersion === packageVersion, surfaceVersion ? `${surface.relativeDir} -> ${surfaceVersion}` : `${surface.relativeDir} -> missing package metadata`);',
    '}',
    '',
    'addCheck(\'doctor-verdict-pass\', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? \'pass\' : \'fail\'}` : \'doctor missing\');',
    'addCheck(\'handoff-verdict-pass\', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? \'pass\' : \'fail\'}` : \'handoff missing\');',
    'addCheck(\'ready-verdict-pass\', ready?.payload?.ok === true, ready ? `ready verdict=${ready.payload?.ok ? \'pass\' : \'fail\'}` : \'ready missing\');',
    'addCheck(\'bundle-archive-present\', bundle ? fs.existsSync(path.join(bundle.absoluteDir, \'ops-bundle.tgz\')) : false, bundle ? path.join(bundle.relativeDir, \'ops-bundle.tgz\') : \'bundle missing\');',
    'addCheck(\'handoff-archive-present\', handoff ? fs.existsSync(path.join(handoff.absoluteDir, \'ops-handoff.tgz\')) : false, handoff ? path.join(handoff.relativeDir, \'ops-handoff.tgz\') : \'handoff missing\');',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'release-dir-present\', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : \'release directory missing\');',
    '  addCheck(\'release-manifest-present\', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(\', \') : \'No updater manifests found\');',
    '  addCheck(\'release-installer-present\', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(\', \') : \'No installer artifacts found\');',
    '} else {',
    '  addCheck(\'release-output-optional\', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'const artifacts = [',
    '  ...collectArtifacts(index, \'index\', [\'ops-index.json\', \'ops-index.md\']),',
    '  ...collectArtifacts(doctor, \'doctor\', [\'ops-doctor.json\', \'ops-doctor.md\']),',
    '  ...collectArtifacts(bundle, \'bundle\', [\'ops-bundle-summary.json\', \'ops-bundle-summary.md\', \'ops-bundle.tgz\']),',
    '  ...collectArtifacts(handoff, \'handoff\', [\'ops-handoff.json\', \'ops-handoff.md\', \'ops-handoff.tgz\']),',
    '  ...collectArtifacts(ready, \'ready\', [\'ops-ready.json\', \'ops-ready.md\']),',
    '  ...manifestFiles.map((file) => ({',
    '    surface: \'release-manifest\',',
    '    file,',
    '    relativePath: path.join(\'release\', file),',
    '    sizeBytes: fs.statSync(path.join(releaseDir, file)).size,',
    '    sha256: hashFile(path.join(releaseDir, file)),',
    '  })),',
    '  ...installerFiles.map((file) => ({',
    '    surface: \'release-installer\',',
    '    file,',
    '    relativePath: path.join(\'release\', file),',
    '    sizeBytes: fs.statSync(path.join(releaseDir, file)).size,',
    '    sha256: hashFile(path.join(releaseDir, file)),',
    '  })),',
    '];',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const attestationDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'fs.mkdirSync(attestationDir, { recursive: true });',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  attestationDir: path.relative(rootDir, attestationDir),',
    '  requireReleaseOutput,',
    '  latest: {',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,',
    '    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,',
    '    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,',
    '    ready: ready ? { dir: ready.relativeDir, modifiedAt: ready.modifiedAt, ok: ready.payload?.ok === true } : null,',
    '  },',
    '  artifactCount: artifacts.length,',
    '  artifacts,',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(attestationDir, \'ops-attestation.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Attestation\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Attestation Dir: ${summary.attestationDir}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  `- Artifact count: ${summary.artifactCount}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  `- Doctor: ${summary.latest.doctor?.dir ?? \'missing\'}`,',
    '  `- Bundle: ${summary.latest.bundle?.dir ?? \'missing\'}`,',
    '  `- Handoff: ${summary.latest.handoff?.dir ?? \'missing\'}`,',
    '  `- Ready: ${summary.latest.ready?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## SHA-256 Inventory\',',
    '  \'\',',
    '  ...(summary.artifacts.length > 0',
    '    ? summary.artifacts.map((artifact) => `- ${artifact.surface}: ${artifact.relativePath} (${artifact.sizeBytes} bytes, sha256=${artifact.sha256})`)',
    '    : [\'- none\']),',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(attestationDir, \'ops-attestation.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations attestation written to: ${attestationDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
  ].join('\n');
}

function getOpsReadyScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_READY_DIR:-ops/ready}"',
    'KEEP="${OPS_READY_KEEP:-10}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    'SKIP_RETENTION=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --keep)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --keep"',
    '        exit 1',
    '      fi',
    '      KEEP="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --skip-retention)',
    '      SKIP_RETENTION=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops ready argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'case "$KEEP" in',
    '  ""|*[!0-9]*)',
    '    echo "Ready keep value must be a non-negative integer. Got: $KEEP"',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'if [ "$SKIP_RETENTION" -eq 0 ]; then',
    '  pnpm ops:retention -- --keep "$KEEP"',
    'fi',
    '',
    'pnpm ops:snapshot -- --label "$LABEL"',
    'pnpm ops:evidence -- --label "$LABEL" --skip-snapshot',
    'pnpm ops:report -- --label "$LABEL"',
    'pnpm ops:bundle -- --label "$LABEL"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
    'doctor_args=(-- --label "$LABEL")',
    'handoff_args=(-- --label "$LABEL")',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  doctor_args+=(--require-release-output)',
    '  handoff_args+=(--require-release-output)',
    'fi',
    '',
    'pnpm ops:doctor "${doctor_args[@]}"',
    'pnpm ops:index -- --label "$LABEL"',
    'pnpm ops:handoff "${handoff_args[@]}"',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    'const skipRetention = skipRetentionFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const snapshot = readLatest(path.join(rootDir, \'ops\', \'snapshots\'), \'ops-snapshot.json\');',
    'const evidence = readLatest(path.join(rootDir, \'ops\', \'evidence\'), \'ops-evidence-summary.json\');',
    'const report = readLatest(path.join(rootDir, \'ops\', \'reports\'), \'ops-report.json\');',
    'const bundle = readLatest(path.join(rootDir, \'ops\', \'bundles\'), \'ops-bundle-summary.json\');',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const doctor = readLatest(path.join(rootDir, \'ops\', \'doctors\'), \'ops-doctor.json\');',
    'const handoff = readLatest(path.join(rootDir, \'ops\', \'handoffs\'), \'ops-handoff.json\');',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });',
    '',
    'for (const [id, surface] of [',
    '  [\'snapshot-present\', snapshot],',
    '  [\'evidence-present\', evidence],',
    '  [\'report-present\', report],',
    '  [\'bundle-present\', bundle],',
    '  [\'index-present\', index],',
    '  [\'doctor-present\', doctor],',
    '  [\'handoff-present\', handoff],',
    ']) {',
    '  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);',
    '}',
    '',
    'addCheck(\'doctor-verdict-pass\', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? \'pass\' : \'fail\'}` : \'doctor missing\');',
    'addCheck(\'handoff-verdict-pass\', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? \'pass\' : \'fail\'}` : \'handoff missing\');',
    'addCheck(\'handoff-archive-present\', handoff ? fs.existsSync(path.join(handoff.absoluteDir, \'ops-handoff.tgz\')) : false, handoff ? path.join(handoff.relativeDir, \'ops-handoff.tgz\') : \'handoff missing\');',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const readyDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'fs.mkdirSync(readyDir, { recursive: true });',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  readyDir: path.relative(rootDir, readyDir),',
    '  requireReleaseOutput,',
    '  retention: { skipped: skipRetention, keep: Number(keep) },',
    '  latest: {',
    '    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,',
    '    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,',
    '    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,',
    '    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,',
    '    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,',
    '  },',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(readyDir, \'ops-ready.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Ready\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Ready Dir: ${summary.readyDir}`,',
    '  `- Retention baseline skipped: ${summary.retention.skipped ? \'yes\' : \'no\'}`,',
    '  `- Retention keep count: ${summary.retention.keep}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Snapshot: ${summary.latest.snapshot?.dir ?? \'missing\'}`,',
    '  `- Evidence: ${summary.latest.evidence?.dir ?? \'missing\'}`,',
    '  `- Report: ${summary.latest.report?.dir ?? \'missing\'}`,',
    '  `- Bundle: ${summary.latest.bundle?.dir ?? \'missing\'}`,',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  `- Doctor: ${summary.latest.doctor?.dir ?? \'missing\'}`,',
    '  `- Handoff: ${summary.latest.handoff?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## Operator Next Steps\',',
    '  \'\',',
    '  \'- Review the latest doctor and handoff outputs for the final production verdict.\',',
    '  \'- Attach the latest `ops-handoff.tgz` when escalating or handing off the release.\',',
    '  \'- Use `ops-ready.json` as the single machine-readable summary for the production audit run.\',',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(readyDir, \'ops-ready.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations ready summary written to: ${readyDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
    'attest_args=(-- --label "$LABEL")',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  attest_args+=(--require-release-output)',
    'fi',
    'pnpm ops:attest "${attest_args[@]}"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
  ].join('\n');
}

function getOpsGateScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_GATE_DIR:-ops/gates}"',
    'KEEP="${OPS_GATE_KEEP:-10}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    'SKIP_RETENTION=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --keep)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --keep"',
    '        exit 1',
    '      fi',
    '      KEEP="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --skip-retention)',
    '      SKIP_RETENTION=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops gate argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'case "$KEEP" in',
    '  ""|*[!0-9]*)',
    '    echo "Gate keep value must be a non-negative integer. Got: $KEEP"',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'if [ "$SKIP_RETENTION" -eq 0 ]; then',
    '  pnpm ops:retention -- --keep "$KEEP"',
    'fi',
    '',
    'ready_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  ready_args+=(--require-release-output)',
    'fi',
    'pnpm ops:ready "${ready_args[@]}"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    'const skipRetention = skipRetentionFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const doctor = readLatest(path.join(rootDir, \'ops\', \'doctors\'), \'ops-doctor.json\');',
    'const handoff = readLatest(path.join(rootDir, \'ops\', \'handoffs\'), \'ops-handoff.json\');',
    'const attestation = readLatest(path.join(rootDir, \'ops\', \'attestations\'), \'ops-attestation.json\');',
    'const ready = readLatest(path.join(rootDir, \'ops\', \'ready\'), \'ops-ready.json\');',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });',
    'const packageVersion = `${pkg.name}@${pkg.version}`;',
    '',
    'for (const [id, surface] of [[',
    '  \'index-present\', index],',
    '  [\'doctor-present\', doctor],',
    '  [\'handoff-present\', handoff],',
    '  [\'attestation-present\', attestation],',
    '  [\'ready-present\', ready],',
    ']) {',
    '  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);',
    '}',
    '',
    'for (const [id, surface] of [',
    '  [\'doctor-package-match\', doctor],',
    '  [\'handoff-package-match\', handoff],',
    '  [\'attestation-package-match\', attestation],',
    '  [\'ready-package-match\', ready],',
    ']) {',
    '  if (!surface) continue;',
    '  const surfacePkg = surface.payload?.package;',
    '  const surfaceVersion = surfacePkg ? `${surfacePkg.name}@${surfacePkg.version}` : null;',
    '  addCheck(id, surfaceVersion === packageVersion, surfaceVersion ? `${surface.relativeDir} -> ${surfaceVersion}` : `${surface.relativeDir} -> missing package metadata`);',
    '}',
    '',
    'addCheck(\'doctor-verdict-pass\', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? \'pass\' : \'fail\'}` : \'doctor missing\');',
    'addCheck(\'handoff-verdict-pass\', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? \'pass\' : \'fail\'}` : \'handoff missing\');',
    'addCheck(\'ready-verdict-pass\', ready?.payload?.ok === true, ready ? `ready verdict=${ready.payload?.ok ? \'pass\' : \'fail\'}` : \'ready missing\');',
    'addCheck(\'attestation-verdict-pass\', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? \'pass\' : \'fail\'}` : \'attestation missing\');',
    'addCheck(\'handoff-archive-present\', handoff ? fs.existsSync(path.join(handoff.absoluteDir, \'ops-handoff.tgz\')) : false, handoff ? path.join(handoff.relativeDir, \'ops-handoff.tgz\') : \'handoff missing\');',
    'addCheck(\'attestation-artifacts-present\', (attestation?.payload?.artifactCount ?? 0) > 0, attestation ? `artifact count=${attestation.payload?.artifactCount ?? 0}` : \'attestation missing\');',
    '',
    'if (index?.payload?.latest) {',
    '  addCheck(\'index-latest-doctor-aligned\', index.payload.latest.doctor?.relativeDir === doctor?.relativeDir, index.payload.latest.doctor?.relativeDir ? `index doctor=${index.payload.latest.doctor.relativeDir}` : \'index missing doctor reference\');',
    '  addCheck(\'index-latest-handoff-aligned\', index.payload.latest.handoff?.relativeDir === handoff?.relativeDir, index.payload.latest.handoff?.relativeDir ? `index handoff=${index.payload.latest.handoff.relativeDir}` : \'index missing handoff reference\');',
    '  addCheck(\'index-latest-attestation-aligned\', index.payload.latest.attestation?.relativeDir === attestation?.relativeDir, index.payload.latest.attestation?.relativeDir ? `index attestation=${index.payload.latest.attestation.relativeDir}` : \'index missing attestation reference\');',
    '  addCheck(\'index-latest-ready-aligned\', index.payload.latest.ready?.relativeDir === ready?.relativeDir, index.payload.latest.ready?.relativeDir ? `index ready=${index.payload.latest.ready.relativeDir}` : \'index missing ready reference\');',
    '}',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'release-dir-present\', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : \'release directory missing\');',
    '  addCheck(\'release-manifest-present\', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(\', \') : \'No updater manifests found\');',
    '  addCheck(\'release-installer-present\', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(\', \') : \'No installer artifacts found\');',
    '} else {',
    '  addCheck(\'release-output-optional\', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const gateDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'fs.mkdirSync(gateDir, { recursive: true });',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  gateDir: path.relative(rootDir, gateDir),',
    '  requireReleaseOutput,',
    '  retention: { skipped: skipRetention, keep: Number(keep) },',
    '  latest: {',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,',
    '    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,',
    '    attestation: attestation ? { dir: attestation.relativeDir, modifiedAt: attestation.modifiedAt, ok: attestation.payload?.ok === true, artifactCount: attestation.payload?.artifactCount ?? 0 } : null,',
    '    ready: ready ? { dir: ready.relativeDir, modifiedAt: ready.modifiedAt, ok: ready.payload?.ok === true } : null,',
    '  },',
    '  release: { manifestCount: manifestFiles.length, installerCount: installerFiles.length, manifests: manifestFiles, installers: installerFiles },',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(gateDir, \'ops-gate.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    '',
    'const lines = [',
    '  \'# Operations Gate\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'go\' : \'no-go\'}`,',
    '  `- Gate Dir: ${summary.gateDir}`,',
    '  `- Retention baseline skipped: ${summary.retention.skipped ? \'yes\' : \'no\'}`,',
    '  `- Retention keep count: ${summary.retention.keep}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  `- Doctor: ${summary.latest.doctor?.dir ?? \'missing\'}`,',
    '  `- Handoff: ${summary.latest.handoff?.dir ?? \'missing\'}`,',
    '  `- Attestation: ${summary.latest.attestation?.dir ?? \'missing\'}`,',
    '  `- Ready: ${summary.latest.ready?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Release Output\',',
    '  \'\',',
    '  `- Manifest count: ${summary.release.manifestCount}`,',
    '  `- Installer count: ${summary.release.installerCount}`,',
    '  summary.release.manifests.length > 0 ? `- Manifests: ${summary.release.manifests.join(\', \')}` : \'- Manifests: none\',',
    '  summary.release.installers.length > 0 ? `- Installers: ${summary.release.installers.join(\', \')}` : \'- Installers: none\',',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## Operator Next Steps\',',
    '  \'\',',
    '  \'- Review `ops-gate.json` as the machine-readable go/no-go verdict for this production run.\',',
    '  \'- Attach the latest `ops-handoff.tgz` and `ops-attestation.json` when escalating or handing off the release.\',',
    '  \'- Re-run `pnpm ops:gate -- --label <name> --require-release-output` after any packaging or release-surface change.\',',
    '  \'\',',
    '];',
    '',
    'fs.writeFileSync(path.join(gateDir, \'ops-gate.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations gate written to: ${gateDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
    'pnpm ops:index -- --label "$LABEL"',
    '',
  ].join('\n');
}

function getOpsReleasePackScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_RELEASEPACK_DIR:-ops/releasepacks}"',
    'KEEP="${OPS_RELEASEPACK_KEEP:-10}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    'SKIP_RETENTION=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --keep)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --keep"',
    '        exit 1',
    '      fi',
    '      KEEP="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --skip-retention)',
    '      SKIP_RETENTION=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops releasepack argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'case "$KEEP" in',
    '  ""|*[!0-9]*)',
    '    echo "Release pack keep value must be a non-negative integer. Got: $KEEP"',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'if [ "$SKIP_RETENTION" -eq 0 ]; then',
    '  pnpm ops:retention -- --keep "$KEEP"',
    'fi',
    '',
    'gate_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  gate_args+=(--require-release-output)',
    'fi',
    'pnpm ops:gate "${gate_args[@]}"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    'const skipRetention = skipRetentionFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const copyIfExists = (source, destination) => {',
    '  if (!fs.existsSync(source)) return false;',
    '  fs.mkdirSync(path.dirname(destination), { recursive: true });',
    '  fs.copyFileSync(source, destination);',
    '  return true;',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const snapshot = readLatest(path.join(rootDir, \'ops\', \'snapshots\'), \'ops-snapshot.json\');',
    'const evidence = readLatest(path.join(rootDir, \'ops\', \'evidence\'), \'ops-evidence-summary.json\');',
    'const report = readLatest(path.join(rootDir, \'ops\', \'reports\'), \'ops-report.json\');',
    'const bundle = readLatest(path.join(rootDir, \'ops\', \'bundles\'), \'ops-bundle-summary.json\');',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const doctor = readLatest(path.join(rootDir, \'ops\', \'doctors\'), \'ops-doctor.json\');',
    'const handoff = readLatest(path.join(rootDir, \'ops\', \'handoffs\'), \'ops-handoff.json\');',
    'const attestation = readLatest(path.join(rootDir, \'ops\', \'attestations\'), \'ops-attestation.json\');',
    'const ready = readLatest(path.join(rootDir, \'ops\', \'ready\'), \'ops-ready.json\');',
    'const gate = readLatest(path.join(rootDir, \'ops\', \'gates\'), \'ops-gate.json\');',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });',
    'for (const [id, surface] of [[',
    '  \'snapshot-present\', snapshot],',
    '  [\'evidence-present\', evidence],',
    '  [\'report-present\', report],',
    '  [\'bundle-present\', bundle],',
    '  [\'index-present\', index],',
    '  [\'doctor-present\', doctor],',
    '  [\'handoff-present\', handoff],',
    '  [\'attestation-present\', attestation],',
    '  [\'ready-present\', ready],',
    '  [\'gate-present\', gate],',
    ']) {',
    '  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);',
    '}',
    'addCheck(\'doctor-pass\', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? \'pass\' : \'fail\'}` : \'doctor missing\');',
    'addCheck(\'handoff-pass\', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? \'pass\' : \'fail\'}` : \'handoff missing\');',
    'addCheck(\'attestation-pass\', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? \'pass\' : \'fail\'}` : \'attestation missing\');',
    'addCheck(\'ready-pass\', ready?.payload?.ok === true, ready ? `ready verdict=${ready.payload?.ok ? \'pass\' : \'fail\'}` : \'ready missing\');',
    'addCheck(\'gate-go\', gate?.payload?.ok === true, gate ? `gate verdict=${gate.payload?.ok ? \'go\' : \'no-go\'}` : \'gate missing\');',
    'addCheck(\'handoff-archive-present\', handoff ? fs.existsSync(path.join(handoff.absoluteDir, \'ops-handoff.tgz\')) : false, handoff ? path.join(handoff.relativeDir, \'ops-handoff.tgz\') : \'handoff missing\');',
    'addCheck(\'bundle-archive-present\', bundle ? fs.existsSync(path.join(bundle.absoluteDir, \'ops-bundle.tgz\')) : false, bundle ? path.join(bundle.relativeDir, \'ops-bundle.tgz\') : \'bundle missing\');',
    'addCheck(\'attestation-artifacts-present\', (attestation?.payload?.artifactCount ?? 0) > 0, attestation ? `artifact count=${attestation.payload?.artifactCount ?? 0}` : \'attestation missing\');',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'release-dir-present\', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : \'release directory missing\');',
    '  addCheck(\'release-manifest-present\', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(\', \') : \'No updater manifests found\');',
    '  addCheck(\'release-installer-present\', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(\', \') : \'No installer artifacts found\');',
    '} else {',
    '  addCheck(\'release-output-optional\', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const releasePackDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'const payloadDir = path.join(releasePackDir, \'payload\');',
    'fs.mkdirSync(payloadDir, { recursive: true });',
    '',
    'const copySurface = (surface, key, names) => {',
    '  if (!surface) return [];',
    '  const copied = [];',
    '  for (const name of names) {',
    '    const source = path.join(surface.absoluteDir, name);',
    '    const destination = path.join(payloadDir, key, name);',
    '    if (copyIfExists(source, destination)) copied.push(path.join(\'payload\', key, name));',
    '  }',
    '  return copied;',
    '};',
    '',
    'const copied = {',
    '  snapshot: copySurface(snapshot, \'snapshot\', [\'ops-snapshot.json\', \'ops-snapshot.md\']),',
    '  evidence: copySurface(evidence, \'evidence\', [\'ops-evidence-summary.json\', \'ops-evidence-summary.md\']),',
    '  report: copySurface(report, \'report\', [\'ops-report.json\', \'ops-report.md\']),',
    '  bundle: copySurface(bundle, \'bundle\', [\'ops-bundle-summary.json\', \'ops-bundle-summary.md\', \'ops-bundle.tgz\']),',
    '  index: copySurface(index, \'index\', [\'ops-index.json\', \'ops-index.md\']),',
    '  doctor: copySurface(doctor, \'doctor\', [\'ops-doctor.json\', \'ops-doctor.md\']),',
    '  handoff: copySurface(handoff, \'handoff\', [\'ops-handoff.json\', \'ops-handoff.md\', \'ops-handoff.tgz\']),',
    '  attestation: copySurface(attestation, \'attestation\', [\'ops-attestation.json\', \'ops-attestation.md\']),',
    '  ready: copySurface(ready, \'ready\', [\'ops-ready.json\', \'ops-ready.md\']),',
    '  gate: copySurface(gate, \'gate\', [\'ops-gate.json\', \'ops-gate.md\']),',
    '  docs: [],',
    '  env: [],',
    '  manifests: [],',
    '  installers: [],',
    '};',
    '',
    'for (const relativeDoc of [path.join(\'docs\', \'release-playbook.md\'), path.join(\'docs\', \'production-readiness.md\')]) {',
    '  const source = path.join(rootDir, relativeDoc);',
    '  const destination = path.join(payloadDir, \'docs\', path.basename(relativeDoc));',
    '  if (copyIfExists(source, destination)) copied.docs.push(relativeDoc);',
    '}',
    'const envExample = path.join(rootDir, \'.env.example\');',
    'if (copyIfExists(envExample, path.join(payloadDir, \'env\', \'.env.example\'))) copied.env.push(\'.env.example\');',
    'for (const file of manifestFiles) {',
    '  if (copyIfExists(path.join(releaseDir, file), path.join(payloadDir, \'release\', file))) copied.manifests.push(path.join(\'payload\', \'release\', file));',
    '}',
    'for (const file of installerFiles) {',
    '  if (copyIfExists(path.join(releaseDir, file), path.join(payloadDir, \'release\', file))) copied.installers.push(path.join(\'payload\', \'release\', file));',
    '}',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  releasePackDir: path.relative(rootDir, releasePackDir),',
    '  archivePath: path.join(path.relative(rootDir, releasePackDir), \'ops-releasepack.tgz\'),',
    '  requireReleaseOutput,',
    '  retention: { skipped: skipRetention, keep: Number(keep) },',
    '  latest: {',
    '    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,',
    '    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,',
    '    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,',
    '    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,',
    '    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,',
    '    attestation: attestation ? { dir: attestation.relativeDir, modifiedAt: attestation.modifiedAt, ok: attestation.payload?.ok === true } : null,',
    '    ready: ready ? { dir: ready.relativeDir, modifiedAt: ready.modifiedAt, ok: ready.payload?.ok === true } : null,',
    '    gate: gate ? { dir: gate.relativeDir, modifiedAt: gate.modifiedAt, ok: gate.payload?.ok === true } : null,',
    '  },',
    '  copied,',
    '  release: { manifests: manifestFiles, installers: installerFiles },',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(releasePackDir, \'ops-releasepack.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    'const lines = [',
    '  \'# Operations Release Pack\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Release Pack Dir: ${summary.releasePackDir}`,',
    '  `- Archive Path: ${summary.archivePath}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  `- Retention baseline skipped: ${summary.retention.skipped ? \'yes\' : \'no\'}`,',
    '  `- Retention keep count: ${summary.retention.keep}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Snapshot: ${summary.latest.snapshot?.dir ?? \'missing\'}`,',
    '  `- Evidence: ${summary.latest.evidence?.dir ?? \'missing\'}`,',
    '  `- Report: ${summary.latest.report?.dir ?? \'missing\'}`,',
    '  `- Bundle: ${summary.latest.bundle?.dir ?? \'missing\'}`,',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  `- Doctor: ${summary.latest.doctor?.dir ?? \'missing\'}`,',
    '  `- Handoff: ${summary.latest.handoff?.dir ?? \'missing\'}`,',
    '  `- Attestation: ${summary.latest.attestation?.dir ?? \'missing\'}`,',
    '  `- Ready: ${summary.latest.ready?.dir ?? \'missing\'}`,',
    '  `- Gate: ${summary.latest.gate?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Payload Counts\',',
    '  \'\',',
    '  `- Snapshot files: ${summary.copied.snapshot.length}`,',
    '  `- Evidence files: ${summary.copied.evidence.length}`,',
    '  `- Report files: ${summary.copied.report.length}`,',
    '  `- Bundle files: ${summary.copied.bundle.length}`,',
    '  `- Index files: ${summary.copied.index.length}`,',
    '  `- Doctor files: ${summary.copied.doctor.length}`,',
    '  `- Handoff files: ${summary.copied.handoff.length}`,',
    '  `- Attestation files: ${summary.copied.attestation.length}`,',
    '  `- Ready files: ${summary.copied.ready.length}`,',
    '  `- Gate files: ${summary.copied.gate.length}`,',
    '  `- Docs copied: ${summary.copied.docs.length > 0 ? summary.copied.docs.join(\', \') : \'none\'}`,',
    '  `- Env copied: ${summary.copied.env.length > 0 ? summary.copied.env.join(\', \') : \'none\'}`,',
    '  `- Release manifests copied: ${summary.copied.manifests.length}`,',
    '  `- Release installers copied: ${summary.copied.installers.length}`,',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## Operator Next Steps\',',
    '  \'\',',
    '  \'- Attach `ops-releasepack.tgz` when escalating the packaged release or handing it to operations.\',',
    '  \'- Use `ops-releasepack.json` as the machine-readable final production evidence inventory.\',',
    '  \'- Re-run `pnpm ops:releasepack -- --label <name> --require-release-output` after any packaging or release-surface change.\',',
    '  \'\',',
    '];',
    'fs.writeFileSync(path.join(releasePackDir, \'ops-releasepack.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations release pack written to: ${releasePackDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
    'releasepack_dir="$(find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"',
    'if [ -z "$releasepack_dir" ]; then',
    '  echo "Failed to locate generated ops release pack directory in $OUTPUT_ROOT"',
    '  exit 1',
    'fi',
    'tar -czf "$releasepack_dir/ops-releasepack.tgz" -C "$releasepack_dir" payload',
    'echo "Operations release pack archive written to: $releasepack_dir/ops-releasepack.tgz"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
  ].join('\n');
}

function getOpsExportScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_EXPORT_DIR:-ops/exports}"',
    'KEEP="${OPS_EXPORT_KEEP:-10}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    'SKIP_RETENTION=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --keep)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --keep"',
    '        exit 1',
    '      fi',
    '      KEEP="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --skip-retention)',
    '      SKIP_RETENTION=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops export argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'case "$KEEP" in',
    '  ""|*[!0-9]*)',
    '    echo "Export keep value must be a non-negative integer. Got: $KEEP"',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'if [ "$SKIP_RETENTION" -eq 0 ]; then',
    '  pnpm ops:retention -- --keep "$KEEP"',
    'fi',
    '',
    'releasepack_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  releasepack_args+=(--require-release-output)',
    'fi',
    'pnpm ops:releasepack "${releasepack_args[@]}"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    'const skipRetention = skipRetentionFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const copyIfExists = (source, destination) => {',
    '  if (!fs.existsSync(source)) return false;',
    '  fs.mkdirSync(path.dirname(destination), { recursive: true });',
    '  fs.copyFileSync(source, destination);',
    '  return true;',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const snapshot = readLatest(path.join(rootDir, \'ops\', \'snapshots\'), \'ops-snapshot.json\');',
    'const evidence = readLatest(path.join(rootDir, \'ops\', \'evidence\'), \'ops-evidence-summary.json\');',
    'const report = readLatest(path.join(rootDir, \'ops\', \'reports\'), \'ops-report.json\');',
    'const bundle = readLatest(path.join(rootDir, \'ops\', \'bundles\'), \'ops-bundle-summary.json\');',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const doctor = readLatest(path.join(rootDir, \'ops\', \'doctors\'), \'ops-doctor.json\');',
    'const handoff = readLatest(path.join(rootDir, \'ops\', \'handoffs\'), \'ops-handoff.json\');',
    'const attestation = readLatest(path.join(rootDir, \'ops\', \'attestations\'), \'ops-attestation.json\');',
    'const ready = readLatest(path.join(rootDir, \'ops\', \'ready\'), \'ops-ready.json\');',
    'const gate = readLatest(path.join(rootDir, \'ops\', \'gates\'), \'ops-gate.json\');',
    'const releasePack = readLatest(path.join(rootDir, \'ops\', \'releasepacks\'), \'ops-releasepack.json\');',
    'const releaseDir = path.join(rootDir, \'release\');',
    'const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).sort() : [];',
    'const manifestFiles = releaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const installerFiles = releaseFiles.filter((file) => !manifestFiles.includes(file));',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });',
    'for (const [id, surface] of [',
    '  [\'snapshot-present\', snapshot],',
    '  [\'evidence-present\', evidence],',
    '  [\'report-present\', report],',
    '  [\'bundle-present\', bundle],',
    '  [\'index-present\', index],',
    '  [\'doctor-present\', doctor],',
    '  [\'handoff-present\', handoff],',
    '  [\'attestation-present\', attestation],',
    '  [\'ready-present\', ready],',
    '  [\'gate-present\', gate],',
    '  [\'releasepack-present\', releasePack],',
    ']) {',
    '  addCheck(id, Boolean(surface), surface ? surface.relativeDir : `${id} missing`);',
    '}',
    'addCheck(\'doctor-pass\', doctor?.payload?.ok === true, doctor ? `doctor verdict=${doctor.payload?.ok ? \'pass\' : \'fail\'}` : \'doctor missing\');',
    'addCheck(\'handoff-pass\', handoff?.payload?.ok === true, handoff ? `handoff verdict=${handoff.payload?.ok ? \'pass\' : \'fail\'}` : \'handoff missing\');',
    'addCheck(\'attestation-pass\', attestation?.payload?.ok === true, attestation ? `attestation verdict=${attestation.payload?.ok ? \'pass\' : \'fail\'}` : \'attestation missing\');',
    'addCheck(\'ready-pass\', ready?.payload?.ok === true, ready ? `ready verdict=${ready.payload?.ok ? \'pass\' : \'fail\'}` : \'ready missing\');',
    'addCheck(\'gate-go\', gate?.payload?.ok === true, gate ? `gate verdict=${gate.payload?.ok ? \'go\' : \'no-go\'}` : \'gate missing\');',
    'addCheck(\'releasepack-pass\', releasePack?.payload?.ok === true, releasePack ? `releasepack verdict=${releasePack.payload?.ok ? \'pass\' : \'fail\'}` : \'releasepack missing\');',
    'addCheck(\'releasepack-archive-present\', releasePack ? fs.existsSync(path.join(releasePack.absoluteDir, \'ops-releasepack.tgz\')) : false, releasePack ? path.join(releasePack.relativeDir, \'ops-releasepack.tgz\') : \'releasepack missing\');',
    'if (index?.payload?.latest) {',
    '  addCheck(\'index-latest-releasepack-aligned\', index.payload.latest.releasePack?.relativeDir === releasePack?.relativeDir, index.payload.latest.releasePack?.relativeDir ? `index releasepack=${index.payload.latest.releasePack.relativeDir}` : \'index missing latest release pack reference\');',
    '}',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'release-dir-present\', fs.existsSync(releaseDir), fs.existsSync(releaseDir) ? path.relative(rootDir, releaseDir) : \'release directory missing\');',
    '  addCheck(\'release-manifest-present\', manifestFiles.length > 0, manifestFiles.length > 0 ? manifestFiles.join(\', \') : \'No updater manifests found\');',
    '  addCheck(\'release-installer-present\', installerFiles.length > 0, installerFiles.length > 0 ? installerFiles.join(\', \') : \'No installer artifacts found\');',
    '} else {',
    '  addCheck(\'release-output-optional\', true, manifestFiles.length > 0 || installerFiles.length > 0 ? `release files present: ${releaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const exportDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'const payloadDir = path.join(exportDir, \'payload\');',
    'fs.mkdirSync(payloadDir, { recursive: true });',
    '',
    'const copySurface = (surface, key, names) => {',
    '  if (!surface) return [];',
    '  const copied = [];',
    '  for (const name of names) {',
    '    const source = path.join(surface.absoluteDir, name);',
    '    const destination = path.join(payloadDir, key, name);',
    '    if (copyIfExists(source, destination)) copied.push(path.join(\'payload\', key, name));',
    '  }',
    '  return copied;',
    '};',
    '',
    'const copied = {',
    '  snapshot: copySurface(snapshot, \'snapshot\', [\'ops-snapshot.json\', \'ops-snapshot.md\']),',
    '  evidence: copySurface(evidence, \'evidence\', [\'ops-evidence-summary.json\', \'ops-evidence-summary.md\']),',
    '  report: copySurface(report, \'report\', [\'ops-report.json\', \'ops-report.md\']),',
    '  bundle: copySurface(bundle, \'bundle\', [\'ops-bundle-summary.json\', \'ops-bundle-summary.md\', \'ops-bundle.tgz\']),',
    '  index: copySurface(index, \'index\', [\'ops-index.json\', \'ops-index.md\']),',
    '  doctor: copySurface(doctor, \'doctor\', [\'ops-doctor.json\', \'ops-doctor.md\']),',
    '  handoff: copySurface(handoff, \'handoff\', [\'ops-handoff.json\', \'ops-handoff.md\', \'ops-handoff.tgz\']),',
    '  attestation: copySurface(attestation, \'attestation\', [\'ops-attestation.json\', \'ops-attestation.md\']),',
    '  ready: copySurface(ready, \'ready\', [\'ops-ready.json\', \'ops-ready.md\']),',
    '  gate: copySurface(gate, \'gate\', [\'ops-gate.json\', \'ops-gate.md\']),',
    '  releasePack: copySurface(releasePack, \'releasepack\', [\'ops-releasepack.json\', \'ops-releasepack.md\', \'ops-releasepack.tgz\']),',
    '  docs: [],',
    '  env: [],',
    '  manifests: [],',
    '  installers: [],',
    '};',
    '',
    'for (const relativeDoc of [path.join(\'docs\', \'release-playbook.md\'), path.join(\'docs\', \'production-readiness.md\')]) {',
    '  const source = path.join(rootDir, relativeDoc);',
    '  const destination = path.join(payloadDir, \'docs\', path.basename(relativeDoc));',
    '  if (copyIfExists(source, destination)) copied.docs.push(relativeDoc);',
    '}',
    'const envExample = path.join(rootDir, \'.env.example\');',
    'if (copyIfExists(envExample, path.join(payloadDir, \'env\', \'.env.example\'))) copied.env.push(\'.env.example\');',
    'for (const file of manifestFiles) {',
    '  if (copyIfExists(path.join(releaseDir, file), path.join(payloadDir, \'release\', file))) copied.manifests.push(path.join(\'payload\', \'release\', file));',
    '}',
    'for (const file of installerFiles) {',
    '  if (copyIfExists(path.join(releaseDir, file), path.join(payloadDir, \'release\', file))) copied.installers.push(path.join(\'payload\', \'release\', file));',
    '}',
    '',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  exportDir: path.relative(rootDir, exportDir),',
    '  archivePath: path.join(path.relative(rootDir, exportDir), \'ops-export.tgz\'),',
    '  requireReleaseOutput,',
    '  retention: { skipped: skipRetention, keep: Number(keep) },',
    '  latest: {',
    '    snapshot: snapshot ? { dir: snapshot.relativeDir, modifiedAt: snapshot.modifiedAt } : null,',
    '    evidence: evidence ? { dir: evidence.relativeDir, modifiedAt: evidence.modifiedAt } : null,',
    '    report: report ? { dir: report.relativeDir, modifiedAt: report.modifiedAt } : null,',
    '    bundle: bundle ? { dir: bundle.relativeDir, modifiedAt: bundle.modifiedAt } : null,',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    doctor: doctor ? { dir: doctor.relativeDir, modifiedAt: doctor.modifiedAt, ok: doctor.payload?.ok === true } : null,',
    '    handoff: handoff ? { dir: handoff.relativeDir, modifiedAt: handoff.modifiedAt, ok: handoff.payload?.ok === true } : null,',
    '    attestation: attestation ? { dir: attestation.relativeDir, modifiedAt: attestation.modifiedAt, ok: attestation.payload?.ok === true } : null,',
    '    ready: ready ? { dir: ready.relativeDir, modifiedAt: ready.modifiedAt, ok: ready.payload?.ok === true } : null,',
    '    gate: gate ? { dir: gate.relativeDir, modifiedAt: gate.modifiedAt, ok: gate.payload?.ok === true } : null,',
    '    releasePack: releasePack ? { dir: releasePack.relativeDir, modifiedAt: releasePack.modifiedAt, ok: releasePack.payload?.ok === true } : null,',
    '  },',
    '  copied,',
    '  release: { manifests: manifestFiles, installers: installerFiles },',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(exportDir, \'ops-export.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    'const lines = [',
    '  \'# Operations Export\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Export Dir: ${summary.exportDir}`,',
    '  `- Archive Path: ${summary.archivePath}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  `- Retention baseline skipped: ${summary.retention.skipped ? \'yes\' : \'no\'}`,',
    '  `- Retention keep count: ${summary.retention.keep}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Release Pack: ${summary.latest.releasePack?.dir ?? \'missing\'}`,',
    '  `- Gate: ${summary.latest.gate?.dir ?? \'missing\'}`,',
    '  `- Handoff: ${summary.latest.handoff?.dir ?? \'missing\'}`,',
    '  `- Attestation: ${summary.latest.attestation?.dir ?? \'missing\'}`,',
    '  `- Ready: ${summary.latest.ready?.dir ?? \'missing\'}`,',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Payload Counts\',',
    '  \'\',',
    '  `- Release pack files: ${summary.copied.releasePack.length}`,',
    '  `- Gate files: ${summary.copied.gate.length}`,',
    '  `- Handoff files: ${summary.copied.handoff.length}`,',
    '  `- Attestation files: ${summary.copied.attestation.length}`,',
    '  `- Ready files: ${summary.copied.ready.length}`,',
    '  `- Docs copied: ${summary.copied.docs.length > 0 ? summary.copied.docs.join(\', \') : \'none\'}`,',
    '  `- Env copied: ${summary.copied.env.length > 0 ? summary.copied.env.join(\', \') : \'none\'}`,',
    '  `- Release manifests copied: ${summary.copied.manifests.length}`,',
    '  `- Release installers copied: ${summary.copied.installers.length}`,',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## Operator Next Steps\',',
    '  \'\',',
    '  \'- Attach `ops-export.tgz` when handing the release to offline reviewers or operations outside CI artifacts.\',',
    '  \'- Use `ops-export.json` as the machine-readable final portable handoff manifest.\',',
    '  \'- Re-run `pnpm ops:export -- --label <name> --require-release-output` after any packaging or release-surface change.\',',
    '  \'\',',
    '];',
    'fs.writeFileSync(path.join(exportDir, \'ops-export.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations export written to: ${exportDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
    'export_dir="$(find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"',
    'if [ -z "$export_dir" ]; then',
    '  echo "Failed to locate generated ops export directory in $OUTPUT_ROOT"',
    '  exit 1',
    'fi',
    'tar -czf "$export_dir/ops-export.tgz" -C "$export_dir" payload',
    'echo "Operations export archive written to: $export_dir/ops-export.tgz"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
  ].join('\n');
}

function getOpsRestoreScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_RESTORE_DIR:-ops/restores}"',
    'KEEP="${OPS_RESTORE_KEEP:-10}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    'SKIP_RETENTION=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --keep)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --keep"',
    '        exit 1',
    '      fi',
    '      KEEP="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --skip-retention)',
    '      SKIP_RETENTION=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops restore argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'case "$KEEP" in',
    '  ""|*[!0-9]*)',
    '    echo "Restore keep value must be a non-negative integer. Got: $KEEP"',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'if [ "$SKIP_RETENTION" -eq 0 ]; then',
    '  pnpm ops:retention -- --keep "$KEEP"',
    'fi',
    '',
    'export_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  export_args+=(--require-release-output)',
    'fi',
    'pnpm ops:export "${export_args[@]}"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    'const { spawnSync } = require(\'node:child_process\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    'const skipRetention = skipRetentionFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const exportSurface = readLatest(path.join(rootDir, \'ops\', \'exports\'), \'ops-export.json\');',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });',
    'addCheck(\'index-present\', Boolean(index), index ? index.relativeDir : \'index missing\');',
    'addCheck(\'export-present\', Boolean(exportSurface), exportSurface ? exportSurface.relativeDir : \'export missing\');',
    'addCheck(\'export-pass\', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? \'pass\' : \'fail\'}` : \'export missing\');',
    '',
    'let exportArchive = null;',
    'if (exportSurface) {',
    '  exportArchive = path.join(exportSurface.absoluteDir, \'ops-export.tgz\');',
    '  addCheck(\'export-archive-present\', fs.existsSync(exportArchive), fs.existsSync(exportArchive) ? path.relative(rootDir, exportArchive) : `missing ${path.relative(rootDir, exportArchive)}`);',
    '  if (index?.payload?.latest?.export?.relativeDir) {',
    '    addCheck(\'index-latest-export-aligned\', index.payload.latest.export.relativeDir === exportSurface.relativeDir, `index export=${index.payload.latest.export.relativeDir}`);',
    '  }',
    '}',
    '',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const restoreDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'const restoredRoot = path.join(restoreDir, \'restored\');',
    'fs.mkdirSync(restoredRoot, { recursive: true });',
    '',
    'if (exportArchive && fs.existsSync(exportArchive)) {',
    '  const tarResult = spawnSync(\'tar\', [\'-xzf\', exportArchive, \'-C\', restoredRoot], { stdio: \'pipe\' });',
    '  addCheck(\'export-archive-extracted\', tarResult.status === 0, tarResult.status === 0 ? `extracted ${path.relative(rootDir, exportArchive)}` : (tarResult.stderr?.toString().trim() || tarResult.stdout?.toString().trim() || `tar exited with ${tarResult.status}`));',
    '} else {',
    '  addCheck(\'export-archive-extracted\', false, \'export archive missing\');',
    '}',
    '',
    'const requiredPayloadFiles = [',
    '  [\'releasepack-json\', path.join(restoredRoot, \'payload\', \'releasepack\', \'ops-releasepack.json\')],',
    '  [\'gate-json\', path.join(restoredRoot, \'payload\', \'gate\', \'ops-gate.json\')],',
    '  [\'handoff-json\', path.join(restoredRoot, \'payload\', \'handoff\', \'ops-handoff.json\')],',
    '  [\'attestation-json\', path.join(restoredRoot, \'payload\', \'attestation\', \'ops-attestation.json\')],',
    '  [\'ready-json\', path.join(restoredRoot, \'payload\', \'ready\', \'ops-ready.json\')],',
    '  [\'index-json\', path.join(restoredRoot, \'payload\', \'index\', \'ops-index.json\')],',
    '  [\'release-playbook\', path.join(restoredRoot, \'payload\', \'docs\', \'release-playbook.md\')],',
    '  [\'production-readiness\', path.join(restoredRoot, \'payload\', \'docs\', \'production-readiness.md\')],',
    '  [\'env-example\', path.join(restoredRoot, \'payload\', \'env\', \'.env.example\')],',
    '];',
    '',
    'for (const [id, filePath] of requiredPayloadFiles) {',
    '  addCheck(`payload-${id}`, fs.existsSync(filePath), fs.existsSync(filePath) ? path.relative(rootDir, filePath) : `missing ${path.relative(rootDir, filePath)}`);',
    '}',
    '',
    'const restoredReleaseDir = path.join(restoredRoot, \'payload\', \'release\');',
    'const restoredReleaseFiles = fs.existsSync(restoredReleaseDir) ? fs.readdirSync(restoredReleaseDir).sort() : [];',
    'const restoredManifestFiles = restoredReleaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const restoredInstallerFiles = restoredReleaseFiles.filter((file) => !restoredManifestFiles.includes(file));',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'restored-release-dir\', fs.existsSync(restoredReleaseDir), fs.existsSync(restoredReleaseDir) ? path.relative(rootDir, restoredReleaseDir) : \'restored release directory missing\');',
    '  addCheck(\'restored-manifests\', restoredManifestFiles.length > 0, restoredManifestFiles.length > 0 ? restoredManifestFiles.join(\', \') : \'no restored manifests\');',
    '  addCheck(\'restored-installers\', restoredInstallerFiles.length > 0, restoredInstallerFiles.length > 0 ? restoredInstallerFiles.join(\', \') : \'no restored installers\');',
    '} else {',
    '  addCheck(\'restored-release-optional\', true, restoredReleaseFiles.length > 0 ? `restored release files: ${restoredReleaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'let restoredIndex = null;',
    'const restoredIndexPath = path.join(restoredRoot, \'payload\', \'index\', \'ops-index.json\');',
    'if (fs.existsSync(restoredIndexPath)) {',
    '  restoredIndex = JSON.parse(fs.readFileSync(restoredIndexPath, \'utf8\'));',
    '  addCheck(\'restored-index-loaded\', true, `restored exports=${restoredIndex.counts?.exports ?? 0}`);',
    '}',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  restoreDir: path.relative(rootDir, restoreDir),',
    '  restoredPayloadDir: path.relative(rootDir, path.join(restoredRoot, \'payload\')),',
    '  requireReleaseOutput,',
    '  retention: { skipped: skipRetention, keep: Number(keep) },',
    '  latest: {',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,',
    '  },',
    '  restored: {',
    '    manifests: restoredManifestFiles,',
    '    installers: restoredInstallerFiles,',
    '  },',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(restoreDir, \'ops-restore.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    'const lines = [',
    '  \'# Operations Restore\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Restore Dir: ${summary.restoreDir}`,',
    '  `- Restored Payload Dir: ${summary.restoredPayloadDir}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  `- Retention baseline skipped: ${summary.retention.skipped ? \'yes\' : \'no\'}`,',
    '  `- Retention keep count: ${summary.retention.keep}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  `- Export: ${summary.latest.export?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Restored Release Inventory\',',
    '  \'\',',
    '  `- Restored manifests: ${summary.restored.manifests.length > 0 ? summary.restored.manifests.join(\', \') : \'none\'}`,',
    '  `- Restored installers: ${summary.restored.installers.length > 0 ? summary.restored.installers.join(\', \') : \'none\'}`,',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## Operator Next Steps\',',
    '  \'\',',
    '  \'- Use this restore directory as proof that the latest offline export can be rehydrated outside CI artifacts.\',',
    '  \'- Re-run `pnpm ops:restore -- --label <name> --require-release-output` after any packaging or release-surface change.\',',
    '  \'- Attach `ops-restore.json` and `ops-restore.md` when handoff requires a final restore rehearsal record.\',',
    '  \'\',',
    '];',
    'fs.writeFileSync(path.join(restoreDir, \'ops-restore.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations restore written to: ${restoreDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
    'pnpm ops:index -- --label "$LABEL"',
    '',
  ].join('\n');
}

function getOpsRecoverScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'LABEL="manual"',
    'OUTPUT_ROOT="${OPS_RECOVER_DIR:-ops/recoveries}"',
    'KEEP="${OPS_RECOVER_KEEP:-10}"',
    'REQUIRE_RELEASE_OUTPUT=0',
    'SKIP_RETENTION=0',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --label)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --label"',
    '        exit 1',
    '      fi',
    '      LABEL="$1"',
    '      ;;',
    '    --output-dir)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --output-dir"',
    '        exit 1',
    '      fi',
    '      OUTPUT_ROOT="$1"',
    '      ;;',
    '    --keep)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --keep"',
    '        exit 1',
    '      fi',
    '      KEEP="$1"',
    '      ;;',
    '    --require-release-output)',
    '      REQUIRE_RELEASE_OUTPUT=1',
    '      ;;',
    '    --skip-retention)',
    '      SKIP_RETENTION=1',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops recover argument: $1"',
    '      echo "Use --label <name>, optional --output-dir <dir>, optional --keep <count>, optional --skip-retention, and optional --require-release-output."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'case "$KEEP" in',
    '  ""|*[!0-9]*)',
    '    echo "Recover keep value must be a non-negative integer. Got: $KEEP"',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'if [ "$SKIP_RETENTION" -eq 0 ]; then',
    '  pnpm ops:retention -- --keep "$KEEP"',
    'fi',
    '',
    'restore_args=(-- --label "$LABEL" --keep "$KEEP" --skip-retention)',
    'if [ "$REQUIRE_RELEASE_OUTPUT" -eq 1 ]; then',
    '  restore_args+=(--require-release-output)',
    'fi',
    'pnpm ops:restore "${restore_args[@]}"',
    'pnpm ops:index -- --label "$LABEL"',
    '',
    'mkdir -p "$OUTPUT_ROOT"',
    '',
    'node - "$ROOT_DIR" "$OUTPUT_ROOT" "$LABEL" "$REQUIRE_RELEASE_OUTPUT" "$SKIP_RETENTION" "$KEEP" <<\'NODE\'',
    'const fs = require(\'node:fs\');',
    'const path = require(\'node:path\');',
    '',
    'const [rootDir, outputRoot, label, requireReleaseOutputFlag, skipRetentionFlag, keep] = process.argv.slice(2);',
    'const requireReleaseOutput = requireReleaseOutputFlag === \'1\';',
    'const skipRetention = skipRetentionFlag === \'1\';',
    '',
    'const readLatest = (root, fileName) => {',
    '  if (!fs.existsSync(root)) return null;',
    '  const candidates = fs.readdirSync(root)',
    '    .map((entry) => path.join(root, entry))',
    '    .filter((entry) => fs.existsSync(path.join(entry, fileName)))',
    '    .map((entry) => ({ entry, stat: fs.statSync(entry) }))',
    '    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);',
    '  if (candidates.length === 0) return null;',
    '  const latestDir = candidates[0].entry;',
    '  return {',
    '    absoluteDir: latestDir,',
    '    relativeDir: path.relative(rootDir, latestDir),',
    '    modifiedAt: new Date(candidates[0].stat.mtimeMs).toISOString(),',
    '    payload: JSON.parse(fs.readFileSync(path.join(latestDir, fileName), \'utf8\')),',
    '  };',
    '};',
    '',
    'const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, \'package.json\'), \'utf8\'));',
    'const index = readLatest(path.join(rootDir, \'ops\', \'index\'), \'ops-index.json\');',
    'const gateSurface = readLatest(path.join(rootDir, \'ops\', \'gates\'), \'ops-gate.json\');',
    'const exportSurface = readLatest(path.join(rootDir, \'ops\', \'exports\'), \'ops-export.json\');',
    'const restoreSurface = readLatest(path.join(rootDir, \'ops\', \'restores\'), \'ops-restore.json\');',
    '',
    'const checks = [];',
    'const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });',
    'addCheck(\'index-present\', Boolean(index), index ? index.relativeDir : \'index missing\');',
    'addCheck(\'gate-present\', Boolean(gateSurface), gateSurface ? gateSurface.relativeDir : \'gate missing\');',
    'addCheck(\'gate-pass\', gateSurface?.payload?.ok === true, gateSurface ? `gate verdict=${gateSurface.payload?.ok ? \'pass\' : \'fail\'}` : \'gate missing\');',
    'addCheck(\'export-present\', Boolean(exportSurface), exportSurface ? exportSurface.relativeDir : \'export missing\');',
    'addCheck(\'export-pass\', exportSurface?.payload?.ok === true, exportSurface ? `export verdict=${exportSurface.payload?.ok ? \'pass\' : \'fail\'}` : \'export missing\');',
    'addCheck(\'restore-present\', Boolean(restoreSurface), restoreSurface ? restoreSurface.relativeDir : \'restore missing\');',
    'addCheck(\'restore-pass\', restoreSurface?.payload?.ok === true, restoreSurface ? `restore verdict=${restoreSurface.payload?.ok ? \'pass\' : \'fail\'}` : \'restore missing\');',
    '',
    'if (index?.payload?.latest?.restore?.relativeDir && restoreSurface) {',
    '  addCheck(\'index-latest-restore-aligned\', index.payload.latest.restore.relativeDir === restoreSurface.relativeDir, `index restore=${index.payload.latest.restore.relativeDir}`);',
    '}',
    '',
    'const restoredPayloadDir = restoreSurface?.payload?.restoredPayloadDir ? path.join(rootDir, restoreSurface.payload.restoredPayloadDir) : null;',
    'addCheck(\'restored-payload-dir\', Boolean(restoredPayloadDir && fs.existsSync(restoredPayloadDir)), restoredPayloadDir ? (fs.existsSync(restoredPayloadDir) ? path.relative(rootDir, restoredPayloadDir) : `missing ${path.relative(rootDir, restoredPayloadDir)}`) : \'restore payload missing\');',
    '',
    'const requiredRecoveredFiles = restoredPayloadDir ? [',
    '  [\'releasepack-json\', path.join(restoredPayloadDir, \'releasepack\', \'ops-releasepack.json\')],',
    '  [\'gate-json\', path.join(restoredPayloadDir, \'gate\', \'ops-gate.json\')],',
    '  [\'handoff-json\', path.join(restoredPayloadDir, \'handoff\', \'ops-handoff.json\')],',
    '  [\'attestation-json\', path.join(restoredPayloadDir, \'attestation\', \'ops-attestation.json\')],',
    '  [\'ready-json\', path.join(restoredPayloadDir, \'ready\', \'ops-ready.json\')],',
    '  [\'index-json\', path.join(restoredPayloadDir, \'index\', \'ops-index.json\')],',
    '] : [];',
    '',
    'for (const [id, filePath] of requiredRecoveredFiles) {',
    '  addCheck(`recovered-${id}`, fs.existsSync(filePath), fs.existsSync(filePath) ? path.relative(rootDir, filePath) : `missing ${path.relative(rootDir, filePath)}`);',
    '}',
    '',
    'const restoredReleaseDir = restoredPayloadDir ? path.join(restoredPayloadDir, \'release\') : null;',
    'const restoredReleaseFiles = restoredReleaseDir && fs.existsSync(restoredReleaseDir) ? fs.readdirSync(restoredReleaseDir).sort() : [];',
    'const restoredManifestFiles = restoredReleaseFiles.filter((file) => file.startsWith(\'latest\') && file.endsWith(\'.yml\'));',
    'const restoredInstallerFiles = restoredReleaseFiles.filter((file) => !restoredManifestFiles.includes(file));',
    '',
    'if (requireReleaseOutput) {',
    '  addCheck(\'recovered-manifests\', restoredManifestFiles.length > 0, restoredManifestFiles.length > 0 ? restoredManifestFiles.join(\', \') : \'no recovered manifests\');',
    '  addCheck(\'recovered-installers\', restoredInstallerFiles.length > 0, restoredInstallerFiles.length > 0 ? restoredInstallerFiles.join(\', \') : \'no recovered installers\');',
    '} else {',
    '  addCheck(\'recovered-release-optional\', true, restoredReleaseFiles.length > 0 ? `recovered release files: ${restoredReleaseFiles.length}` : \'release output not required\');',
    '}',
    '',
    'const capturedAt = new Date().toISOString();',
    'const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9._-]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'manual\';',
    'const timestamp = capturedAt.replace(/[-:]/g, \'\').replace(/\\.\\d+Z$/, \'Z\');',
    'const recoveryDir = path.join(outputRoot, `${timestamp}-${safeLabel}`);',
    'const proofDir = path.join(recoveryDir, \'proof\');',
    'fs.mkdirSync(proofDir, { recursive: true });',
    '',
    'const copyIfExists = (source, destination) => {',
    '  if (!source || !fs.existsSync(source)) return false;',
    '  fs.mkdirSync(path.dirname(destination), { recursive: true });',
    '  fs.copyFileSync(source, destination);',
    '  return true;',
    '};',
    '',
    'const copied = { restore: [], gate: [], export: [], restoredPayload: [] };',
    'if (restoreSurface) {',
    '  if (copyIfExists(path.join(restoreSurface.absoluteDir, \'ops-restore.json\'), path.join(proofDir, \'restore\', \'ops-restore.json\'))) copied.restore.push(path.join(\'proof\', \'restore\', \'ops-restore.json\'));',
    '  if (copyIfExists(path.join(restoreSurface.absoluteDir, \'ops-restore.md\'), path.join(proofDir, \'restore\', \'ops-restore.md\'))) copied.restore.push(path.join(\'proof\', \'restore\', \'ops-restore.md\'));',
    '}',
    'if (gateSurface) {',
    '  if (copyIfExists(path.join(gateSurface.absoluteDir, \'ops-gate.json\'), path.join(proofDir, \'gate\', \'ops-gate.json\'))) copied.gate.push(path.join(\'proof\', \'gate\', \'ops-gate.json\'));',
    '  if (copyIfExists(path.join(gateSurface.absoluteDir, \'ops-gate.md\'), path.join(proofDir, \'gate\', \'ops-gate.md\'))) copied.gate.push(path.join(\'proof\', \'gate\', \'ops-gate.md\'));',
    '}',
    'if (exportSurface) {',
    '  if (copyIfExists(path.join(exportSurface.absoluteDir, \'ops-export.json\'), path.join(proofDir, \'export\', \'ops-export.json\'))) copied.export.push(path.join(\'proof\', \'export\', \'ops-export.json\'));',
    '  if (copyIfExists(path.join(exportSurface.absoluteDir, \'ops-export.md\'), path.join(proofDir, \'export\', \'ops-export.md\'))) copied.export.push(path.join(\'proof\', \'export\', \'ops-export.md\'));',
    '}',
    'if (restoredPayloadDir) {',
    '  for (const [name, source] of [',
    '    [\'releasepack\', path.join(restoredPayloadDir, \'releasepack\', \'ops-releasepack.json\')],',
    '    [\'gate\', path.join(restoredPayloadDir, \'gate\', \'ops-gate.json\')],',
    '    [\'handoff\', path.join(restoredPayloadDir, \'handoff\', \'ops-handoff.json\')],',
    '    [\'attestation\', path.join(restoredPayloadDir, \'attestation\', \'ops-attestation.json\')],',
    '    [\'ready\', path.join(restoredPayloadDir, \'ready\', \'ops-ready.json\')],',
    '    [\'index\', path.join(restoredPayloadDir, \'index\', \'ops-index.json\')],',
    '  ]) {',
    '    const destination = path.join(proofDir, \'restored-payload\', `${name}.json`);',
    '    if (copyIfExists(source, destination)) copied.restoredPayload.push(path.join(\'proof\', \'restored-payload\', `${name}.json`));',
    '  }',
    '}',
    '',
    'const ok = checks.every((check) => check.ok);',
    'const summary = {',
    '  capturedAt,',
    '  label,',
    '  ok,',
    '  package: { name: pkg.name, version: pkg.version },',
    '  recoveryDir: path.relative(rootDir, recoveryDir),',
    '  proofDir: path.relative(rootDir, proofDir),',
    '  requireReleaseOutput,',
    '  retention: { skipped: skipRetention, keep: Number(keep) },',
    '  latest: {',
    '    index: index ? { dir: index.relativeDir, modifiedAt: index.modifiedAt } : null,',
    '    gate: gateSurface ? { dir: gateSurface.relativeDir, modifiedAt: gateSurface.modifiedAt, ok: gateSurface.payload?.ok === true } : null,',
    '    export: exportSurface ? { dir: exportSurface.relativeDir, modifiedAt: exportSurface.modifiedAt, ok: exportSurface.payload?.ok === true } : null,',
    '    restore: restoreSurface ? { dir: restoreSurface.relativeDir, modifiedAt: restoreSurface.modifiedAt, ok: restoreSurface.payload?.ok === true } : null,',
    '  },',
    '  restored: {',
    '    payloadDir: restoredPayloadDir ? path.relative(rootDir, restoredPayloadDir) : null,',
    '    manifests: restoredManifestFiles,',
    '    installers: restoredInstallerFiles,',
    '  },',
    '  copied,',
    '  checks,',
    '};',
    '',
    'fs.writeFileSync(path.join(recoveryDir, \'ops-recover.json\'), JSON.stringify(summary, null, 2) + \'\\n\');',
    'const lines = [',
    '  \'# Operations Recover\',',
    '  \'\',',
    '  `- Captured At (UTC): ${summary.capturedAt}`,',
    '  `- Label: ${summary.label}`,',
    '  `- Package: ${summary.package.name}@${summary.package.version}`,',
    '  `- Verdict: ${summary.ok ? \'pass\' : \'fail\'}`,',
    '  `- Recovery Dir: ${summary.recoveryDir}`,',
    '  `- Proof Dir: ${summary.proofDir}`,',
    '  `- Restored Payload Dir: ${summary.restored.payloadDir ?? \'missing\'}`,',
    '  `- Release output required: ${summary.requireReleaseOutput ? \'yes\' : \'no\'}`,',
    '  `- Retention baseline skipped: ${summary.retention.skipped ? \'yes\' : \'no\'}`,',
    '  `- Retention keep count: ${summary.retention.keep}`,',
    '  \'\',',
    '  \'## Latest Surfaces\',',
    '  \'\',',
    '  `- Gate: ${summary.latest.gate?.dir ?? \'missing\'}`,',
    '  `- Export: ${summary.latest.export?.dir ?? \'missing\'}`,',
    '  `- Restore: ${summary.latest.restore?.dir ?? \'missing\'}`,',
    '  `- Index: ${summary.latest.index?.dir ?? \'missing\'}`,',
    '  \'\',',
    '  \'## Restored Release Inventory\',',
    '  \'\',',
    '  `- Restored manifests: ${summary.restored.manifests.length > 0 ? summary.restored.manifests.join(\', \') : \'none\'}`,',
    '  `- Restored installers: ${summary.restored.installers.length > 0 ? summary.restored.installers.join(\', \') : \'none\'}`,',
    '  \'\',',
    '  \'## Proof Copies\',',
    '  \'\',',
    '  `- Restore proof files: ${summary.copied.restore.length}`,',
    '  `- Gate proof files: ${summary.copied.gate.length}`,',
    '  `- Export proof files: ${summary.copied.export.length}`,',
    '  `- Restored payload proof files: ${summary.copied.restoredPayload.length}`,',
    '  \'\',',
    '  \'## Checks\',',
    '  \'\',',
    '  ...summary.checks.map((check) => `- [${check.ok ? \'x\' : \' \'}] ${check.id}: ${check.detail}`),',
    '  \'\',',
    '  \'## Operator Next Steps\',',
    '  \'\',',
    '  \'- Use this recovery directory as the final operator-facing proof that the latest restore record can drive a coherent recovery handoff.\',',
    '  \'- Re-run `pnpm ops:recover -- --label <name> --require-release-output` after any release-pack, export, or restore surface change.\',',
    '  \'- Attach `ops-recover.json` and `ops-recover.md` when release approval requires a recovery-specific go or no-go record.\',',
    '  \'\',',
    '];',
    'fs.writeFileSync(path.join(recoveryDir, \'ops-recover.md\'), lines.join(\'\\n\') + \'\\n\');',
    'console.log(`Operations recover written to: ${recoveryDir}`);',
    'if (!ok) process.exit(1);',
    'NODE',
    '',
    'pnpm ops:index -- --label "$LABEL"',
    '',
  ].join('\n');
}

function getOpsRetentionScript(): string {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$SCRIPT_DIR/.."',
    '',
    'cd "$ROOT_DIR"',
    '',
    'KEEP="${OPS_RETENTION_KEEP:-10}"',
    '',
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --keep)',
    '      shift',
    '      if [ "$#" -eq 0 ]; then',
    '        echo "Missing value for --keep"',
    '        exit 1',
    '      fi',
    '      KEEP="$1"',
    '      ;;',
    '    --)',
    '      ;;',
    '    *)',
    '      echo "Unsupported ops retention argument: $1"',
    '      echo "Use --keep <count>."',
    '      exit 1',
    '      ;;',
    '  esac',
    '  shift',
    'done',
    '',
    'case "$KEEP" in',
    '  ""|*[!0-9]*)',
    '    echo "Retention keep value must be a non-negative integer. Got: $KEEP"',
    '    exit 1',
    '    ;;',
    'esac',
    '',
    'prune_root() {',
    '  local root_dir="$1"',
    '  local keep_count="$2"',
    '  local label="$3"',
    '',
    '  mkdir -p "$root_dir"',
    '',
    '  local entries=()',
    '  while IFS= read -r entry; do',
    '    entries+=("$entry")',
    '  done < <(find "$root_dir" -mindepth 1 -maxdepth 1 -type d -print | sort -r)',
    '  local total="${#entries[@]}"',
    '',
    '  if [ "$total" -le "$keep_count" ]; then',
    '    echo "Retention OK for ${label}: keeping ${total}/${keep_count} directories."',
    '    return 0',
    '  fi',
    '',
    '  local removed=0',
    '  for ((index=keep_count; index<total; index++)); do',
    '    rm -rf "${entries[$index]}"',
    '    removed=$((removed + 1))',
    '  done',
    '',
    '  echo "Pruned ${removed} ${label} director$( [ "$removed" -eq 1 ] && echo "y" || echo "ies" ); kept ${keep_count}."',
    '}',
    '',
    'prune_root "${OPS_SNAPSHOT_DIR:-ops/snapshots}" "$KEEP" "ops snapshot"',
    'prune_root "${OPS_EVIDENCE_DIR:-ops/evidence}" "$KEEP" "ops evidence"',
    'prune_root "${OPS_REPORT_DIR:-ops/reports}" "$KEEP" "ops report"',
    'prune_root "${OPS_BUNDLE_DIR:-ops/bundles}" "$KEEP" "ops bundle"',
    'prune_root "${OPS_INDEX_DIR:-ops/index}" "$KEEP" "ops index"',
    'prune_root "${OPS_DOCTOR_DIR:-ops/doctors}" "$KEEP" "ops doctor"',
    'prune_root "${OPS_HANDOFF_DIR:-ops/handoffs}" "$KEEP" "ops handoff"',
    'prune_root "${OPS_ATTESTATION_DIR:-ops/attestations}" "$KEEP" "ops attestation"',
    'prune_root "${OPS_READY_DIR:-ops/ready}" "$KEEP" "ops ready"',
    'prune_root "${OPS_GATE_DIR:-ops/gates}" "$KEEP" "ops gate"',
    'prune_root "${OPS_RELEASEPACK_DIR:-ops/releasepacks}" "$KEEP" "ops release pack"',
    'prune_root "${OPS_EXPORT_DIR:-ops/exports}" "$KEEP" "ops export"',
    'prune_root "${OPS_RESTORE_DIR:-ops/restores}" "$KEEP" "ops restore"',
    'prune_root "${OPS_RECOVER_DIR:-ops/recoveries}" "$KEEP" "ops recover"',
    '',
    'echo "Operations retention checks passed (keep=${KEEP})."',
    '',
  ].join('\n');
}

function getGitignoreContents(): string {
  return [
    'node_modules',
    'dist',
    'dist-electron',
    'release',
    'ops/snapshots',
    'ops/evidence',
    'ops/reports',
    'ops/bundles',
    'ops/index',
    'ops/doctors',
    'ops/handoffs',
    'ops/attestations',
    'ops/ready',
    'ops/gates',
    'ops/releasepacks',
    'ops/exports',
    'ops/restores',
    'ops/recoveries',
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
  const useGlobalShortcut = features.includes('global-shortcut');
  const useFileAssociation = features.includes('file-association');
  const useFileDialogs = features.includes('file-dialogs');
  const useRecentFiles = features.includes('recent-files');
  const useCrashRecovery = features.includes('crash-recovery');
  const usePowerMonitor = features.includes('power-monitor');
  const useIdlePresence = features.includes('idle-presence');
  const useSessionState = features.includes('session-state');
  const useDownloads = features.includes('downloads');
  const useClipboard = features.includes('clipboard');
  const useExternalLinks = features.includes('external-links');
  const useSystemInfo = features.includes('system-info');
  const usePermissions = features.includes('permissions');
  const useNetworkStatus = features.includes('network-status');
  const useSecureStorage = features.includes('secure-storage');
  const useSupportBundle = features.includes('support-bundle');
  const useLogArchive = features.includes('log-archive');
  const useIncidentReport = features.includes('incident-report');
  const useDiagnosticsTimeline = features.includes('diagnostics-timeline');
  const productName = resolveProductName(projectName, metadata);
  const appId = resolveAppId(projectName, metadata);
  const supportFolder = `${toIdentifier(projectName)}-support`;
  const protocolScheme = `${toIdentifier(projectName)}`;
  const fileAssociationExtension = `${toIdentifier(projectName)}doc`;
  const dialogFileName = `${toIdentifier(projectName)}-document.txt`;
  const fsPromiseImports = Array.from(new Set([
    'mkdir',
    'readdir',
    'rm',
    'stat',
    ...(useDiagnostics || useWindowing || useRecentFiles || useCrashRecovery || useSecureStorage ? ['readFile'] : []),
    'writeFile',
    ...(useLogArchive ? ['copyFile'] : []),
  ]));

  return `import { app, BrowserWindow, ipcMain${useNotifications ? ', Notification' : ''}${useTray || useMenuBar ? ', Menu' : ''}${useTray ? ', Tray, nativeImage' : ''}${useMenuBar ? ', type MenuItemConstructorOptions' : ''}${useGlobalShortcut ? ', globalShortcut' : ''}${usePowerMonitor || useIdlePresence ? ', powerMonitor' : ''}${useDownloads ? ', session' : ''}${useClipboard ? ', clipboard' : ''}${usePermissions ? ', systemPreferences' : ''}${useNetworkStatus ? ', net' : ''}${useSecureStorage ? ', safeStorage' : ''}, shell${useFileDialogs ? ', dialog, type OpenDialogOptions' : ''} } from 'electron';
import path from 'node:path';
${useSystemInfo ? "import os from 'node:os';\n" : ''}
import { ${fsPromiseImports.join(', ')} } from 'node:fs/promises';
import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';
${useSettings ? "import { createSettingsManager } from '@forge/settings-core';\n" : ''}${useJobs ? "import { createJobEngine } from '@forge/job-engine';\n" : ''}${useUpdater ? "import { createUpdater } from '@forge/updater';\n" : ''}
const runtimePaths = {
  logs: path.join(app.getPath('userData'), 'logs'),
  crashDumps: path.join(app.getPath('userData'), 'crashDumps'),
};

app.setAppLogsPath(runtimePaths.logs);
app.setPath('crashDumps', runtimePaths.crashDumps);

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

const runtimeRetentionPolicy = {
  logs: {
    maxAgeDays: 14,
    maxEntries: 40,
  },
  crashDumps: {
    maxAgeDays: 7,
    maxEntries: 20,
  },
};

async function ensureRuntimeDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true });
}

async function pruneRuntimeDirectory(
  label: keyof typeof runtimeRetentionPolicy,
  directoryPath: string,
  policy: (typeof runtimeRetentionPolicy)[keyof typeof runtimeRetentionPolicy],
) {
  const cutoff = Date.now() - policy.maxAgeDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: Array<{ path: string; modifiedAt: number }> = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);
    const details = await stat(entryPath);
    files.push({
      path: entryPath,
      modifiedAt: details.mtimeMs,
    });
  }

  files.sort((left, right) => right.modifiedAt - left.modifiedAt);
  const removed: string[] = [];

  for (const [index, file] of files.entries()) {
    const expired = file.modifiedAt < cutoff;
    const overflow = index >= policy.maxEntries;
    if (!expired && !overflow) {
      continue;
    }

    await rm(file.path, { force: true });
    removed.push(path.basename(file.path));
  }

  return {
    label,
    retained: Math.max(files.length - removed.length, 0),
    removed,
  };
}

async function enforceRuntimeHygiene() {
  await ensureRuntimeDirectory(runtimePaths.logs);
  await ensureRuntimeDirectory(runtimePaths.crashDumps);

  const logs = await pruneRuntimeDirectory('logs', runtimePaths.logs, runtimeRetentionPolicy.logs);
  const crashDumps = await pruneRuntimeDirectory('crashDumps', runtimePaths.crashDumps, runtimeRetentionPolicy.crashDumps);

  logger.info('Runtime hygiene completed', {
    logsPath: runtimePaths.logs,
    crashDumpsPath: runtimePaths.crashDumps,
    logsRetained: logs.retained,
    logsRemoved: logs.removed,
    crashDumpsRetained: crashDumps.retained,
    crashDumpsRemoved: crashDumps.removed,
  });
}

const enabledFeatures = ${JSON.stringify(features)};
${useSettings ? "const settingsManager = createSettingsManager(path.join(app.getPath('userData'), 'settings.json'));\n" : ''}${useJobs ? 'const jobEngine = createJobEngine(workerClient);\n' : ''}${useUpdater ? "const updater = createUpdater({ autoDownload: false, autoInstallOnAppQuit: true });\n" : ''}function isTrustedRendererUrl(targetUrl: string) {
  if (!targetUrl) {
    return false;
  }

  if (!isDev) {
    return targetUrl.startsWith('file://');
  }

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (!devServerUrl) {
    return false;
  }

  try {
    return new URL(targetUrl).origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}

function maybeOpenExternalUrl(targetUrl: string) {
  try {
    const parsed = new URL(targetUrl);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      void shell.openExternal(targetUrl);
    }
  } catch {
    // Ignore malformed URLs; they stay blocked inside the Electron shell.
  }
}

${useWindowing ? `
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
` : ''}${useLogArchive ? `
type LogArchiveFileEntry = {
  name: string;
  sourcePath: string;
  sizeBytes: number;
  modifiedAt: string;
};

type LogArchiveState = {
  logsPath: string;
  archiveDirectoryPath: string;
  fileCount: number;
  totalBytes: number;
  files: LogArchiveFileEntry[];
  lastArchivePath: string | null;
  lastArchivedAt: string | null;
  archiveCount: number;
  lastError: string | null;
};

const logArchiveState: LogArchiveState = {
  logsPath: app.getPath('logs'),
  archiveDirectoryPath: path.join(app.getPath('downloads'), ${JSON.stringify(supportFolder)}, 'log-archives'),
  fileCount: 0,
  totalBytes: 0,
  files: [],
  lastArchivePath: null,
  lastArchivedAt: null,
  archiveCount: 0,
  lastError: null,
};

async function listLogArchiveFiles() {
  try {
    const entries = await readdir(logArchiveState.logsPath, { withFileTypes: true });
    const files = (
      await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
        const sourcePath = path.join(logArchiveState.logsPath, entry.name);
        const details = await stat(sourcePath);
        return {
          name: entry.name,
          sourcePath,
          sizeBytes: details.size,
          modifiedAt: details.mtime.toISOString(),
        } satisfies LogArchiveFileEntry;
      }))
    ).sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));

    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return [] as LogArchiveFileEntry[];
    }
    throw error;
  }
}

async function getLogArchiveState() {
  try {
    const files = await listLogArchiveFiles();
    logArchiveState.files = files;
    logArchiveState.fileCount = files.length;
    logArchiveState.totalBytes = files.reduce((total, entry) => total + entry.sizeBytes, 0);
    logArchiveState.lastError = null;
  } catch (error) {
    logArchiveState.lastError = error instanceof Error ? error.message : 'Unknown log archive inspection error';
  }

  return {
    logsPath: logArchiveState.logsPath,
    archiveDirectoryPath: logArchiveState.archiveDirectoryPath,
    fileCount: logArchiveState.fileCount,
    totalBytes: logArchiveState.totalBytes,
    files: [...logArchiveState.files],
    lastArchivePath: logArchiveState.lastArchivePath,
    lastArchivedAt: logArchiveState.lastArchivedAt,
    archiveCount: logArchiveState.archiveCount,
    lastError: logArchiveState.lastError,
  };
}

function createLogArchiveFolderName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return \`${toIdentifier(projectName)}-logs-\${stamp}\`;
}

async function exportLogArchive() {
  try {
    const files = await listLogArchiveFiles();
    await mkdir(logArchiveState.archiveDirectoryPath, { recursive: true });
    const archivePath = path.join(logArchiveState.archiveDirectoryPath, createLogArchiveFolderName());
    await mkdir(archivePath, { recursive: true });

    for (const entry of files) {
      await copyFile(entry.sourcePath, path.join(archivePath, entry.name));
    }

    const generatedAt = new Date().toISOString();
    const manifest = {
      generatedAt,
      sourceLogsPath: logArchiveState.logsPath,
      fileCount: files.length,
      totalBytes: files.reduce((total, entry) => total + entry.sizeBytes, 0),
      files,
    };

    await writeFile(path.join(archivePath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    logArchiveState.lastArchivePath = archivePath;
    logArchiveState.lastArchivedAt = generatedAt;
    logArchiveState.archiveCount += 1;
    logArchiveState.lastError = null;
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('support', 'log-archive-exported', archivePath);\n" : ''}    return getLogArchiveState();
  } catch (error) {
    logArchiveState.lastError = error instanceof Error ? error.message : 'Unknown log archive export error';
    throw error;
  }
}

async function revealLogArchive() {
  const targetPath = logArchiveState.lastArchivePath ?? logArchiveState.logsPath;
  try {
    shell.showItemInFolder(targetPath);
    logArchiveState.lastError = null;
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('support', 'log-archive-revealed', targetPath);\n" : ''}  } catch (error) {
    logArchiveState.lastError = error instanceof Error ? error.message : 'Unknown log archive reveal error';
  }
  return getLogArchiveState();
}
` : ''}${useIncidentReport ? `
type IncidentReportSeverity = 'low' | 'medium' | 'high' | 'critical';

type IncidentReportDraft = {
  title: string;
  severity: IncidentReportSeverity;
  affectedArea: string;
  summary: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  recommendedAction: string;
  notes: string;
};

type IncidentReportState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  exportCount: number;
  lastError: string | null;
  currentDraft: IncidentReportDraft;
};

const defaultIncidentReportDraft: IncidentReportDraft = {
  title: ${JSON.stringify(`${productName} desktop issue`)},
  severity: 'medium',
  affectedArea: 'desktop-shell',
  summary: 'Customer-facing issue observed in the packaged desktop flow.',
  stepsToReproduce: '1. Launch the app\\n2. Navigate to the affected workflow\\n3. Capture the incorrect behavior',
  expectedBehavior: 'The workflow should complete without a shell or runtime issue.',
  actualBehavior: 'The desktop shell or runtime produced an unexpected result.',
  recommendedAction: 'Attach support bundle and logs, then triage with product and QA owners.',
  notes: '',
};

const incidentReportState: IncidentReportState = {
  directoryPath: path.join(app.getPath('downloads'), ${JSON.stringify(supportFolder)}, 'incident-reports'),
  lastExportPath: null,
  lastGeneratedAt: null,
  exportCount: 0,
  lastError: null,
  currentDraft: { ...defaultIncidentReportDraft },
};

function getIncidentReportState() {
  return {
    directoryPath: incidentReportState.directoryPath,
    lastExportPath: incidentReportState.lastExportPath,
    lastGeneratedAt: incidentReportState.lastGeneratedAt,
    exportCount: incidentReportState.exportCount,
    lastError: incidentReportState.lastError,
    currentDraft: { ...incidentReportState.currentDraft },
  };
}

function sanitizeIncidentReportDraft(
  draft: Partial<IncidentReportDraft> | undefined,
): IncidentReportDraft {
  return {
    title: draft?.title?.trim() || defaultIncidentReportDraft.title,
    severity: draft?.severity && ['low', 'medium', 'high', 'critical'].includes(draft.severity)
      ? draft.severity
      : defaultIncidentReportDraft.severity,
    affectedArea: draft?.affectedArea?.trim() || defaultIncidentReportDraft.affectedArea,
    summary: draft?.summary?.trim() || defaultIncidentReportDraft.summary,
    stepsToReproduce: draft?.stepsToReproduce?.trim() || defaultIncidentReportDraft.stepsToReproduce,
    expectedBehavior: draft?.expectedBehavior?.trim() || defaultIncidentReportDraft.expectedBehavior,
    actualBehavior: draft?.actualBehavior?.trim() || defaultIncidentReportDraft.actualBehavior,
    recommendedAction: draft?.recommendedAction?.trim() || defaultIncidentReportDraft.recommendedAction,
    notes: draft?.notes?.trim() || '',
  };
}

function createIncidentReportFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return \`${toIdentifier(projectName)}-incident-report-\${stamp}.json\`;
}

async function exportIncidentReport(draft: Partial<IncidentReportDraft> | undefined) {
  try {
    await mkdir(incidentReportState.directoryPath, { recursive: true });
    const resolvedDraft = sanitizeIncidentReportDraft(draft);
    const generatedAt = new Date().toISOString();
    incidentReportState.currentDraft = { ...resolvedDraft };

    const payload = {
      generatedAt,
      runtime: {
        productName: ${JSON.stringify(productName)},
        appId: ${JSON.stringify(appId)},
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        logsPath: app.getPath('logs'),
        downloadsPath: app.getPath('downloads'),
        userDataPath: app.getPath('userData'),
      },
      report: resolvedDraft,
      artifacts: {
${useSupportBundle ? '        supportBundle: getSupportBundleState(),\n' : ''}${useLogArchive ? '        logArchive: await getLogArchiveState(),\n' : ''}${useCrashRecovery ? '        crashRecovery: getCrashRecoveryState(),\n' : ''}${useSessionState ? '        sessionState: getSessionStateSnapshot(),\n' : ''}${useNetworkStatus ? '        networkStatus: snapshotNetworkStatus(),\n' : ''}${useDiagnosticsTimeline ? '        diagnosticsTimeline: getDiagnosticsTimelineState(),\n' : ''}      },
    };

    const filePath = path.join(incidentReportState.directoryPath, createIncidentReportFileName());
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    incidentReportState.lastExportPath = filePath;
    incidentReportState.lastGeneratedAt = generatedAt;
    incidentReportState.exportCount += 1;
    incidentReportState.lastError = null;
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('support', 'incident-report-exported', filePath);\n" : ''}    return getIncidentReportState();
  } catch (error) {
    incidentReportState.lastError = error instanceof Error ? error.message : 'Unknown incident report export error';
    throw error;
  }
}

async function revealIncidentReport() {
  const targetPath = incidentReportState.lastExportPath ?? incidentReportState.directoryPath;
  try {
    shell.showItemInFolder(targetPath);
    incidentReportState.lastError = null;
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('support', 'incident-report-revealed', targetPath);\n" : ''}  } catch (error) {
    incidentReportState.lastError = error instanceof Error ? error.message : 'Unknown incident report reveal error';
  }
  return getIncidentReportState();
}
` : ''}${useDiagnosticsTimeline ? `
type DiagnosticsTimelineCategory = 'app' | 'window' | 'support';

type DiagnosticsTimelineEntry = {
  id: string;
  category: DiagnosticsTimelineCategory;
  event: string;
  detail: string | null;
  timestamp: string;
};

type DiagnosticsTimelineState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastExportedAt: string | null;
  eventCount: number;
  lastEventAt: string | null;
  lastError: string | null;
  entries: DiagnosticsTimelineEntry[];
};

const diagnosticsTimelineLimit = 60;
const diagnosticsTimelineState: DiagnosticsTimelineState = {
  directoryPath: path.join(app.getPath('downloads'), ${JSON.stringify(supportFolder)}, 'diagnostics-timeline'),
  lastExportPath: null,
  lastExportedAt: null,
  eventCount: 0,
  lastEventAt: null,
  lastError: null,
  entries: [],
};

function getDiagnosticsTimelineState() {
  return {
    directoryPath: diagnosticsTimelineState.directoryPath,
    lastExportPath: diagnosticsTimelineState.lastExportPath,
    lastExportedAt: diagnosticsTimelineState.lastExportedAt,
    eventCount: diagnosticsTimelineState.eventCount,
    lastEventAt: diagnosticsTimelineState.lastEventAt,
    lastError: diagnosticsTimelineState.lastError,
    entries: diagnosticsTimelineState.entries.map((entry) => ({ ...entry })),
  };
}

function pushDiagnosticsTimelineEvent(
  category: DiagnosticsTimelineCategory,
  event: string,
  detail?: string | null,
) {
  const timestamp = new Date().toISOString();
  diagnosticsTimelineState.lastEventAt = timestamp;
  diagnosticsTimelineState.eventCount += 1;
  diagnosticsTimelineState.entries = [
    {
      id: \`\${timestamp}-\${Math.random().toString(36).slice(2, 8)}\`,
      category,
      event,
      detail: detail ?? null,
      timestamp,
    },
    ...diagnosticsTimelineState.entries,
  ].slice(0, diagnosticsTimelineLimit);
  return getDiagnosticsTimelineState();
}

function clearDiagnosticsTimelineHistory() {
  diagnosticsTimelineState.eventCount = 0;
  diagnosticsTimelineState.lastEventAt = null;
  diagnosticsTimelineState.lastError = null;
  diagnosticsTimelineState.entries = [];
  return getDiagnosticsTimelineState();
}

function createDiagnosticsTimelineFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return \`${toIdentifier(projectName)}-diagnostics-timeline-\${stamp}.json\`;
}

async function exportDiagnosticsTimeline() {
  try {
    const snapshot = pushDiagnosticsTimelineEvent('support', 'timeline-exported', diagnosticsTimelineState.lastExportPath);
    await mkdir(diagnosticsTimelineState.directoryPath, { recursive: true });
    const generatedAt = new Date().toISOString();
    const payload = {
      generatedAt,
      runtime: {
        productName: ${JSON.stringify(productName)},
        appId: ${JSON.stringify(appId)},
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        userDataPath: app.getPath('userData'),
        logsPath: app.getPath('logs'),
        downloadsPath: app.getPath('downloads'),
      },
      timeline: snapshot,
    };
    const filePath = path.join(diagnosticsTimelineState.directoryPath, createDiagnosticsTimelineFileName());
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    diagnosticsTimelineState.lastExportPath = filePath;
    diagnosticsTimelineState.lastExportedAt = generatedAt;
    diagnosticsTimelineState.lastError = null;
    return getDiagnosticsTimelineState();
  } catch (error) {
    diagnosticsTimelineState.lastError = error instanceof Error ? error.message : 'Unknown diagnostics timeline export error';
    throw error;
  }
}

async function revealDiagnosticsTimeline() {
  const targetPath = diagnosticsTimelineState.lastExportPath ?? diagnosticsTimelineState.directoryPath;
  try {
    shell.showItemInFolder(targetPath);
    diagnosticsTimelineState.lastError = null;
  } catch (error) {
    diagnosticsTimelineState.lastError = error instanceof Error ? error.message : 'Unknown diagnostics timeline reveal error';
  }
  return getDiagnosticsTimelineState();
}
` : ''}${useSupportBundle ? `
type SupportBundleState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  lastSizeBytes: number | null;
  exportCount: number;
  includedSections: string[];
  lastError: string | null;
};

const supportBundleState: SupportBundleState = {
  directoryPath: path.join(app.getPath('downloads'), ${JSON.stringify(supportFolder)}),
  lastExportPath: null,
  lastGeneratedAt: null,
  lastSizeBytes: null,
  exportCount: 0,
  includedSections: [],
  lastError: null,
};

function getSupportBundleState() {
  return {
    directoryPath: supportBundleState.directoryPath,
    lastExportPath: supportBundleState.lastExportPath,
    lastGeneratedAt: supportBundleState.lastGeneratedAt,
    lastSizeBytes: supportBundleState.lastSizeBytes,
    exportCount: supportBundleState.exportCount,
    includedSections: [...supportBundleState.includedSections],
    lastError: supportBundleState.lastError,
  };
}

function createSupportBundleFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return \`${toIdentifier(projectName)}-support-bundle-\${stamp}.json\`;
}

async function exportSupportBundle() {
  try {
    await mkdir(supportBundleState.directoryPath, { recursive: true });
    const generatedAt = new Date().toISOString();
    const includedSections = [
    'runtime',
${useDiagnostics ? "    'diagnostics',\n" : ''}${useSystemInfo ? "    'systemInfo',\n" : ''}${usePermissions ? "    'permissions',\n" : ''}${useNetworkStatus ? "    'networkStatus',\n" : ''}${useSecureStorage ? "    'secureStorage',\n" : ''}${useLogArchive ? "    'logArchive',\n" : ''}${useDiagnosticsTimeline ? "    'diagnosticsTimeline',\n" : ''}${useWindowing ? "    'windowing',\n" : ''}${useTray ? "    'tray',\n" : ''}${useDeepLink ? "    'deepLink',\n" : ''}${useMenuBar ? "    'menuBar',\n" : ''}${useAutoLaunch ? "    'autoLaunch',\n" : ''}${useGlobalShortcut ? "    'globalShortcut',\n" : ''}${useFileAssociation ? "    'fileAssociation',\n" : ''}${useFileDialogs ? "    'fileDialogs',\n" : ''}${useRecentFiles ? "    'recentFiles',\n" : ''}${useCrashRecovery ? "    'crashRecovery',\n" : ''}${usePowerMonitor ? "    'powerMonitor',\n" : ''}${useIdlePresence ? "    'idlePresence',\n" : ''}${useSessionState ? "    'sessionState',\n" : ''}${useDownloads ? "    'downloads',\n" : ''}${useClipboard ? "    'clipboard',\n" : ''}${useExternalLinks ? "    'externalLinks',\n" : ''}  ] as const;

    const payload = {
      generatedAt,
      runtime: {
        productName: ${JSON.stringify(productName)},
        appId: ${JSON.stringify(appId)},
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        appPath: app.getAppPath(),
        userDataPath: app.getPath('userData'),
        logsPath: app.getPath('logs'),
        downloadsPath: app.getPath('downloads'),
        workerPath: resourceManager.getWorkerPath(),
        pythonPath: resourceManager.getPythonPath(),
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome,
        electronVersion: process.versions.electron,
        enabledFeatures,
      },
${useDiagnostics ? '    diagnostics: await getDiagnosticsSummary(),\n' : ''}${useSystemInfo ? '    systemInfo: await getSystemInfoState(),\n' : ''}${usePermissions ? '    permissions: getPermissionsState(),\n' : ''}${useNetworkStatus ? '    networkStatus: snapshotNetworkStatus(),\n' : ''}${useSecureStorage ? '    secureStorage: getSecureStorageState(),\n' : ''}${useLogArchive ? '    logArchive: await getLogArchiveState(),\n' : ''}${useDiagnosticsTimeline ? '    diagnosticsTimeline: getDiagnosticsTimelineState(),\n' : ''}${useWindowing ? '    windowing: getCurrentWindowState(),\n' : ''}${useTray ? '    tray: getTrayStatus(),\n' : ''}${useDeepLink ? '    deepLink: getDeepLinkState(),\n' : ''}${useMenuBar ? '    menuBar: getMenuState(),\n' : ''}${useAutoLaunch ? '    autoLaunch: getAutoLaunchState(),\n' : ''}${useGlobalShortcut ? '    globalShortcut: getGlobalShortcutState(),\n' : ''}${useFileAssociation ? '    fileAssociation: getFileAssociationState(),\n' : ''}${useFileDialogs ? '    fileDialogs: getFileDialogState(),\n' : ''}${useRecentFiles ? '    recentFiles: getRecentFilesState(),\n' : ''}${useCrashRecovery ? '    crashRecovery: getCrashRecoveryState(),\n' : ''}${usePowerMonitor ? '    powerMonitor: getPowerMonitorState(),\n' : ''}${useIdlePresence ? '    idlePresence: snapshotIdlePresence(),\n' : ''}${useSessionState ? '    sessionState: getSessionStateSnapshot(),\n' : ''}${useDownloads ? '    downloads: getDownloadsState(),\n' : ''}${useClipboard ? '    clipboard: getClipboardState(),\n' : ''}${useExternalLinks ? '    externalLinks: getExternalLinksState(),\n' : ''}  };

    const filePath = path.join(supportBundleState.directoryPath, createSupportBundleFileName());
    const body = JSON.stringify(payload, null, 2);
    await writeFile(filePath, body, 'utf-8');
    supportBundleState.lastExportPath = filePath;
    supportBundleState.lastGeneratedAt = generatedAt;
    supportBundleState.lastSizeBytes = Buffer.byteLength(body, 'utf-8');
    supportBundleState.exportCount += 1;
    supportBundleState.includedSections = [...includedSections];
    supportBundleState.lastError = null;
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('support', 'support-bundle-exported', filePath);\n" : ''}    return getSupportBundleState();
  } catch (error) {
    supportBundleState.lastError = error instanceof Error ? error.message : 'Unknown support bundle export error';
    throw error;
  }
}

async function revealSupportBundle() {
  const targetPath = supportBundleState.lastExportPath ?? supportBundleState.directoryPath;
  try {
    shell.showItemInFolder(targetPath);
    supportBundleState.lastError = null;
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('support', 'support-bundle-revealed', targetPath);\n" : ''}  } catch (error) {
    supportBundleState.lastError = error instanceof Error ? error.message : 'Unknown support bundle reveal error';
  }
  return getSupportBundleState();
}
` : ''}${useSystemInfo ? `
function toMegabytes(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

async function getSystemInfoState() {
  const cpus = os.cpus();
  const memoryUsage = process.memoryUsage();

  return {
    refreshedAt: new Date().toISOString(),
    runtime: {
      appName: app.getName(),
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    },
    os: {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      release: os.release(),
      uptimeMinutes: Math.round(os.uptime() / 60),
      cpuModel: cpus[0]?.model ?? 'unknown',
      cpuCores: cpus.length,
      loadAverage: os.loadavg().map((value) => Math.round(value * 100) / 100),
      totalMemoryMb: toMegabytes(os.totalmem()),
      freeMemoryMb: toMegabytes(os.freemem()),
    },
    process: {
      pid: process.pid,
      processCount: app.getAppMetrics().length,
      rssMb: toMegabytes(memoryUsage.rss),
      heapUsedMb: toMegabytes(memoryUsage.heapUsed),
      heapTotalMb: toMegabytes(memoryUsage.heapTotal),
    },
    paths: {
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      tempPath: app.getPath('temp'),
      downloadsPath: app.getPath('downloads'),
      logsPath: app.getPath('logs'),
    },
  };
}
` : ''}${usePermissions ? `
type PermissionKind = 'camera' | 'microphone' | 'screen';
type RequestablePermissionKind = 'camera' | 'microphone';

type PermissionEntry = {
  status: string;
  supported: boolean;
  canRequest: boolean;
};

type PermissionsState = {
  platform: string;
  camera: PermissionEntry;
  microphone: PermissionEntry;
  screen: PermissionEntry;
  lastRequest: {
    kind: RequestablePermissionKind | null;
    granted: boolean | null;
    timestamp: string | null;
    error: string | null;
  };
};

const permissionsState: PermissionsState = {
  platform: process.platform,
  camera: { status: 'unknown', supported: false, canRequest: false },
  microphone: { status: 'unknown', supported: false, canRequest: false },
  screen: { status: 'unknown', supported: false, canRequest: false },
  lastRequest: {
    kind: null,
    granted: null,
    timestamp: null,
    error: null,
  },
};

function resolvePermissionEntry(kind: PermissionKind): PermissionEntry {
  try {
    const status = systemPreferences.getMediaAccessStatus(kind);
    return {
      status,
      supported: true,
      canRequest: process.platform === 'darwin' && kind !== 'screen',
    };
  } catch {
    return {
      status: 'unsupported',
      supported: false,
      canRequest: false,
    };
  }
}

function getPermissionsState() {
  permissionsState.camera = resolvePermissionEntry('camera');
  permissionsState.microphone = resolvePermissionEntry('microphone');
  permissionsState.screen = resolvePermissionEntry('screen');
  return {
    platform: permissionsState.platform,
    camera: { ...permissionsState.camera },
    microphone: { ...permissionsState.microphone },
    screen: { ...permissionsState.screen },
    lastRequest: { ...permissionsState.lastRequest },
  };
}

async function requestPermission(kind: RequestablePermissionKind) {
  const timestamp = new Date().toISOString();

  if (process.platform !== 'darwin') {
    permissionsState.lastRequest = {
      kind,
      granted: null,
      timestamp,
      error: 'Interactive permission requests are only supported in the starter on macOS.',
    };
    return getPermissionsState();
  }

  try {
    const granted = await systemPreferences.askForMediaAccess(kind);
    permissionsState.lastRequest = {
      kind,
      granted,
      timestamp,
      error: null,
    };
  } catch (error) {
    permissionsState.lastRequest = {
      kind,
      granted: null,
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown permission request failure',
    };
  }

  return getPermissionsState();
}
` : ''}${useNetworkStatus ? `
type NetworkStatusState = {
  supported: boolean;
  online: boolean;
  status: 'online' | 'offline';
  checkCount: number;
  lastCheckedAt: string | null;
  history: Array<{
    online: boolean;
    status: 'online' | 'offline';
    timestamp: string;
  }>;
};

const networkStatusHistoryLimit = 8;
const networkStatusState: NetworkStatusState = {
  supported: typeof net.isOnline === 'function',
  online: true,
  status: 'online',
  checkCount: 0,
  lastCheckedAt: null,
  history: [],
};

function snapshotNetworkStatus() {
  const online = typeof net.isOnline === 'function' ? net.isOnline() : true;
  const status: NetworkStatusState['status'] = online ? 'online' : 'offline';
  const timestamp = new Date().toISOString();
  networkStatusState.supported = typeof net.isOnline === 'function';
  networkStatusState.online = online;
  networkStatusState.status = status;
  networkStatusState.lastCheckedAt = timestamp;
  networkStatusState.checkCount += 1;
  const history: NetworkStatusState['history'] = [
    {
      online,
      status,
      timestamp,
    },
    ...networkStatusState.history,
  ].slice(0, networkStatusHistoryLimit);
  networkStatusState.history = history;
  return {
    supported: networkStatusState.supported,
    online: networkStatusState.online,
    status: networkStatusState.status,
    checkCount: networkStatusState.checkCount,
    lastCheckedAt: networkStatusState.lastCheckedAt,
    history: [...networkStatusState.history],
  };
}

function clearNetworkStatusHistory() {
  networkStatusState.checkCount = 0;
  networkStatusState.lastCheckedAt = null;
  networkStatusState.history = [];
  return snapshotNetworkStatus();
}
` : ''}${useSecureStorage ? `
type SecureStorageRecord = {
  label: string;
  encryptedValue: string;
  updatedAt: string;
};

type SecureStorageState = {
  supported: boolean;
  label: string | null;
  hasStoredValue: boolean;
  lastUpdatedAt: string | null;
  lastLoadedValue: string | null;
  lastError: string | null;
};

type SupportBundleState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  lastSizeBytes: number | null;
  exportCount: number;
  includedSections: string[];
  lastError: string | null;
};

const secureStoragePath = path.join(app.getPath('userData'), 'secure-storage.json');
let secureStorageRecord: SecureStorageRecord | null = null;
let lastLoadedSecureValue: string | null = null;
let lastSecureStorageError: string | null = null;

function isSecureStorageAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

async function loadSecureStorageRecord() {
  try {
    const raw = await readFile(secureStoragePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SecureStorageRecord> | null;
    secureStorageRecord = parsed
      && typeof parsed.label === 'string'
      && typeof parsed.encryptedValue === 'string'
      && typeof parsed.updatedAt === 'string'
      ? {
          label: parsed.label,
          encryptedValue: parsed.encryptedValue,
          updatedAt: parsed.updatedAt,
        }
      : null;
    lastSecureStorageError = null;
  } catch {
    secureStorageRecord = null;
    lastSecureStorageError = null;
  }
}

async function persistSecureStorageRecord() {
  await writeFile(secureStoragePath, JSON.stringify(secureStorageRecord, null, 2), 'utf-8');
}

function getSecureStorageState() {
  return {
    supported: isSecureStorageAvailable(),
    label: secureStorageRecord?.label ?? null,
    hasStoredValue: Boolean(secureStorageRecord),
    lastUpdatedAt: secureStorageRecord?.updatedAt ?? null,
    lastLoadedValue: lastLoadedSecureValue,
    lastError: lastSecureStorageError,
  };
}

async function saveSecureValue(label: string | null | undefined, value: string | null | undefined) {
  if (!isSecureStorageAvailable()) {
    lastSecureStorageError = 'safeStorage encryption is unavailable on this platform or desktop session.';
    return getSecureStorageState();
  }

  try {
    const nextLabel = label?.trim() || 'api-token';
    const nextValue = value ?? '';
    const encryptedValue = safeStorage.encryptString(nextValue).toString('base64');
    secureStorageRecord = {
      label: nextLabel,
      encryptedValue,
      updatedAt: new Date().toISOString(),
    };
    lastLoadedSecureValue = null;
    lastSecureStorageError = null;
    await persistSecureStorageRecord();
  } catch (error) {
    lastSecureStorageError = error instanceof Error ? error.message : 'Unknown secure-storage save failure';
  }

  return getSecureStorageState();
}

async function loadSecureValue() {
  if (!secureStorageRecord) {
    lastLoadedSecureValue = null;
    lastSecureStorageError = null;
    return getSecureStorageState();
  }

  if (!isSecureStorageAvailable()) {
    lastSecureStorageError = 'safeStorage encryption is unavailable on this platform or desktop session.';
    return getSecureStorageState();
  }

  try {
    lastLoadedSecureValue = safeStorage.decryptString(Buffer.from(secureStorageRecord.encryptedValue, 'base64'));
    lastSecureStorageError = null;
  } catch (error) {
    lastLoadedSecureValue = null;
    lastSecureStorageError = error instanceof Error ? error.message : 'Unknown secure-storage load failure';
  }

  return getSecureStorageState();
}

async function clearSecureValue() {
  secureStorageRecord = null;
  lastLoadedSecureValue = null;
  lastSecureStorageError = null;
  await persistSecureStorageRecord();
  return getSecureStorageState();
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
` : ''}${useGlobalShortcut ? `
const starterShortcutAccelerator = 'CommandOrControl+Shift+Y';
let starterShortcutEnabled = true;
let starterShortcutLastTriggeredAt: string | null = null;
let starterShortcutError: string | null = null;

function runStarterShortcutAction() {
  starterShortcutLastTriggeredAt = new Date().toISOString();

  if (!mainWindow) {
    createWindow();
    return getGlobalShortcutState();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  return getGlobalShortcutState();
}

function registerStarterShortcut() {
  globalShortcut.unregister(starterShortcutAccelerator);

  if (!starterShortcutEnabled) {
    starterShortcutError = null;
    return getGlobalShortcutState();
  }

  const registered = globalShortcut.register(starterShortcutAccelerator, () => {
    runStarterShortcutAction();
  });

  starterShortcutError = registered
    ? null
    : 'Unable to register the starter shortcut. Another app may already be using it.';

  return getGlobalShortcutState();
}

function setGlobalShortcutEnabled(enabled: boolean) {
  starterShortcutEnabled = enabled;
  return registerStarterShortcut();
}

function getGlobalShortcutState() {
  return {
    accelerator: starterShortcutAccelerator,
    enabled: starterShortcutEnabled,
    registered: globalShortcut.isRegistered(starterShortcutAccelerator),
    lastTriggeredAt: starterShortcutLastTriggeredAt,
    error: starterShortcutError,
  };
}
` : ''}${useFileAssociation ? `
let lastAssociatedFilePath: string | null = null;
let lastAssociatedFileSource: string | null = null;

function normalizeAssociatedFilePath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(value).pathname);
    } catch {
      return null;
    }
  }

  return value;
}

function matchesAssociatedFile(value: string | null | undefined) {
  const normalized = normalizeAssociatedFilePath(value);
  return normalized?.toLowerCase().endsWith(${JSON.stringify(`.${fileAssociationExtension}`)}) ?? false;
}

function getFileAssociationState() {
  return {
    extension: ${JSON.stringify(fileAssociationExtension)},
    lastPath: lastAssociatedFilePath,
    source: lastAssociatedFileSource,
  };
}

function captureAssociatedFile(value: string | null | undefined, source: string) {
  const normalized = normalizeAssociatedFilePath(value);
  if (!matchesAssociatedFile(normalized)) {
    return getFileAssociationState();
  }

  lastAssociatedFilePath = normalized;
  lastAssociatedFileSource = source;
${useRecentFiles ? `  void rememberRecentFile(normalized);` : ''}
  return getFileAssociationState();
}

function findAssociatedFileArg(args: string[]) {
  return args.find((value) => matchesAssociatedFile(value)) ?? null;
}
` : ''}${useFileDialogs ? `
type FileDialogState = {
  suggestedName: string;
  lastOpenPath: string | null;
  lastSavePath: string | null;
  lastRevealPath: string | null;
  lastAction: 'open' | 'save' | 'reveal' | null;
};

const fileDialogState: FileDialogState = {
  suggestedName: ${JSON.stringify(dialogFileName)},
  lastOpenPath: null,
  lastSavePath: null,
  lastRevealPath: null,
  lastAction: null,
};

function normalizeDialogPath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(value).pathname);
    } catch {
      return value;
    }
  }

  return value;
}

function resolveDialogDefaultPath(value: string | null | undefined) {
  const normalized = normalizeDialogPath(value);
  if (normalized && normalized.trim().length > 0) {
    return normalized;
  }

  return path.join(app.getPath('documents'), fileDialogState.suggestedName);
}

function getFileDialogState() {
  return { ...fileDialogState };
}

async function openStarterFileDialog(defaultPath: string | null | undefined) {
  const options: OpenDialogOptions = {
    title: 'Open Document',
    defaultPath: resolveDialogDefaultPath(defaultPath),
    properties: ['openFile'],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (!result.canceled && result.filePaths[0]) {
    fileDialogState.lastOpenPath = result.filePaths[0];
    fileDialogState.lastAction = 'open';
${useRecentFiles ? `    await rememberRecentFile(result.filePaths[0]);` : ''}
  }

  return getFileDialogState();
}

async function saveStarterFileDialog(defaultPath: string | null | undefined) {
  const options = {
    title: 'Save Document',
    defaultPath: resolveDialogDefaultPath(defaultPath),
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (!result.canceled && result.filePath) {
    fileDialogState.lastSavePath = result.filePath;
    fileDialogState.lastAction = 'save';
${useRecentFiles ? `    await rememberRecentFile(result.filePath);` : ''}
  }

  return getFileDialogState();
}

function revealStarterPath(targetPath: string | null | undefined) {
  const normalized = normalizeDialogPath(targetPath)
    ?? fileDialogState.lastSavePath
    ?? fileDialogState.lastOpenPath;

  if (!normalized) {
    return getFileDialogState();
  }

  shell.showItemInFolder(normalized);
  fileDialogState.lastRevealPath = normalized;
  fileDialogState.lastAction = 'reveal';
${useRecentFiles ? `  void rememberRecentFile(normalized);` : ''}
  return getFileDialogState();
}
` : ''}${useRecentFiles ? `
type RecentFilesState = {
  limit: number;
  items: string[];
  lastOpenedPath: string | null;
};

const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json');
const recentFilesState: RecentFilesState = {
  limit: 8,
  items: [],
  lastOpenedPath: null,
};

function normalizeRecentFilePath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(value).pathname);
    } catch {
      return value;
    }
  }

  return value;
}

async function loadRecentFiles() {
  try {
    const raw = await readFile(recentFilesPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<RecentFilesState>;
    recentFilesState.items = Array.isArray(parsed.items)
      ? parsed.items.filter((value): value is string => typeof value === 'string').slice(0, recentFilesState.limit)
      : [];
    recentFilesState.lastOpenedPath = typeof parsed.lastOpenedPath === 'string' ? parsed.lastOpenedPath : null;
  } catch {
    recentFilesState.items = [];
    recentFilesState.lastOpenedPath = null;
  }
}

async function saveRecentFiles() {
  await writeFile(recentFilesPath, JSON.stringify(recentFilesState, null, 2), 'utf-8');
}

function getRecentFilesState() {
  return {
    limit: recentFilesState.limit,
    items: [...recentFilesState.items],
    lastOpenedPath: recentFilesState.lastOpenedPath,
  };
}

async function rememberRecentFile(value: string | null | undefined) {
  const normalized = normalizeRecentFilePath(value);
  if (!normalized) {
    return getRecentFilesState();
  }

  recentFilesState.items = [
    normalized,
    ...recentFilesState.items.filter((item) => item !== normalized),
  ].slice(0, recentFilesState.limit);
  recentFilesState.lastOpenedPath = normalized;
  app.addRecentDocument(normalized);
  await saveRecentFiles();
  return getRecentFilesState();
}

async function clearRecentFiles() {
  recentFilesState.items = [];
  recentFilesState.lastOpenedPath = null;
  app.clearRecentDocuments();
  await saveRecentFiles();
  return getRecentFilesState();
}
` : ''}${useCrashRecovery ? `
type CrashIncident = {
  scope: 'renderer' | 'window' | 'child-process';
  reason: string;
  details: string | null;
  timestamp: string;
};

type CrashRecoveryState = {
  hasIncident: boolean;
  lastIncident: CrashIncident | null;
};

const crashRecoveryPath = path.join(app.getPath('userData'), 'crash-recovery.json');
const crashRecoveryState: CrashRecoveryState = {
  hasIncident: false,
  lastIncident: null,
};

async function loadCrashRecoveryState() {
  try {
    const raw = await readFile(crashRecoveryPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CrashRecoveryState>;
    crashRecoveryState.hasIncident = parsed.hasIncident === true;
    crashRecoveryState.lastIncident = parsed.lastIncident
      && typeof parsed.lastIncident.reason === 'string'
      && typeof parsed.lastIncident.scope === 'string'
      && typeof parsed.lastIncident.timestamp === 'string'
      ? {
          scope: parsed.lastIncident.scope as CrashIncident['scope'],
          reason: parsed.lastIncident.reason,
          details: typeof parsed.lastIncident.details === 'string' ? parsed.lastIncident.details : null,
          timestamp: parsed.lastIncident.timestamp,
        }
      : null;
  } catch {
    crashRecoveryState.hasIncident = false;
    crashRecoveryState.lastIncident = null;
  }
}

async function saveCrashRecoveryState() {
  await writeFile(crashRecoveryPath, JSON.stringify(crashRecoveryState, null, 2), 'utf-8');
}

function getCrashRecoveryState() {
  return {
    hasIncident: crashRecoveryState.hasIncident,
    lastIncident: crashRecoveryState.lastIncident,
  };
}

function getCrashDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) {
    return null;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
}

async function recordCrashIncident(
  scope: CrashIncident['scope'],
  reason: string,
  details: string | null = null,
) {
  crashRecoveryState.hasIncident = true;
  crashRecoveryState.lastIncident = {
    scope,
    reason,
    details,
    timestamp: new Date().toISOString(),
  };
  await saveCrashRecoveryState();
  return getCrashRecoveryState();
}

async function clearCrashRecoveryState() {
  crashRecoveryState.hasIncident = false;
  crashRecoveryState.lastIncident = null;
  await saveCrashRecoveryState();
  return getCrashRecoveryState();
}

function relaunchFromCrashRecovery() {
  app.relaunch();
  setTimeout(() => {
    app.exit(0);
  }, 25);

  return {
    ...getCrashRecoveryState(),
    relaunching: true,
  };
}
` : ''}${usePowerMonitor ? `
type PowerMonitorEventName = 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery';

type PowerMonitorState = {
  supported: boolean;
  powerSource: 'ac' | 'battery' | 'unknown';
  idleState: 'active' | 'idle' | 'locked' | 'unknown';
  idleTimeSeconds: number;
  lastEvent: PowerMonitorEventName | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{ name: PowerMonitorEventName; timestamp: string }>;
};

const powerMonitorHistoryLimit = 6;
const powerMonitorState: PowerMonitorState = {
  supported: true,
  powerSource: 'unknown',
  idleState: 'unknown',
  idleTimeSeconds: 0,
  lastEvent: null,
  lastEventAt: null,
  eventCount: 0,
  history: [],
};

function resolvePowerSource() {
  try {
    return powerMonitor.isOnBatteryPower() ? 'battery' : 'ac';
  } catch {
    return 'unknown';
  }
}

function resolveIdleSnapshot() {
  try {
    return {
      idleState: powerMonitor.getSystemIdleState(60),
      idleTimeSeconds: powerMonitor.getSystemIdleTime(),
    };
  } catch {
    return {
      idleState: 'unknown' as const,
      idleTimeSeconds: 0,
    };
  }
}

function getPowerMonitorState() {
  const idleSnapshot = resolveIdleSnapshot();
  powerMonitorState.powerSource = resolvePowerSource();
  powerMonitorState.idleState = idleSnapshot.idleState;
  powerMonitorState.idleTimeSeconds = idleSnapshot.idleTimeSeconds;

  return {
    supported: powerMonitorState.supported,
    powerSource: powerMonitorState.powerSource,
    idleState: powerMonitorState.idleState,
    idleTimeSeconds: powerMonitorState.idleTimeSeconds,
    lastEvent: powerMonitorState.lastEvent,
    lastEventAt: powerMonitorState.lastEventAt,
    eventCount: powerMonitorState.eventCount,
    history: [...powerMonitorState.history],
  };
}

function recordPowerMonitorEvent(name: PowerMonitorEventName) {
  const timestamp = new Date().toISOString();
  powerMonitorState.lastEvent = name;
  powerMonitorState.lastEventAt = timestamp;
  powerMonitorState.eventCount += 1;
  powerMonitorState.history = [{ name, timestamp }, ...powerMonitorState.history].slice(0, powerMonitorHistoryLimit);
  return getPowerMonitorState();
}

function clearPowerMonitorHistory() {
  powerMonitorState.lastEvent = null;
  powerMonitorState.lastEventAt = null;
  powerMonitorState.eventCount = 0;
  powerMonitorState.history = [];
  return getPowerMonitorState();
}

function registerPowerMonitor() {
  powerMonitor.on('suspend', () => {
    recordPowerMonitorEvent('suspend');
  });
  powerMonitor.on('resume', () => {
    recordPowerMonitorEvent('resume');
  });
  powerMonitor.on('lock-screen', () => {
    recordPowerMonitorEvent('lock-screen');
  });
  powerMonitor.on('unlock-screen', () => {
    recordPowerMonitorEvent('unlock-screen');
  });
  powerMonitor.on('on-ac', () => {
    recordPowerMonitorEvent('on-ac');
  });
  powerMonitor.on('on-battery', () => {
    recordPowerMonitorEvent('on-battery');
  });
}
` : ''}${useIdlePresence ? `
type IdlePresenceState = {
  supported: boolean;
  idleState: 'active' | 'idle' | 'locked' | 'unknown';
  idleTimeSeconds: number;
  thresholdSeconds: number;
  attention: 'focused' | 'visible' | 'hidden' | 'no-window';
  lastSampledAt: string | null;
  lastChangedAt: string | null;
  sampleCount: number;
  history: Array<{
    idleState: 'active' | 'idle' | 'locked' | 'unknown';
    idleTimeSeconds: number;
    attention: 'focused' | 'visible' | 'hidden' | 'no-window';
    timestamp: string;
  }>;
};

const idlePresenceThresholdSeconds = 45;
const idlePresenceHistoryLimit = 8;
const idlePresenceState: IdlePresenceState = {
  supported: true,
  idleState: 'unknown',
  idleTimeSeconds: 0,
  thresholdSeconds: idlePresenceThresholdSeconds,
  attention: 'no-window',
  lastSampledAt: null,
  lastChangedAt: null,
  sampleCount: 0,
  history: [],
};

function resolveIdlePresenceAttention(): IdlePresenceState['attention'] {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return 'no-window';
  }

  if (mainWindow.isFocused()) {
    return 'focused';
  }

  if (mainWindow.isVisible()) {
    return 'visible';
  }

  return 'hidden';
}

function resolveIdlePresenceSnapshot() {
  try {
    return {
      idleState: powerMonitor.getSystemIdleState(idlePresenceThresholdSeconds),
      idleTimeSeconds: powerMonitor.getSystemIdleTime(),
    };
  } catch {
    return {
      idleState: 'unknown' as const,
      idleTimeSeconds: 0,
    };
  }
}

function snapshotIdlePresence() {
  const snapshot = resolveIdlePresenceSnapshot();
  const attention = resolveIdlePresenceAttention();
  const timestamp = new Date().toISOString();
  const stateChanged = idlePresenceState.idleState !== snapshot.idleState
    || idlePresenceState.attention !== attention;

  idlePresenceState.supported = true;
  idlePresenceState.idleState = snapshot.idleState;
  idlePresenceState.idleTimeSeconds = snapshot.idleTimeSeconds;
  idlePresenceState.attention = attention;
  idlePresenceState.lastSampledAt = timestamp;
  idlePresenceState.sampleCount += 1;
  if (stateChanged || !idlePresenceState.lastChangedAt) {
    idlePresenceState.lastChangedAt = timestamp;
  }
  idlePresenceState.history = [
    {
      idleState: snapshot.idleState,
      idleTimeSeconds: snapshot.idleTimeSeconds,
      attention,
      timestamp,
    },
    ...idlePresenceState.history,
  ].slice(0, idlePresenceHistoryLimit);

  return {
    supported: idlePresenceState.supported,
    idleState: idlePresenceState.idleState,
    idleTimeSeconds: idlePresenceState.idleTimeSeconds,
    thresholdSeconds: idlePresenceState.thresholdSeconds,
    attention: idlePresenceState.attention,
    lastSampledAt: idlePresenceState.lastSampledAt,
    lastChangedAt: idlePresenceState.lastChangedAt,
    sampleCount: idlePresenceState.sampleCount,
    history: [...idlePresenceState.history],
  };
}

function clearIdlePresenceHistory() {
  idlePresenceState.lastSampledAt = null;
  idlePresenceState.lastChangedAt = null;
  idlePresenceState.sampleCount = 0;
  idlePresenceState.history = [];
  return snapshotIdlePresence();
}
` : ''}${useSessionState ? `
type SessionEventName =
  | 'ready'
  | 'activate'
  | 'browser-window-focus'
  | 'browser-window-blur'
  | 'show'
  | 'hide'
  | 'before-quit'
  | 'window-all-closed';

type SessionLifecycle = 'ready' | 'active' | 'background' | 'hidden' | 'quitting';
type SessionAttention = 'focused' | 'visible' | 'hidden' | 'no-window';

type SessionStateSnapshot = {
  startedAt: string;
  lifecycle: SessionLifecycle;
  attention: SessionAttention;
  windowCount: number;
  visibleWindowCount: number;
  focusedWindowCount: number;
  lastEvent: SessionEventName | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{
    name: SessionEventName;
    timestamp: string;
    detail: string | null;
  }>;
};

const sessionStateHistoryLimit = 10;
const sessionStartedAt = new Date().toISOString();
let sessionStateRegistered = false;
let sessionStateQuitting = false;
const sessionStateSnapshot: SessionStateSnapshot = {
  startedAt: sessionStartedAt,
  lifecycle: 'ready',
  attention: 'no-window',
  windowCount: 0,
  visibleWindowCount: 0,
  focusedWindowCount: 0,
  lastEvent: null,
  lastEventAt: null,
  eventCount: 0,
  history: [],
};

function resolveSessionAttention(): SessionAttention {
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  if (windows.length === 0) {
    return 'no-window';
  }

  if (windows.some((window) => window.isFocused())) {
    return 'focused';
  }

  if (windows.some((window) => window.isVisible())) {
    return 'visible';
  }

  return 'hidden';
}

function resolveSessionLifecycle(
  attention: SessionAttention,
  windowCount: number,
  visibleWindowCount: number,
): SessionLifecycle {
  if (sessionStateQuitting) {
    return 'quitting';
  }

  if (attention === 'focused') {
    return 'active';
  }

  if (visibleWindowCount > 0) {
    return 'background';
  }

  if (windowCount > 0) {
    return 'hidden';
  }

  return 'ready';
}

function getSessionStateSnapshot() {
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  const visibleWindowCount = windows.filter((window) => window.isVisible()).length;
  const focusedWindowCount = windows.filter((window) => window.isFocused()).length;
  const attention = resolveSessionAttention();

  sessionStateSnapshot.attention = attention;
  sessionStateSnapshot.windowCount = windows.length;
  sessionStateSnapshot.visibleWindowCount = visibleWindowCount;
  sessionStateSnapshot.focusedWindowCount = focusedWindowCount;
  sessionStateSnapshot.lifecycle = resolveSessionLifecycle(attention, windows.length, visibleWindowCount);

  return {
    startedAt: sessionStateSnapshot.startedAt,
    lifecycle: sessionStateSnapshot.lifecycle,
    attention: sessionStateSnapshot.attention,
    windowCount: sessionStateSnapshot.windowCount,
    visibleWindowCount: sessionStateSnapshot.visibleWindowCount,
    focusedWindowCount: sessionStateSnapshot.focusedWindowCount,
    lastEvent: sessionStateSnapshot.lastEvent,
    lastEventAt: sessionStateSnapshot.lastEventAt,
    eventCount: sessionStateSnapshot.eventCount,
    history: [...sessionStateSnapshot.history],
  };
}

function recordSessionEvent(name: SessionEventName, detail: string | null = null) {
  const timestamp = new Date().toISOString();
  sessionStateSnapshot.lastEvent = name;
  sessionStateSnapshot.lastEventAt = timestamp;
  sessionStateSnapshot.eventCount += 1;
  sessionStateSnapshot.history = [
    { name, timestamp, detail },
    ...sessionStateSnapshot.history,
  ].slice(0, sessionStateHistoryLimit);
  return getSessionStateSnapshot();
}

function clearSessionStateHistory() {
  sessionStateSnapshot.lastEvent = null;
  sessionStateSnapshot.lastEventAt = null;
  sessionStateSnapshot.eventCount = 0;
  sessionStateSnapshot.history = [];
  return getSessionStateSnapshot();
}

function trackSessionWindow(window: BrowserWindow) {
  const detail = \`window:\${window.id}\`;
  window.on('show', () => {
    recordSessionEvent('show', detail);
  });
  window.on('hide', () => {
    recordSessionEvent('hide', detail);
  });
}

function registerSessionState() {
  if (sessionStateRegistered) {
    return;
  }

  sessionStateRegistered = true;
  app.on('activate', () => {
    recordSessionEvent('activate');
  });
  app.on('browser-window-focus', (_event, window) => {
    recordSessionEvent('browser-window-focus', \`window:\${window.id}\`);
  });
  app.on('browser-window-blur', (_event, window) => {
    recordSessionEvent('browser-window-blur', \`window:\${window.id}\`);
  });
  app.on('before-quit', () => {
    sessionStateQuitting = true;
    recordSessionEvent('before-quit');
  });
  app.on('window-all-closed', () => {
    recordSessionEvent('window-all-closed');
  });
  recordSessionEvent('ready');
}
` : ''}${useDownloads ? `
type DownloadState = 'idle' | 'progressing' | 'completed' | 'cancelled' | 'interrupted';

type DownloadEntry = {
  id: string;
  url: string;
  fileName: string;
  savePath: string | null;
  state: DownloadState;
  receivedBytes: number;
  totalBytes: number;
  startedAt: string;
  finishedAt: string | null;
};

type DownloadsState = {
  sampleUrl: string;
  activeCount: number;
  lastDownloadPath: string | null;
  items: DownloadEntry[];
};

const starterDownloadUrl = 'https://raw.githubusercontent.com/electron/electron/main/README.md';
const downloadsHistoryLimit = 6;
const downloadsState: DownloadsState = {
  sampleUrl: starterDownloadUrl,
  activeCount: 0,
  lastDownloadPath: null,
  items: [],
};

function getDownloadsState() {
  downloadsState.activeCount = downloadsState.items.filter((entry) => entry.state === 'progressing').length;
  return {
    sampleUrl: downloadsState.sampleUrl,
    activeCount: downloadsState.activeCount,
    lastDownloadPath: downloadsState.lastDownloadPath,
    items: downloadsState.items.map((entry) => ({ ...entry })),
  };
}

function upsertDownloadEntry(entry: DownloadEntry) {
  downloadsState.items = [
    entry,
    ...downloadsState.items.filter((item) => item.id !== entry.id),
  ].slice(0, downloadsHistoryLimit);
  if (entry.savePath) {
    downloadsState.lastDownloadPath = entry.savePath;
  }
  return getDownloadsState();
}

function clearDownloadHistory() {
  downloadsState.items = [];
  downloadsState.activeCount = 0;
  downloadsState.lastDownloadPath = null;
  return getDownloadsState();
}

function revealDownloadedItem(targetPath: string | null | undefined) {
  const resolvedPath = targetPath ?? downloadsState.lastDownloadPath;
  if (!resolvedPath) {
    return getDownloadsState();
  }

  shell.showItemInFolder(resolvedPath);
  return getDownloadsState();
}

function registerDownloadTracking() {
  session.defaultSession.on('will-download', (_event, item) => {
    const downloadId = \`\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
    const startedAt = new Date().toISOString();
    const buildEntry = (state: DownloadState, finishedAt: string | null = null): DownloadEntry => ({
      id: downloadId,
      url: item.getURL(),
      fileName: item.getFilename(),
      savePath: item.getSavePath() || null,
      state,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      startedAt,
      finishedAt,
    });

    upsertDownloadEntry(buildEntry('progressing'));

    item.on('updated', (_updatedEvent, state) => {
      const nextState = state === 'interrupted' ? 'interrupted' : 'progressing';
      upsertDownloadEntry(buildEntry(nextState));
    });

    item.on('done', (_doneEvent, state) => {
      const nextState = state === 'completed'
        ? 'completed'
        : state === 'cancelled'
          ? 'cancelled'
          : 'interrupted';
      upsertDownloadEntry(buildEntry(nextState, new Date().toISOString()));
    });
  });
}

function startStarterDownload(url: string | null | undefined) {
  const targetUrl = url?.trim() || downloadsState.sampleUrl;
  downloadsState.sampleUrl = targetUrl;

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }

  mainWindow?.webContents.downloadURL(targetUrl);
  return getDownloadsState();
}
` : ''}${useClipboard ? `
type ClipboardAction = 'read' | 'write' | 'clear';

type ClipboardHistoryEntry = {
  action: ClipboardAction;
  text: string;
  timestamp: string;
};

type ClipboardState = {
  currentText: string;
  lastAction: ClipboardAction | null;
  history: ClipboardHistoryEntry[];
};

const clipboardHistoryLimit = 6;
const clipboardState: ClipboardState = {
  currentText: '',
  lastAction: null,
  history: [],
};

function syncClipboardState(action: ClipboardAction | null = null) {
  clipboardState.currentText = clipboard.readText();
  clipboardState.lastAction = action;
  return {
    currentText: clipboardState.currentText,
    lastAction: clipboardState.lastAction,
    history: [...clipboardState.history],
  };
}

function recordClipboardAction(action: ClipboardAction, text: string) {
  clipboardState.history = [
    {
      action,
      text,
      timestamp: new Date().toISOString(),
    },
    ...clipboardState.history,
  ].slice(0, clipboardHistoryLimit);
  return syncClipboardState(action);
}

function getClipboardState() {
  return syncClipboardState(clipboardState.lastAction);
}

function readClipboardText() {
  const text = clipboard.readText();
  return recordClipboardAction('read', text);
}

function writeClipboardText(text: string | null | undefined) {
  const value = text?.trim() ?? '';
  clipboard.writeText(value);
  return recordClipboardAction('write', value);
}

function clearClipboardText() {
  clipboard.clear();
  return recordClipboardAction('clear', '');
}
` : ''}${useExternalLinks ? `
type ExternalLinkHistoryEntry = {
  url: string;
  status: 'opened' | 'failed';
  error: string | null;
  timestamp: string;
};

type ExternalLinksState = {
  defaultUrl: string;
  lastUrl: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  lastError: string | null;
  history: ExternalLinkHistoryEntry[];
};

const externalLinksHistoryLimit = 6;
const externalLinksState: ExternalLinksState = {
  defaultUrl: 'https://www.electronjs.org',
  lastUrl: null,
  lastOpenedAt: null,
  openCount: 0,
  lastError: null,
  history: [],
};

function getExternalLinksState() {
  return {
    defaultUrl: externalLinksState.defaultUrl,
    lastUrl: externalLinksState.lastUrl,
    lastOpenedAt: externalLinksState.lastOpenedAt,
    openCount: externalLinksState.openCount,
    lastError: externalLinksState.lastError,
    history: [...externalLinksState.history],
  };
}

function recordExternalLinkResult(
  url: string,
  status: 'opened' | 'failed',
  error: string | null = null,
) {
  const timestamp = new Date().toISOString();
  externalLinksState.lastUrl = url;
  externalLinksState.lastOpenedAt = timestamp;
  externalLinksState.lastError = error;
  if (status === 'opened') {
    externalLinksState.openCount += 1;
  }
  externalLinksState.history = [
    {
      url,
      status,
      error,
      timestamp,
    },
    ...externalLinksState.history,
  ].slice(0, externalLinksHistoryLimit);
  return getExternalLinksState();
}

async function openStarterExternalLink(url: string | null | undefined) {
  const targetUrl = url?.trim() || externalLinksState.defaultUrl;
  externalLinksState.defaultUrl = targetUrl;

  try {
    await shell.openExternal(targetUrl);
    return recordExternalLinkResult(targetUrl, 'opened');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown shell open error';
    return recordExternalLinkResult(targetUrl, 'failed', message);
  }
}

function clearExternalLinksHistory() {
  externalLinksState.lastUrl = null;
  externalLinksState.lastOpenedAt = null;
  externalLinksState.openCount = 0;
  externalLinksState.lastError = null;
  externalLinksState.history = [];
  return getExternalLinksState();
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

` : ''}${useSystemInfo ? `  ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO_GET_STATE, async () => {
    return getSystemInfoState();
  });

` : ''}${usePermissions ? `  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_GET_STATE, async () => {
    return getPermissionsState();
  });

  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_REQUEST, async (_event, kind: 'camera' | 'microphone') => {
    return requestPermission(kind);
  });

` : ''}${useNetworkStatus ? `  ipcMain.handle(IPC_CHANNELS.NETWORK_STATUS_GET_STATE, async () => {
    return snapshotNetworkStatus();
  });

  ipcMain.handle(IPC_CHANNELS.NETWORK_STATUS_CLEAR_HISTORY, async () => {
    return clearNetworkStatusHistory();
  });

` : ''}${useSecureStorage ? `  ipcMain.handle(IPC_CHANNELS.SECURE_STORAGE_GET_STATE, async () => {
    return getSecureStorageState();
  });

  ipcMain.handle(IPC_CHANNELS.SECURE_STORAGE_SAVE, async (_event, label?: string, value?: string) => {
    return saveSecureValue(label, value);
  });

  ipcMain.handle(IPC_CHANNELS.SECURE_STORAGE_LOAD, async () => {
    return loadSecureValue();
  });

  ipcMain.handle(IPC_CHANNELS.SECURE_STORAGE_CLEAR, async () => {
    return clearSecureValue();
  });

` : ''}${useSupportBundle ? `  ipcMain.handle(IPC_CHANNELS.SUPPORT_BUNDLE_GET_STATE, async () => {
    return getSupportBundleState();
  });

  ipcMain.handle(IPC_CHANNELS.SUPPORT_BUNDLE_EXPORT, async () => {
    return exportSupportBundle();
  });

  ipcMain.handle(IPC_CHANNELS.SUPPORT_BUNDLE_REVEAL, async () => {
    return revealSupportBundle();
  });

` : ''}${useLogArchive ? `  ipcMain.handle(IPC_CHANNELS.LOG_ARCHIVE_GET_STATE, async () => {
    return getLogArchiveState();
  });

  ipcMain.handle(IPC_CHANNELS.LOG_ARCHIVE_EXPORT, async () => {
    return exportLogArchive();
  });

  ipcMain.handle(IPC_CHANNELS.LOG_ARCHIVE_REVEAL, async () => {
    return revealLogArchive();
  });

` : ''}${useIncidentReport ? `  ipcMain.handle(IPC_CHANNELS.INCIDENT_REPORT_GET_STATE, async () => {
    return getIncidentReportState();
  });

  ipcMain.handle(IPC_CHANNELS.INCIDENT_REPORT_EXPORT, async (_event, draft?: Partial<IncidentReportDraft>) => {
    return exportIncidentReport(draft);
  });

  ipcMain.handle(IPC_CHANNELS.INCIDENT_REPORT_REVEAL, async () => {
    return revealIncidentReport();
  });

` : ''}${useDiagnosticsTimeline ? `  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_GET_STATE, async () => {
    return getDiagnosticsTimelineState();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_EXPORT, async () => {
    return exportDiagnosticsTimeline();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_REVEAL, async () => {
    return revealDiagnosticsTimeline();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_CLEAR_HISTORY, async () => {
    return clearDiagnosticsTimelineHistory();
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

` : ''}${useGlobalShortcut ? `  ipcMain.handle(IPC_CHANNELS.GLOBAL_SHORTCUT_GET_STATUS, async () => {
    return getGlobalShortcutState();
  });

  ipcMain.handle(IPC_CHANNELS.GLOBAL_SHORTCUT_SET_ENABLED, async (_event, enabled: boolean) => {
    return setGlobalShortcutEnabled(enabled);
  });

  ipcMain.handle(IPC_CHANNELS.GLOBAL_SHORTCUT_TRIGGER, async () => {
    return runStarterShortcutAction();
  });

` : ''}${useFileAssociation ? `  ipcMain.handle(IPC_CHANNELS.FILE_ASSOCIATION_GET_STATE, async () => {
    return getFileAssociationState();
  });

  ipcMain.handle(IPC_CHANNELS.FILE_ASSOCIATION_OPEN, async (_event, filePath: string) => {
    return captureAssociatedFile(filePath, 'manual');
  });

` : ''}${useFileDialogs ? `  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_GET_STATE, async () => {
    return getFileDialogState();
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_OPEN, async (_event, defaultPath?: string) => {
    return openStarterFileDialog(defaultPath);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_SAVE, async (_event, defaultPath?: string) => {
    return saveStarterFileDialog(defaultPath);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_REVEAL, async (_event, targetPath?: string) => {
    return revealStarterPath(targetPath);
  });

` : ''}${useRecentFiles ? `  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_GET_STATE, async () => {
    return getRecentFilesState();
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_ADD, async (_event, filePath: string) => {
    return rememberRecentFile(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_OPEN, async (_event, filePath: string) => {
${useFileAssociation ? `    const normalized = normalizeRecentFilePath(filePath);
    if (normalized && matchesAssociatedFile(normalized)) {
      captureAssociatedFile(normalized, 'recent-files');
    }
` : ''}    return rememberRecentFile(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_CLEAR, async () => {
    return clearRecentFiles();
  });

` : ''}${useCrashRecovery ? `  ipcMain.handle(IPC_CHANNELS.CRASH_RECOVERY_GET_STATE, async () => {
    return getCrashRecoveryState();
  });

  ipcMain.handle(IPC_CHANNELS.CRASH_RECOVERY_CLEAR, async () => {
    return clearCrashRecoveryState();
  });

  ipcMain.handle(IPC_CHANNELS.CRASH_RECOVERY_RELAUNCH, async () => {
    return relaunchFromCrashRecovery();
  });

` : ''}${usePowerMonitor ? `  ipcMain.handle(IPC_CHANNELS.POWER_MONITOR_GET_STATE, async () => {
    return getPowerMonitorState();
  });

  ipcMain.handle(IPC_CHANNELS.POWER_MONITOR_CLEAR_HISTORY, async () => {
    return clearPowerMonitorHistory();
  });

` : ''}${useIdlePresence ? `  ipcMain.handle(IPC_CHANNELS.IDLE_PRESENCE_GET_STATE, async () => {
    return snapshotIdlePresence();
  });

  ipcMain.handle(IPC_CHANNELS.IDLE_PRESENCE_CLEAR_HISTORY, async () => {
    return clearIdlePresenceHistory();
  });

` : ''}${useSessionState ? `  ipcMain.handle(IPC_CHANNELS.SESSION_STATE_GET, async () => {
    return getSessionStateSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_STATE_CLEAR_HISTORY, async () => {
    return clearSessionStateHistory();
  });

` : ''}${useDownloads ? `  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_GET_STATE, async () => {
    return getDownloadsState();
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_START, async (_event, url?: string) => {
    return startStarterDownload(url);
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CLEAR_HISTORY, async () => {
    return clearDownloadHistory();
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_REVEAL, async (_event, targetPath?: string) => {
    return revealDownloadedItem(targetPath);
  });

` : ''}${useClipboard ? `  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET_STATE, async () => {
    return getClipboardState();
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ_TEXT, async () => {
    return readClipboardText();
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, async (_event, text?: string) => {
    return writeClipboardText(text);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CLEAR, async () => {
    return clearClipboardText();
  });

` : ''}${useExternalLinks ? `  ipcMain.handle(IPC_CHANNELS.EXTERNAL_LINKS_GET_STATE, async () => {
    return getExternalLinksState();
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_LINKS_OPEN, async (_event, url?: string) => {
    return openStarterExternalLink(url);
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_LINKS_CLEAR_HISTORY, async () => {
    return clearExternalLinksHistory();
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
      sandbox: true,
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedRendererUrl(url)) {
      maybeOpenExternalUrl(url);
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRendererUrl(url)) {
      return;
    }

    event.preventDefault();
    maybeOpenExternalUrl(url);
  });

${useDiagnosticsTimeline ? "  pushDiagnosticsTimelineEvent('window', 'created', `window:${mainWindow.id}`);\n" : ''}
${useJobs ? `  jobEngine.onJobUpdate((job) => {
    mainWindow?.webContents.send(IPC_CHANNELS.JOB_UPDATE, job);
  });

` : ''}  mainWindow.on('ready-to-show', () => {
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('window', 'ready-to-show', mainWindow ? `window:${mainWindow.id}` : null);\n" : ''}    mainWindow?.show();
  });

${useSessionState ? '  trackSessionWindow(mainWindow);\n\n' : ''}  mainWindow.on('closed', () => {
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('window', 'closed', mainWindow ? `window:${mainWindow.id}` : null);\n" : ''}    mainWindow = null;
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
${useCrashRecovery ? `  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    void recordCrashIncident('renderer', details.reason, getCrashDetails({
      exitCode: details.exitCode,
    }));
  });

  mainWindow.on('unresponsive', () => {
    void recordCrashIncident('window', 'unresponsive', 'Main window stopped responding.');
  });
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

${useWindowing || useDeepLink || useFileAssociation ? `const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
${useDeepLink ? '    captureDeepLink(findProtocolArg(argv));\n' : ''}${useFileAssociation ? "    captureAssociatedFile(findAssociatedFileArg(argv), 'second-instance');\n" : ''}    if (!mainWindow) {
${useDiagnosticsTimeline ? "      pushDiagnosticsTimelineEvent('app', 'second-instance', 'recreated-window');\n" : ''}      createWindow();
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

` : ''}${useFileAssociation ? `app.on('open-file', (event, filePath) => {
  event.preventDefault();
  captureAssociatedFile(filePath, 'open-file');
});

` : ''}${useCrashRecovery ? `app.on('child-process-gone', (_event, details) => {
  void recordCrashIncident('child-process', details.reason, getCrashDetails({
    type: details.type,
    name: details.name,
    serviceName: details.serviceName,
    exitCode: details.exitCode,
  }));
});

` : ''}app.whenReady().then(async () => {
  logger.info('App starting', { isDev, appRoot });
  await enforceRuntimeHygiene();
${useSettings ? '  await settingsManager.load();\n' : ''}${useWindowing ? '  await loadWindowState();\n' : ''}${useRecentFiles ? '  await loadRecentFiles();\n' : ''}${useCrashRecovery ? '  await loadCrashRecoveryState();\n' : ''}${useSecureStorage ? '  await loadSecureStorageRecord();\n' : ''}  registerIpcHandlers();
${useDeepLink ? "  captureDeepLink(findProtocolArg(process.argv));\n" : ''}${useFileAssociation ? "  captureAssociatedFile(findAssociatedFileArg(process.argv), 'startup-argv');\n" : ''}  createWindow();
${useDiagnosticsTimeline ? "  pushDiagnosticsTimelineEvent('app', 'ready', isDev ? 'development' : 'packaged');\n" : ''}${useTray ? '  createTray();\n' : ''}${useMenuBar ? '  installApplicationMenu();\n' : ''}${useGlobalShortcut ? '  registerStarterShortcut();\n' : ''}${usePowerMonitor ? '  registerPowerMonitor();\n' : ''}${useSessionState ? '  registerSessionState();\n' : ''}${useDownloads ? '  registerDownloadTracking();\n' : ''}${useUpdater ? `  if (app.isPackaged) {
    setTimeout(() => {
      updater.checkForUpdates().catch(() => {
        logger.info('Initial update check skipped');
      });
    }, 3000);
  }
` : ''}  app.on('activate', () => {
${useDiagnosticsTimeline ? "    pushDiagnosticsTimelineEvent('app', 'activate');\n" : ''}    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
${useDiagnosticsTimeline ? "  pushDiagnosticsTimelineEvent('app', 'window-all-closed');\n" : ''}  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
${useDiagnosticsTimeline ? "  pushDiagnosticsTimelineEvent('app', 'before-quit');\n" : ''}${useWindowing ? '  if (mainWindow && !mainWindow.isDestroyed()) {\n    void saveWindowState(mainWindow);\n  }\n' : ''}${useTray ? '  appTray?.destroy();\n' : ''}${useGlobalShortcut ? '  globalShortcut.unregister(starterShortcutAccelerator);\n' : ''}${useUpdater ? '  updater.dispose();\n' : ''}${useJobs ? '  jobEngine.dispose();\n' : '  workerClient.dispose();\n'}});
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
  const useGlobalShortcut = features.includes('global-shortcut');
  const useFileAssociation = features.includes('file-association');
  const useFileDialogs = features.includes('file-dialogs');
  const useRecentFiles = features.includes('recent-files');
  const useCrashRecovery = features.includes('crash-recovery');
  const usePowerMonitor = features.includes('power-monitor');
  const useIdlePresence = features.includes('idle-presence');
  const useSessionState = features.includes('session-state');
  const useDownloads = features.includes('downloads');
  const useClipboard = features.includes('clipboard');
  const useExternalLinks = features.includes('external-links');
  const useSystemInfo = features.includes('system-info');
  const usePermissions = features.includes('permissions');
  const useNetworkStatus = features.includes('network-status');
  const useSecureStorage = features.includes('secure-storage');
  const useSupportBundle = features.includes('support-bundle');
  const useLogArchive = features.includes('log-archive');
  const useIncidentReport = features.includes('incident-report');
  const useDiagnosticsTimeline = features.includes('diagnostics-timeline');

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
` : ''}${useSystemInfo ? `  systemInfo: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_INFO_GET_STATE),
  },
` : ''}${usePermissions ? `  permissions: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_GET_STATE),
    request: (kind: 'camera' | 'microphone') => ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_REQUEST, kind),
  },
` : ''}${useNetworkStatus ? `  networkStatus: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORK_STATUS_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORK_STATUS_CLEAR_HISTORY),
  },
` : ''}${useSecureStorage ? `  secureStorage: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE_GET_STATE),
    save: (label?: string, value?: string) => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE_SAVE, label, value),
    load: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE_LOAD),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE_CLEAR),
  },
` : ''}${useSupportBundle ? `  supportBundle: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.SUPPORT_BUNDLE_GET_STATE),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.SUPPORT_BUNDLE_EXPORT),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.SUPPORT_BUNDLE_REVEAL),
  },
` : ''}${useLogArchive ? `  logArchive: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_ARCHIVE_GET_STATE),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_ARCHIVE_EXPORT),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_ARCHIVE_REVEAL),
  },
` : ''}${useIncidentReport ? `  incidentReport: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.INCIDENT_REPORT_GET_STATE),
    export: (draft?: unknown) => ipcRenderer.invoke(IPC_CHANNELS.INCIDENT_REPORT_EXPORT, draft),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.INCIDENT_REPORT_REVEAL),
  },
` : ''}${useDiagnosticsTimeline ? `  diagnosticsTimeline: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_GET_STATE),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_EXPORT),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_REVEAL),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_CLEAR_HISTORY),
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
` : ''}${useGlobalShortcut ? `  globalShortcut: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GLOBAL_SHORTCUT_GET_STATUS),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.GLOBAL_SHORTCUT_SET_ENABLED, enabled),
    trigger: () => ipcRenderer.invoke(IPC_CHANNELS.GLOBAL_SHORTCUT_TRIGGER),
  },
` : ''}${useFileAssociation ? `  fileAssociation: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_GET_STATE),
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_OPEN, filePath),
  },
` : ''}${useFileDialogs ? `  fileDialogs: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_GET_STATE),
    open: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_OPEN, defaultPath),
    save: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_SAVE, defaultPath),
    reveal: (targetPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_REVEAL, targetPath),
  },
` : ''}${useRecentFiles ? `  recentFiles: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_GET_STATE),
    add: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_ADD, filePath),
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_OPEN, filePath),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_CLEAR),
  },
` : ''}${useCrashRecovery ? `  crashRecovery: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_GET_STATE),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_CLEAR),
    relaunch: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_RELAUNCH),
  },
` : ''}${usePowerMonitor ? `  powerMonitor: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.POWER_MONITOR_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.POWER_MONITOR_CLEAR_HISTORY),
  },
` : ''}${useIdlePresence ? `  idlePresence: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.IDLE_PRESENCE_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.IDLE_PRESENCE_CLEAR_HISTORY),
  },
` : ''}${useSessionState ? `  sessionState: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_STATE_GET),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_STATE_CLEAR_HISTORY),
  },
` : ''}${useDownloads ? `  downloads: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_GET_STATE),
    start: (url?: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_START, url),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_CLEAR_HISTORY),
    reveal: (targetPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_REVEAL, targetPath),
  },
` : ''}${useClipboard ? `  clipboard: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET_STATE),
    readText: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_READ_TEXT),
    writeText: (text?: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, text),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CLEAR),
  },
` : ''}${useExternalLinks ? `  externalLinks: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.EXTERNAL_LINKS_GET_STATE),
    open: (url?: string) => ipcRenderer.invoke(IPC_CHANNELS.EXTERNAL_LINKS_OPEN, url),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.EXTERNAL_LINKS_CLEAR_HISTORY),
  },
` : ''}};

contextBridge.exposeInMainWorld('api', Object.freeze(api));

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
  const useGlobalShortcut = features.includes('global-shortcut');
  const useFileAssociation = features.includes('file-association');
  const useFileDialogs = features.includes('file-dialogs');
  const useRecentFiles = features.includes('recent-files');
  const useCrashRecovery = features.includes('crash-recovery');
  const usePowerMonitor = features.includes('power-monitor');
  const useIdlePresence = features.includes('idle-presence');
  const useSessionState = features.includes('session-state');
  const useDownloads = features.includes('downloads');
  const useClipboard = features.includes('clipboard');
  const useExternalLinks = features.includes('external-links');
  const useSystemInfo = features.includes('system-info');
  const usePermissions = features.includes('permissions');
  const useNetworkStatus = features.includes('network-status');
  const useSecureStorage = features.includes('secure-storage');
  const useSupportBundle = features.includes('support-bundle');
  const useLogArchive = features.includes('log-archive');
  const useIncidentReport = features.includes('incident-report');
  const useDiagnosticsTimeline = features.includes('diagnostics-timeline');
  const displayName = resolveProductName(projectName, metadata);
  const protocolScheme = `${toIdentifier(projectName)}`;
  const fileAssociationExtension = `${toIdentifier(projectName)}doc`;
  const dialogSuggestedName = `${toIdentifier(projectName)}-document.txt`;

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

type SystemInfoState = {
  refreshedAt: string;
  runtime: {
    appName: string;
    appVersion: string;
    isPackaged: boolean;
    electronVersion: string;
    chromeVersion: string;
    nodeVersion: string;
  };
  os: {
    platform: string;
    arch: string;
    hostname: string;
    release: string;
    uptimeMinutes: number;
    cpuModel: string;
    cpuCores: number;
    loadAverage: number[];
    totalMemoryMb: number;
    freeMemoryMb: number;
  };
  process: {
    pid: number;
    processCount: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  paths: {
    appPath: string;
    userDataPath: string;
    tempPath: string;
    downloadsPath: string;
    logsPath: string;
  };
};

type PermissionsState = {
  platform: string;
  camera: {
    status: string;
    supported: boolean;
    canRequest: boolean;
  };
  microphone: {
    status: string;
    supported: boolean;
    canRequest: boolean;
  };
  screen: {
    status: string;
    supported: boolean;
    canRequest: boolean;
  };
  lastRequest: {
    kind: 'camera' | 'microphone' | null;
    granted: boolean | null;
    timestamp: string | null;
    error: string | null;
  };
};

type NetworkStatusState = {
  supported: boolean;
  online: boolean;
  status: 'online' | 'offline';
  checkCount: number;
  lastCheckedAt: string | null;
  history: Array<{
    online: boolean;
    status: 'online' | 'offline';
    timestamp: string;
  }>;
};

type SecureStorageState = {
  supported: boolean;
  label: string | null;
  hasStoredValue: boolean;
  lastUpdatedAt: string | null;
  lastLoadedValue: string | null;
  lastError: string | null;
};

type SupportBundleState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  lastSizeBytes: number | null;
  exportCount: number;
  includedSections: string[];
  lastError: string | null;
};

type LogArchiveFileEntry = {
  name: string;
  sourcePath: string;
  sizeBytes: number;
  modifiedAt: string;
};

type LogArchiveState = {
  logsPath: string;
  archiveDirectoryPath: string;
  fileCount: number;
  totalBytes: number;
  files: LogArchiveFileEntry[];
  lastArchivePath: string | null;
  lastArchivedAt: string | null;
  archiveCount: number;
  lastError: string | null;
};

type IncidentReportSeverity = 'low' | 'medium' | 'high' | 'critical';

type IncidentReportDraft = {
  title: string;
  severity: IncidentReportSeverity;
  affectedArea: string;
  summary: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  recommendedAction: string;
  notes: string;
};

type IncidentReportState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  exportCount: number;
  lastError: string | null;
  currentDraft: IncidentReportDraft;
};

type DiagnosticsTimelineEntry = {
  id: string;
  category: 'app' | 'window' | 'support';
  event: string;
  detail: string | null;
  timestamp: string;
};

type DiagnosticsTimelineState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastExportedAt: string | null;
  eventCount: number;
  lastEventAt: string | null;
  lastError: string | null;
  entries: DiagnosticsTimelineEntry[];
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

type GlobalShortcutState = {
  accelerator: string;
  enabled: boolean;
  registered: boolean;
  lastTriggeredAt: string | null;
  error: string | null;
};

type FileAssociationState = {
  extension: string;
  lastPath: string | null;
  source: string | null;
};

type FileDialogState = {
  suggestedName: string;
  lastOpenPath: string | null;
  lastSavePath: string | null;
  lastRevealPath: string | null;
  lastAction: 'open' | 'save' | 'reveal' | null;
};

type RecentFilesState = {
  limit: number;
  items: string[];
  lastOpenedPath: string | null;
};

type CrashRecoveryState = {
  hasIncident: boolean;
  lastIncident: {
    scope: 'renderer' | 'window' | 'child-process';
    reason: string;
    details: string | null;
    timestamp: string;
  } | null;
};

type PowerMonitorState = {
  supported: boolean;
  powerSource: 'ac' | 'battery' | 'unknown';
  idleState: 'active' | 'idle' | 'locked' | 'unknown';
  idleTimeSeconds: number;
  lastEvent: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery' | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{
    name: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery';
    timestamp: string;
  }>;
};

type IdlePresenceState = {
  supported: boolean;
  idleState: 'active' | 'idle' | 'locked' | 'unknown';
  idleTimeSeconds: number;
  thresholdSeconds: number;
  attention: 'focused' | 'visible' | 'hidden' | 'no-window';
  lastSampledAt: string | null;
  lastChangedAt: string | null;
  sampleCount: number;
  history: Array<{
    idleState: 'active' | 'idle' | 'locked' | 'unknown';
    idleTimeSeconds: number;
    attention: 'focused' | 'visible' | 'hidden' | 'no-window';
    timestamp: string;
  }>;
};

type SessionStateSnapshot = {
  startedAt: string;
  lifecycle: 'ready' | 'active' | 'background' | 'hidden' | 'quitting';
  attention: 'focused' | 'visible' | 'hidden' | 'no-window';
  windowCount: number;
  visibleWindowCount: number;
  focusedWindowCount: number;
  lastEvent: 'ready' | 'activate' | 'browser-window-focus' | 'browser-window-blur' | 'show' | 'hide' | 'before-quit' | 'window-all-closed' | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{
    name: 'ready' | 'activate' | 'browser-window-focus' | 'browser-window-blur' | 'show' | 'hide' | 'before-quit' | 'window-all-closed';
    timestamp: string;
    detail: string | null;
  }>;
};

type DownloadsState = {
  sampleUrl: string;
  activeCount: number;
  lastDownloadPath: string | null;
  items: Array<{
    id: string;
    url: string;
    fileName: string;
    savePath: string | null;
    state: 'idle' | 'progressing' | 'completed' | 'cancelled' | 'interrupted';
    receivedBytes: number;
    totalBytes: number;
    startedAt: string;
    finishedAt: string | null;
  }>;
};

type ClipboardState = {
  currentText: string;
  lastAction: 'read' | 'write' | 'clear' | null;
  history: Array<{
    action: 'read' | 'write' | 'clear';
    text: string;
    timestamp: string;
  }>;
};

type ExternalLinksState = {
  defaultUrl: string;
  lastUrl: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  lastError: string | null;
  history: Array<{
    url: string;
    status: 'opened' | 'failed';
    error: string | null;
    timestamp: string;
  }>;
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
  systemInfo?: {
    getState: () => Promise<SystemInfoState>;
  };
  permissions?: {
    getState: () => Promise<PermissionsState>;
    request: (kind: 'camera' | 'microphone') => Promise<PermissionsState>;
  };
  networkStatus?: {
    getState: () => Promise<NetworkStatusState>;
    clearHistory: () => Promise<NetworkStatusState>;
  };
  secureStorage?: {
    getState: () => Promise<SecureStorageState>;
    save: (label?: string, value?: string) => Promise<SecureStorageState>;
    load: () => Promise<SecureStorageState>;
    clear: () => Promise<SecureStorageState>;
  };
  supportBundle?: {
    getState: () => Promise<SupportBundleState>;
    export: () => Promise<SupportBundleState>;
    reveal: () => Promise<SupportBundleState>;
  };
  logArchive?: {
    getState: () => Promise<LogArchiveState>;
    export: () => Promise<LogArchiveState>;
    reveal: () => Promise<LogArchiveState>;
  };
  incidentReport?: {
    getState: () => Promise<IncidentReportState>;
    export: (draft?: IncidentReportDraft) => Promise<IncidentReportState>;
    reveal: () => Promise<IncidentReportState>;
  };
  diagnosticsTimeline?: {
    getState: () => Promise<DiagnosticsTimelineState>;
    export: () => Promise<DiagnosticsTimelineState>;
    reveal: () => Promise<DiagnosticsTimelineState>;
    clearHistory: () => Promise<DiagnosticsTimelineState>;
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
  globalShortcut?: {
    getStatus: () => Promise<GlobalShortcutState>;
    setEnabled: (enabled: boolean) => Promise<GlobalShortcutState>;
    trigger: () => Promise<GlobalShortcutState>;
  };
  fileAssociation?: {
    getState: () => Promise<FileAssociationState>;
    open: (filePath: string) => Promise<FileAssociationState>;
  };
  fileDialogs?: {
    getState: () => Promise<FileDialogState>;
    open: (defaultPath?: string) => Promise<FileDialogState>;
    save: (defaultPath?: string) => Promise<FileDialogState>;
    reveal: (targetPath?: string) => Promise<FileDialogState>;
  };
  recentFiles?: {
    getState: () => Promise<RecentFilesState>;
    add: (filePath: string) => Promise<RecentFilesState>;
    open: (filePath: string) => Promise<RecentFilesState>;
    clear: () => Promise<RecentFilesState>;
  };
  crashRecovery?: {
    getState: () => Promise<CrashRecoveryState>;
    clear: () => Promise<CrashRecoveryState>;
    relaunch: () => Promise<CrashRecoveryState & { relaunching?: boolean }>;
  };
  powerMonitor?: {
    getState: () => Promise<PowerMonitorState>;
    clearHistory: () => Promise<PowerMonitorState>;
  };
  idlePresence?: {
    getState: () => Promise<IdlePresenceState>;
    clearHistory: () => Promise<IdlePresenceState>;
  };
  sessionState?: {
    getState: () => Promise<SessionStateSnapshot>;
    clearHistory: () => Promise<SessionStateSnapshot>;
  };
  downloads?: {
    getState: () => Promise<DownloadsState>;
    start: (url?: string) => Promise<DownloadsState>;
    clearHistory: () => Promise<DownloadsState>;
    reveal: (targetPath?: string) => Promise<DownloadsState>;
  };
  clipboard?: {
    getState: () => Promise<ClipboardState>;
    readText: () => Promise<ClipboardState>;
    writeText: (text?: string) => Promise<ClipboardState>;
    clear: () => Promise<ClipboardState>;
  };
  externalLinks?: {
    getState: () => Promise<ExternalLinksState>;
    open: (url?: string) => Promise<ExternalLinksState>;
    clearHistory: () => Promise<ExternalLinksState>;
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
` : ''}${useSystemInfo ? `  const [systemInfoState, setSystemInfoState] = useState<SystemInfoState | null>(null);
` : ''}${usePermissions ? `  const [permissionsState, setPermissionsState] = useState<PermissionsState | null>(null);
` : ''}${useNetworkStatus ? `  const [networkStatusState, setNetworkStatusState] = useState<NetworkStatusState | null>(null);
` : ''}${useSecureStorage ? `  const [secureStorageState, setSecureStorageState] = useState<SecureStorageState | null>(null);
  const [secureStorageLabelDraft, setSecureStorageLabelDraft] = useState('api-token');
  const [secureStorageValueDraft, setSecureStorageValueDraft] = useState('${displayName} demo secret');
` : ''}${useSupportBundle ? `  const [supportBundleState, setSupportBundleState] = useState<SupportBundleState | null>(null);
` : ''}${useLogArchive ? `  const [logArchiveState, setLogArchiveState] = useState<LogArchiveState | null>(null);
` : ''}${useIncidentReport ? `  const [incidentReportState, setIncidentReportState] = useState<IncidentReportState | null>(null);
  const [incidentReportDraft, setIncidentReportDraft] = useState<IncidentReportDraft>({
    title: '${displayName} desktop issue',
    severity: 'medium',
    affectedArea: 'desktop-shell',
    summary: 'Customer-facing issue observed in the packaged desktop flow.',
    stepsToReproduce: '1. Launch the app\\n2. Navigate to the affected workflow\\n3. Capture the incorrect behavior',
    expectedBehavior: 'The workflow should complete without a shell or runtime issue.',
    actualBehavior: 'The desktop shell or runtime produced an unexpected result.',
    recommendedAction: 'Attach support bundle and logs, then triage with product and QA owners.',
    notes: '',
  });
` : ''}${useDiagnosticsTimeline ? `  const [diagnosticsTimelineState, setDiagnosticsTimelineState] = useState<DiagnosticsTimelineState | null>(null);
` : ''}${useNotifications ? `  const [notificationDraft, setNotificationDraft] = useState({ title: 'Forge Ready', body: '${displayName} is ready for customer testing.' });
  const [notificationState, setNotificationState] = useState<'idle' | 'sent' | 'unsupported'>('idle');
` : ''}${useWindowing ? `  const [windowState, setWindowState] = useState<WindowStateSummary | null>(null);
` : ''}${useTray ? `  const [trayStatus, setTrayStatus] = useState<TrayStatus | null>(null);
` : ''}${useMenuBar ? `  const [menuBarState, setMenuBarState] = useState<MenuBarState | null>(null);
` : ''}${useAutoLaunch ? `  const [autoLaunchState, setAutoLaunchState] = useState<AutoLaunchState | null>(null);
` : ''}${useGlobalShortcut ? `  const [globalShortcutState, setGlobalShortcutState] = useState<GlobalShortcutState | null>(null);
` : ''}${useFileAssociation ? `  const [fileAssociationState, setFileAssociationState] = useState<FileAssociationState | null>(null);
  const [fileAssociationDraft, setFileAssociationDraft] = useState('sample.${fileAssociationExtension}');
` : ''}${useFileDialogs ? `  const [fileDialogState, setFileDialogState] = useState<FileDialogState | null>(null);
  const [fileDialogDraft, setFileDialogDraft] = useState('${dialogSuggestedName}');
` : ''}${useRecentFiles ? `  const [recentFilesState, setRecentFilesState] = useState<RecentFilesState | null>(null);
  const [recentFileDraft, setRecentFileDraft] = useState('${dialogSuggestedName}');
` : ''}${useCrashRecovery ? `  const [crashRecoveryState, setCrashRecoveryState] = useState<CrashRecoveryState | null>(null);
` : ''}${usePowerMonitor ? `  const [powerMonitorState, setPowerMonitorState] = useState<PowerMonitorState | null>(null);
` : ''}${useIdlePresence ? `  const [idlePresenceState, setIdlePresenceState] = useState<IdlePresenceState | null>(null);
` : ''}${useSessionState ? `  const [sessionStateSnapshot, setSessionStateSnapshot] = useState<SessionStateSnapshot | null>(null);
` : ''}${useDownloads ? `  const [downloadsState, setDownloadsState] = useState<DownloadsState | null>(null);
  const [downloadUrlDraft, setDownloadUrlDraft] = useState('https://raw.githubusercontent.com/electron/electron/main/README.md');
` : ''}${useClipboard ? `  const [clipboardState, setClipboardState] = useState<ClipboardState | null>(null);
  const [clipboardDraft, setClipboardDraft] = useState('${displayName} ready for desktop copy and paste flows.');
` : ''}${useExternalLinks ? `  const [externalLinksState, setExternalLinksState] = useState<ExternalLinksState | null>(null);
  const [externalLinkDraft, setExternalLinkDraft] = useState('https://www.electronjs.org');
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
` : ''}${useSupportBundle ? `
  useEffect(() => {
    refreshSupportBundle(api, setSupportBundleState);
  }, [api]);
` : ''}${useLogArchive ? `
  useEffect(() => {
    refreshLogArchive(api, setLogArchiveState);
  }, [api]);
` : ''}${useIncidentReport ? `
  useEffect(() => {
    refreshIncidentReport(api, setIncidentReportState, setIncidentReportDraft);
  }, [api]);
` : ''}${useDiagnosticsTimeline ? `
  useEffect(() => {
    refreshDiagnosticsTimeline(api, setDiagnosticsTimelineState);
  }, [api]);
` : ''}${useSystemInfo ? `
  useEffect(() => {
    if (!api?.systemInfo?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.systemInfo?.getState?.();
        if (active && next) {
          setSystemInfoState(next);
        }
      } catch {
        // Ignore starter system-info polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${usePermissions ? `
  useEffect(() => {
    if (!api?.permissions?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.permissions?.getState?.();
        if (active && next) {
          setPermissionsState(next);
        }
      } catch {
        // Ignore starter permissions polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useNetworkStatus ? `
  useEffect(() => {
    if (!api?.networkStatus?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.networkStatus?.getState?.();
        if (active && next) {
          setNetworkStatusState(next);
        }
      } catch {
        // Ignore starter network-status polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useSecureStorage ? `
  useEffect(() => {
    if (!api?.secureStorage?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.secureStorage?.getState?.();
        if (active && next) {
          setSecureStorageState(next);
          if (next.label) {
            setSecureStorageLabelDraft(next.label);
          }
        }
      } catch {
        // Ignore starter secure-storage polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
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
` : ''}${useGlobalShortcut ? `
  useEffect(() => {
    api?.globalShortcut?.getStatus?.().then((next) => {
      setGlobalShortcutState(next);
    }).catch(() => {});
  }, [api]);
` : ''}${useFileAssociation ? `
  useEffect(() => {
    api?.fileAssociation?.getState?.().then((next) => {
      setFileAssociationState(next);
    }).catch(() => {});
  }, [api]);
` : ''}${useFileDialogs ? `
  useEffect(() => {
    api?.fileDialogs?.getState?.().then((next) => {
      setFileDialogState(next);
      if (next?.suggestedName) {
        setFileDialogDraft(next.suggestedName);
      }
    }).catch(() => {});
  }, [api]);
` : ''}${useRecentFiles ? `
  useEffect(() => {
    if (!api?.recentFiles?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.recentFiles?.getState?.();
        if (active && next) {
          setRecentFilesState(next);
          if (next.items[0]) {
            setRecentFileDraft(next.items[0]);
          }
        }
      } catch {
        // Ignore starter recent-files polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useCrashRecovery ? `
  useEffect(() => {
    if (!api?.crashRecovery?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.crashRecovery?.getState?.();
        if (active && next) {
          setCrashRecoveryState(next);
        }
      } catch {
        // Ignore starter crash-recovery polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${usePowerMonitor ? `
  useEffect(() => {
    if (!api?.powerMonitor?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.powerMonitor?.getState?.();
        if (active && next) {
          setPowerMonitorState(next);
        }
      } catch {
        // Ignore starter power-monitor polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useIdlePresence ? `
  useEffect(() => {
    if (!api?.idlePresence?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api?.idlePresence?.getState?.();
        if (active && next) {
          setIdlePresenceState(next);
        }
      } catch {
        // Ignore starter idle-presence polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useSessionState ? `
  useEffect(() => {
    if (!api?.sessionState?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api?.sessionState?.getState?.();
        if (active && next) {
          setSessionStateSnapshot(next);
        }
      } catch {
        // Ignore starter session-state polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useDownloads ? `
  useEffect(() => {
    if (!api?.downloads?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.downloads?.getState?.();
        if (active && next) {
          setDownloadsState(next);
          setDownloadUrlDraft(next.sampleUrl);
        }
      } catch {
        // Ignore starter downloads polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useClipboard ? `
  useEffect(() => {
    if (!api?.clipboard?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.clipboard?.getState?.();
        if (active && next) {
          setClipboardState(next);
        }
      } catch {
        // Ignore starter clipboard polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
` : ''}${useExternalLinks ? `
  useEffect(() => {
    if (!api?.externalLinks?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.externalLinks?.getState?.();
        if (active && next) {
          setExternalLinksState(next);
          setExternalLinkDraft(next.defaultUrl);
        }
      } catch {
        // Ignore starter external-links polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
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
` : ''}${useSupportBundle ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Support Bundle</h3>
              <p className="mt-1 text-xs text-slate-400">Export structured runtime evidence into a single JSON handoff and reveal the last bundle in Finder without wiring a custom support tool first.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportSupportBundleFromStudio(api, setSupportBundleState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealSupportBundleFromStudio(api, setSupportBundleState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
            </div>
          </div>
          {supportBundleState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Bundle Folder" value={supportBundleState.directoryPath} />
                <DiagnosticRow label="Exports" value={String(supportBundleState.exportCount)} />
                <DiagnosticRow label="Last Export" value={supportBundleState.lastExportPath ?? 'Not exported yet'} />
                <DiagnosticRow label="Generated" value={supportBundleState.lastGeneratedAt ?? 'Not exported yet'} />
                <DiagnosticRow label="Bundle Size" value={supportBundleState.lastSizeBytes ? \`\${supportBundleState.lastSizeBytes} bytes\` : 'Unknown'} />
                <DiagnosticRow label="Last Error" value={supportBundleState.lastError ?? 'none'} />
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Included sections: <span className="text-white">{supportBundleState.includedSections.length > 0 ? supportBundleState.includedSections.join(', ') : 'runtime'}</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Support bundle state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
` : ''}${useLogArchive ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Log Archive</h3>
              <p className="mt-1 text-xs text-slate-400">Snapshot the runtime logs directory into a timestamped handoff folder so QA and support can attach real desktop evidence without opening the app bundle by hand.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshLogArchive(api, setLogArchiveState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => exportLogArchiveFromStudio(api, setLogArchiveState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealLogArchiveFromStudio(api, setLogArchiveState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
            </div>
          </div>
          {logArchiveState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Logs Folder" value={logArchiveState.logsPath} />
                <DiagnosticRow label="Archive Folder" value={logArchiveState.archiveDirectoryPath} />
                <DiagnosticRow label="Log Files" value={String(logArchiveState.fileCount)} />
                <DiagnosticRow label="Bytes" value={String(logArchiveState.totalBytes)} />
                <DiagnosticRow label="Last Archive" value={logArchiveState.lastArchivePath ?? 'Not archived yet'} />
                <DiagnosticRow label="Archived At" value={logArchiveState.lastArchivedAt ?? 'Not archived yet'} />
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Archive exports: <span className="text-white">{logArchiveState.archiveCount}</span>
                {' · '}
                Last error: <span className="text-white">{logArchiveState.lastError ?? 'none'}</span>
              </div>
              <div className="mt-3 space-y-2">
                {logArchiveState.files.length === 0 ? (
                  <p className="text-xs text-slate-500">No log files were found yet. Generate activity in the app and refresh to inspect the runtime logs folder.</p>
                ) : (
                  logArchiveState.files.map((entry) => (
                    <div key={entry.sourcePath} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white">{entry.name}</span>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{entry.sizeBytes} bytes</span>
                      </div>
                      <p className="mt-1 break-all text-xs text-slate-500">{entry.sourcePath}</p>
                      <p className="mt-1 text-xs text-slate-500">Modified {entry.modifiedAt}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Log archive state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
` : ''}${useIncidentReport ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Incident Report</h3>
              <p className="mt-1 text-xs text-slate-400">Draft a support-ready desktop escalation with severity, summary, repro steps, and recommended action, then export the handoff JSON into the support folder.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshIncidentReport(api, setIncidentReportState, setIncidentReportDraft)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => exportIncidentReportFromStudio(api, incidentReportDraft, setIncidentReportState, setIncidentReportDraft)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealIncidentReportFromStudio(api, setIncidentReportState, setIncidentReportDraft)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-400">
              <span className="uppercase tracking-[0.18em] text-slate-500">Title</span>
              <input
                value={incidentReportDraft.title}
                onChange={(event) => setIncidentReportDraft((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span className="uppercase tracking-[0.18em] text-slate-500">Severity</span>
              <select
                value={incidentReportDraft.severity}
                onChange={(event) => setIncidentReportDraft((current) => ({ ...current, severity: event.target.value as IncidentReportSeverity }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400 md:col-span-2">
              <span className="uppercase tracking-[0.18em] text-slate-500">Affected Area</span>
              <input
                value={incidentReportDraft.affectedArea}
                onChange={(event) => setIncidentReportDraft((current) => ({ ...current, affectedArea: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
              />
            </label>
            <TextAreaField label="Summary" value={incidentReportDraft.summary} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, summary: value }))} />
            <TextAreaField label="Steps To Reproduce" value={incidentReportDraft.stepsToReproduce} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, stepsToReproduce: value }))} />
            <TextAreaField label="Expected Behavior" value={incidentReportDraft.expectedBehavior} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, expectedBehavior: value }))} />
            <TextAreaField label="Actual Behavior" value={incidentReportDraft.actualBehavior} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, actualBehavior: value }))} />
            <TextAreaField label="Recommended Action" value={incidentReportDraft.recommendedAction} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, recommendedAction: value }))} />
            <TextAreaField label="Notes" value={incidentReportDraft.notes} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, notes: value }))} />
          </div>
          {incidentReportState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Report Folder" value={incidentReportState.directoryPath} />
                <DiagnosticRow label="Exports" value={String(incidentReportState.exportCount)} />
                <DiagnosticRow label="Last Export" value={incidentReportState.lastExportPath ?? 'Not exported yet'} />
                <DiagnosticRow label="Generated" value={incidentReportState.lastGeneratedAt ?? 'Not exported yet'} />
                <DiagnosticRow label="Last Error" value={incidentReportState.lastError ?? 'none'} />
                <DiagnosticRow label="Severity" value={incidentReportState.currentDraft.severity} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Incident report state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
` : ''}${useDiagnosticsTimeline ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Diagnostics Timeline</h3>
              <p className="mt-1 text-xs text-slate-400">Capture a support-ready desktop event history with export, reveal, and clear controls so investigations can start from a structured shell timeline.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshDiagnosticsTimeline(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => exportDiagnosticsTimelineFromStudio(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealDiagnosticsTimelineFromStudio(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
              <button
                onClick={() => clearDiagnosticsTimelineFromStudio(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-400 hover:text-rose-100"
              >
                Clear
              </button>
            </div>
          </div>
          {diagnosticsTimelineState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Timeline Folder" value={diagnosticsTimelineState.directoryPath} />
                <DiagnosticRow label="Events" value={String(diagnosticsTimelineState.eventCount)} />
                <DiagnosticRow label="Last Event" value={diagnosticsTimelineState.lastEventAt ?? 'not recorded yet'} />
                <DiagnosticRow label="Last Export" value={diagnosticsTimelineState.lastExportPath ?? 'not exported yet'} />
                <DiagnosticRow label="Exported At" value={diagnosticsTimelineState.lastExportedAt ?? 'not exported yet'} />
                <DiagnosticRow label="Last Error" value={diagnosticsTimelineState.lastError ?? 'none'} />
              </div>
              <div className="mt-3 space-y-2">
                {diagnosticsTimelineState.entries.length ? diagnosticsTimelineState.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.category}</span>
                      <span className="text-xs text-slate-500">{entry.timestamp}</span>
                    </div>
                    <p className="mt-2 text-sm text-white">{entry.event}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{entry.detail ?? 'no detail'}</p>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500">No timeline events yet. Launch, focus, export support data, or reopen the window to seed the starter diagnostics timeline.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Diagnostics timeline state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
` : ''}${useSystemInfo ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">System Info</h3>
              <p className="mt-1 text-xs text-slate-400">Inspect live runtime, OS, memory, and path details so teams can debug real desktop environments without wiring a custom shell panel first.</p>
            </div>
            <button
              onClick={() => refreshSystemInfo(api, setSystemInfoState)}
              className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
            >
              Refresh
            </button>
          </div>
          {systemInfoState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="App" value={\`\${systemInfoState.runtime.appName} \${systemInfoState.runtime.appVersion}\`} />
                <DiagnosticRow label="Runtime" value={systemInfoState.runtime.isPackaged ? 'packaged' : 'development'} />
                <DiagnosticRow label="Platform" value={\`\${systemInfoState.os.platform} / \${systemInfoState.os.arch}\`} />
                <DiagnosticRow label="Host" value={systemInfoState.os.hostname} />
                <DiagnosticRow label="OS Release" value={systemInfoState.os.release} />
                <DiagnosticRow label="Uptime" value={\`\${systemInfoState.os.uptimeMinutes} minutes\`} />
                <DiagnosticRow label="CPU" value={\`\${systemInfoState.os.cpuModel} (\${systemInfoState.os.cpuCores} cores)\`} />
                <DiagnosticRow label="Load Average" value={systemInfoState.os.loadAverage.join(' / ')} />
                <DiagnosticRow label="Memory Free / Total" value={\`\${systemInfoState.os.freeMemoryMb} MB / \${systemInfoState.os.totalMemoryMb} MB\`} />
                <DiagnosticRow label="RSS / Heap Used" value={\`\${systemInfoState.process.rssMb} MB / \${systemInfoState.process.heapUsedMb} MB\`} />
                <DiagnosticRow label="Heap Total / Processes" value={\`\${systemInfoState.process.heapTotalMb} MB / \${systemInfoState.process.processCount}\`} />
                <DiagnosticRow label="PID / Refreshed" value={\`\${systemInfoState.process.pid} / \${systemInfoState.refreshedAt}\`} />
                <DiagnosticRow label="App Path" value={systemInfoState.paths.appPath} />
                <DiagnosticRow label="User Data" value={systemInfoState.paths.userDataPath} />
                <DiagnosticRow label="Downloads" value={systemInfoState.paths.downloadsPath} />
                <DiagnosticRow label="Logs" value={systemInfoState.paths.logsPath} />
                <DiagnosticRow label="Temp" value={systemInfoState.paths.tempPath} />
                <DiagnosticRow label="Electron / Node" value={\`\${systemInfoState.runtime.electronVersion} / \${systemInfoState.runtime.nodeVersion}\`} />
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Chrome version: <span className="text-white">{systemInfoState.runtime.chromeVersion}</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">System info is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
` : ''}${usePermissions ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Permissions</h3>
              <p className="mt-1 text-xs text-slate-400">Inspect desktop privacy status for camera, microphone, and screen recording so starter apps can surface environment blockers before capture or call flows begin.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshPermissions(api, setPermissionsState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Refresh
              </button>
              <button
                onClick={() => requestPermissionAccess(api, 'camera', setPermissionsState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Request camera
              </button>
              <button
                onClick={() => requestPermissionAccess(api, 'microphone', setPermissionsState)}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
              >
                Request mic
              </button>
            </div>
          </div>
          {permissionsState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Platform" value={permissionsState.platform} />
                <DiagnosticRow label="Camera" value={formatPermissionEntry(permissionsState.camera)} />
                <DiagnosticRow label="Microphone" value={formatPermissionEntry(permissionsState.microphone)} />
                <DiagnosticRow label="Screen Recording" value={formatPermissionEntry(permissionsState.screen)} />
                <DiagnosticRow label="Last Request" value={permissionsState.lastRequest.kind ?? 'no prompt requested yet'} />
                <DiagnosticRow label="Last Result" value={permissionsState.lastRequest.granted === null ? 'not available' : permissionsState.lastRequest.granted ? 'granted' : 'denied'} />
                <DiagnosticRow label="Last Request At" value={permissionsState.lastRequest.timestamp ?? 'not available'} />
                <DiagnosticRow label="Starter Scope" value="camera + microphone prompts on macOS, read-only elsewhere" />
              </div>
              {permissionsState.lastRequest.error && (
                <p className="mt-2 text-xs text-amber-200">{permissionsState.lastRequest.error}</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Permission state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
` : ''}${useNetworkStatus ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Network Status</h3>
              <p className="mt-1 text-xs text-slate-400">Inspect online or offline state from the desktop shell so teams can harden retry, sync, and degraded-mode UX before wiring their own diagnostics surface.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshNetworkStatus(api, setNetworkStatusState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => clearNetworkStatus(api, setNetworkStatusState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          {networkStatusState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Supported" value={networkStatusState.supported ? 'yes' : 'fallback only'} />
                <DiagnosticRow label="Status" value={networkStatusState.status} />
                <DiagnosticRow label="Online" value={networkStatusState.online ? 'yes' : 'no'} />
                <DiagnosticRow label="Check Count" value={String(networkStatusState.checkCount)} />
                <DiagnosticRow label="Last Checked" value={networkStatusState.lastCheckedAt ?? 'not checked yet'} />
                <DiagnosticRow label="Surface" value="electron net.isOnline starter probe" />
              </div>
              <div className="mt-3 space-y-2">
                {networkStatusState.history.length ? networkStatusState.history.map((entry) => (
                  <div key={entry.timestamp} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.status}</span>
                    <span className="text-xs text-slate-500">{entry.timestamp}</span>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500">No network checks recorded yet. Refresh to seed a starter online or offline history.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Network status is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
` : ''}${useSecureStorage ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Secure Storage</h3>
              <p className="mt-1 text-xs text-slate-400">Persist encrypted starter secrets through Electron safeStorage so teams can validate desktop credential handling before wiring their own vault UI.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshSecureStorage(api, setSecureStorageState, setSecureStorageLabelDraft)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Refresh
              </button>
              <button
                onClick={() => clearSecureStorage(api, setSecureStorageState, setSecureStorageLabelDraft)}
                className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-400 hover:text-rose-100"
              >
                Clear secret
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Secret label
              <input
                type="text"
                value={secureStorageLabelDraft}
                onChange={(event) => setSecureStorageLabelDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Secret value
              <textarea
                value={secureStorageValueDraft}
                onChange={(event) => setSecureStorageValueDraft(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => saveSecureStorage(api, secureStorageLabelDraft, secureStorageValueDraft, setSecureStorageState, setSecureStorageLabelDraft)}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
              >
                Save secret
              </button>
              <button
                onClick={() => loadSecureStorage(api, setSecureStorageState, setSecureStorageLabelDraft)}
                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
              >
                Load secret
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Supported" value={secureStorageState?.supported ? 'yes' : 'no'} />
              <DiagnosticRow label="Stored Label" value={secureStorageState?.label ?? 'nothing saved yet'} />
              <DiagnosticRow label="Stored Value" value={secureStorageState?.hasStoredValue ? 'present' : 'empty'} />
              <DiagnosticRow label="Last Updated" value={secureStorageState?.lastUpdatedAt ?? 'not available'} />
              <DiagnosticRow label="Last Loaded Secret" value={secureStorageState?.lastLoadedValue ?? 'load a saved secret to inspect it here'} />
              <DiagnosticRow label="Surface" value="electron safeStorage encryptString + decryptString" />
            </div>
            {secureStorageState?.lastError && (
              <p className="text-xs text-amber-200">{secureStorageState.lastError}</p>
            )}
          </div>
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
` : ''}${useGlobalShortcut ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Global Shortcut</h3>
              <p className="mt-1 text-xs text-slate-400">Register a system-wide shortcut that brings the desktop app back into focus from anywhere.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => triggerGlobalShortcut(api, setGlobalShortcutState)}
                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
              >
                Run action
              </button>
              <button
                onClick={() => toggleGlobalShortcut(api, globalShortcutState, setGlobalShortcutState)}
                className="rounded-full border border-violet-500/40 px-3 py-1 text-xs font-medium text-violet-300 hover:border-violet-400 hover:text-violet-100"
              >
                {globalShortcutState?.enabled ? 'Disable shortcut' : 'Enable shortcut'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Accelerator" value={globalShortcutState?.accelerator ?? 'CommandOrControl+Shift+Y'} />
            <DiagnosticRow label="Enabled" value={globalShortcutState?.enabled ? 'yes' : 'no'} />
            <DiagnosticRow label="Registered" value={globalShortcutState?.registered ? 'yes' : 'no'} />
            <DiagnosticRow label="Last Trigger" value={globalShortcutState?.lastTriggeredAt ?? 'not triggered yet'} />
          </div>
          {globalShortcutState?.error && (
            <p className="mt-2 text-xs text-amber-200">{globalShortcutState.error}</p>
          )}
        </section>
` : ''}${useFileAssociation ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">File Association</h3>
              <p className="mt-1 text-xs text-slate-400">Capture starter document opens from the operating system and inspect the last received file path in the desktop shell.</p>
            </div>
            <button
              onClick={() => openAssociatedFile(api, fileAssociationDraft, setFileAssociationState)}
              className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
            >
              Open sample file
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Sample file path
              <input
                type="text"
                value={fileAssociationDraft}
                onChange={(event) => setFileAssociationDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Extension" value={fileAssociationState?.extension ?? '${fileAssociationExtension}'} />
              <DiagnosticRow label="Source" value={fileAssociationState?.source ?? 'not opened yet'} />
              <DiagnosticRow label="Last Path" value={fileAssociationState?.lastPath ?? 'none captured yet'} />
              <DiagnosticRow label="Packaging" value="electron-builder fileAssociations preset" />
            </div>
          </div>
        </section>
` : ''}${useFileDialogs ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">File Dialogs</h3>
              <p className="mt-1 text-xs text-slate-400">Open files, choose save destinations, and reveal generated paths with the native desktop dialogs users already understand.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => runFileDialogAction(api, 'open', fileDialogDraft, setFileDialogState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Open file
              </button>
              <button
                onClick={() => runFileDialogAction(api, 'save', fileDialogDraft, setFileDialogState)}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
              >
                Save as
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Default path or file name
              <input
                type="text"
                value={fileDialogDraft}
                onChange={(event) => setFileDialogDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => runFileDialogAction(api, 'reveal', fileDialogState?.lastSavePath ?? fileDialogState?.lastOpenPath ?? fileDialogDraft, setFileDialogState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Reveal latest path
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Suggested Name" value={fileDialogState?.suggestedName ?? '${dialogSuggestedName}'} />
              <DiagnosticRow label="Last Action" value={fileDialogState?.lastAction ?? 'idle'} />
              <DiagnosticRow label="Opened File" value={fileDialogState?.lastOpenPath ?? 'none selected yet'} />
              <DiagnosticRow label="Saved File" value={fileDialogState?.lastSavePath ?? 'none saved yet'} />
              <DiagnosticRow label="Revealed Path" value={fileDialogState?.lastRevealPath ?? 'nothing revealed yet'} />
              <DiagnosticRow label="Shell Surface" value="dialog + shell.showItemInFolder" />
            </div>
          </div>
        </section>
` : ''}${useRecentFiles ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Files</h3>
              <p className="mt-1 text-xs text-slate-400">Persist the last documents a user touched and make reopen flows part of the starter desktop shell by default.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => mutateRecentFiles(api, 'add', recentFileDraft, setRecentFilesState)}
                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
              >
                Add file
              </button>
              <button
                onClick={() => clearRecentFilesState(api, setRecentFilesState)}
                className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-400 hover:text-rose-100"
              >
                Clear list
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Recent file path
              <input
                type="text"
                value={recentFileDraft}
                onChange={(event) => setRecentFileDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Tracked Items" value={String(recentFilesState?.items.length ?? 0)} />
              <DiagnosticRow label="Limit" value={String(recentFilesState?.limit ?? 8)} />
              <DiagnosticRow label="Last Opened" value={recentFilesState?.lastOpenedPath ?? 'no documents tracked yet'} />
              <DiagnosticRow label="Auto Sources" value="file-association + file-dialogs when enabled together" />
            </div>
            <div className="space-y-2">
              {recentFilesState?.items.length ? recentFilesState.items.map((item) => (
                <div key={item} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <span className="break-all text-xs text-white">{item}</span>
                  <button
                    onClick={() => mutateRecentFiles(api, 'open', item, setRecentFilesState)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
                  >
                    Reopen
                  </button>
                </div>
              )) : (
                <p className="text-xs text-slate-500">No recent files yet. Add one manually or combine this pack with file dialogs and file associations to populate the list automatically.</p>
              )}
            </div>
          </div>
        </section>
` : ''}${useCrashRecovery ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Crash Recovery</h3>
              <p className="mt-1 text-xs text-slate-400">Capture starter renderer and child-process incidents so teams can inspect failures and relaunch cleanly without wiring recovery paths from scratch.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => clearCrashRecovery(api, setCrashRecoveryState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear incident
              </button>
              <button
                onClick={() => relaunchCrashRecovery(api, setCrashRecoveryState)}
                className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-400 hover:text-rose-100"
              >
                Relaunch app
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Incident Recorded" value={crashRecoveryState?.hasIncident ? 'yes' : 'no'} />
            <DiagnosticRow label="Scope" value={crashRecoveryState?.lastIncident?.scope ?? 'none'} />
            <DiagnosticRow label="Reason" value={crashRecoveryState?.lastIncident?.reason ?? 'no incidents captured'} />
            <DiagnosticRow label="Timestamp" value={crashRecoveryState?.lastIncident?.timestamp ?? 'not available'} />
          </div>
          {crashRecoveryState?.lastIncident?.details && (
            <p className="mt-2 break-all text-xs text-amber-200">{crashRecoveryState.lastIncident.details}</p>
          )}
        </section>
` : ''}${usePowerMonitor ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Power Monitor</h3>
              <p className="mt-1 text-xs text-slate-400">Track suspend, resume, lock, unlock, and power-source events so desktop products can harden long-running work around real device lifecycle changes.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshPowerMonitor(api, setPowerMonitorState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Refresh
              </button>
              <button
                onClick={() => clearPowerMonitor(api, setPowerMonitorState)}
                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Power Source" value={powerMonitorState?.powerSource ?? 'unknown'} />
            <DiagnosticRow label="Idle State" value={powerMonitorState?.idleState ?? 'unknown'} />
            <DiagnosticRow label="Idle Time" value={powerMonitorState ? \`\${powerMonitorState.idleTimeSeconds}s\` : '0s'} />
            <DiagnosticRow label="Last Event" value={powerMonitorState?.lastEvent ?? 'no lifecycle events yet'} />
            <DiagnosticRow label="Last Event At" value={powerMonitorState?.lastEventAt ?? 'not available'} />
            <DiagnosticRow label="Tracked Events" value={String(powerMonitorState?.eventCount ?? 0)} />
          </div>
          <div className="mt-3 space-y-2">
            {powerMonitorState?.history.length ? powerMonitorState.history.map((entry) => (
              <div key={\`\${entry.name}-\${entry.timestamp}\`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">{entry.name}</span>
                <span className="text-xs text-slate-500">{entry.timestamp}</span>
              </div>
            )) : (
              <p className="text-xs text-slate-500">No power lifecycle events captured yet. Suspend or lock the device to exercise the starter hooks.</p>
            )}
          </div>
        </section>
` : ''}${useIdlePresence ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Idle Presence</h3>
              <p className="mt-1 text-xs text-slate-400">Track whether the user is active, idle, locked, or away from the app window so teams can design presence-aware desktop flows without rebuilding shell diagnostics.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshIdlePresence(api, setIdlePresenceState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => clearIdlePresence(api, setIdlePresenceState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Idle State" value={idlePresenceState?.idleState ?? 'unknown'} />
            <DiagnosticRow label="Idle Time" value={idlePresenceState ? \`\${idlePresenceState.idleTimeSeconds}s\` : '0s'} />
            <DiagnosticRow label="Attention" value={idlePresenceState?.attention ?? 'no-window'} />
            <DiagnosticRow label="Threshold" value={idlePresenceState ? \`\${idlePresenceState.thresholdSeconds}s\` : '45s'} />
            <DiagnosticRow label="Last Sampled" value={idlePresenceState?.lastSampledAt ?? 'not sampled yet'} />
            <DiagnosticRow label="Last Changed" value={idlePresenceState?.lastChangedAt ?? 'not available'} />
            <DiagnosticRow label="Sample Count" value={String(idlePresenceState?.sampleCount ?? 0)} />
            <DiagnosticRow label="Surface" value="electron powerMonitor getSystemIdleState + window focus visibility" />
          </div>
          <div className="mt-3 space-y-2">
            {idlePresenceState?.history.length ? idlePresenceState.history.map((entry) => (
              <div key={\`\${entry.timestamp}-\${entry.attention}\`} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.idleState} / {entry.attention}</span>
                  <span className="text-xs text-slate-500">{entry.timestamp}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Idle time: <span className="text-white">{entry.idleTimeSeconds}s</span></p>
              </div>
            )) : (
              <p className="text-xs text-slate-500">No idle-presence samples yet. Refresh or wait for the starter polling loop to record user activity state.</p>
            )}
          </div>
        </section>
` : ''}${useSessionState ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Session State</h3>
              <p className="mt-1 text-xs text-slate-400">Track whether the desktop app is active, backgrounded, hidden, or quitting while capturing window focus and visibility events in a starter lifecycle log.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshSessionState(api, setSessionStateSnapshot)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => clearSessionState(api, setSessionStateSnapshot)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Lifecycle" value={sessionStateSnapshot?.lifecycle ?? 'ready'} />
            <DiagnosticRow label="Attention" value={sessionStateSnapshot?.attention ?? 'no-window'} />
            <DiagnosticRow label="Windows" value={String(sessionStateSnapshot?.windowCount ?? 0)} />
            <DiagnosticRow label="Visible Windows" value={String(sessionStateSnapshot?.visibleWindowCount ?? 0)} />
            <DiagnosticRow label="Focused Windows" value={String(sessionStateSnapshot?.focusedWindowCount ?? 0)} />
            <DiagnosticRow label="Last Event" value={sessionStateSnapshot?.lastEvent ?? 'none yet'} />
            <DiagnosticRow label="Last Event At" value={sessionStateSnapshot?.lastEventAt ?? 'not available'} />
            <DiagnosticRow label="Event Count" value={String(sessionStateSnapshot?.eventCount ?? 0)} />
          </div>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
            Session started at <span className="text-white">{sessionStateSnapshot?.startedAt ?? 'not available'}</span>
          </div>
          <div className="mt-3 space-y-2">
            {sessionStateSnapshot?.history.length ? sessionStateSnapshot.history.map((entry) => (
              <div key={\`\${entry.name}-\${entry.timestamp}\`} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.name}</span>
                  <span className="text-xs text-slate-500">{entry.timestamp}</span>
                </div>
                {entry.detail && (
                  <p className="mt-2 break-all text-xs text-slate-400">{entry.detail}</p>
                )}
              </div>
            )) : (
              <p className="text-xs text-slate-500">No session-state events yet. Focus, hide, or reactivate the app window to exercise the starter lifecycle log.</p>
            )}
          </div>
        </section>
` : ''}${useDownloads ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Downloads</h3>
              <p className="mt-1 text-xs text-slate-400">Track file downloads with starter progress history and reveal-in-folder controls for desktop apps that ship assets or exported results.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startDownload(api, downloadUrlDraft, setDownloadsState)}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
              >
                Start download
              </button>
              <button
                onClick={() => clearDownloads(api, setDownloadsState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Download URL
              <input
                type="text"
                value={downloadUrlDraft}
                onChange={(event) => setDownloadUrlDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Active Downloads" value={String(downloadsState?.activeCount ?? 0)} />
              <DiagnosticRow label="Last Download Path" value={downloadsState?.lastDownloadPath ?? 'no completed downloads yet'} />
              <DiagnosticRow label="Tracked Items" value={String(downloadsState?.items.length ?? 0)} />
              <DiagnosticRow label="Sample URL" value={downloadsState?.sampleUrl ?? downloadUrlDraft} />
            </div>
            <div className="space-y-2">
              {downloadsState?.items.length ? downloadsState.items.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{entry.fileName}</span>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{entry.state}</span>
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-500">{entry.url}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <DiagnosticRow label="Progress" value={entry.totalBytes > 0 ? \`\${entry.receivedBytes}/\${entry.totalBytes}\` : String(entry.receivedBytes)} />
                    <DiagnosticRow label="Saved Path" value={entry.savePath ?? 'pending'} />
                    <DiagnosticRow label="Started At" value={entry.startedAt} />
                    <DiagnosticRow label="Finished At" value={entry.finishedAt ?? 'in progress'} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => revealDownloadedFile(api, entry.savePath ?? undefined, setDownloadsState)}
                      className="rounded-full border border-amber-500/40 px-3 py-1 text-[11px] font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
                    >
                      Reveal
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-500">No downloads tracked yet. Start a download to test Electron session tracking and reveal the result from Finder or Explorer.</p>
              )}
            </div>
          </div>
        </section>
` : ''}${useClipboard ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Clipboard</h3>
              <p className="mt-1 text-xs text-slate-400">Read, write, and clear clipboard text with starter history so teams can wire paste-heavy desktop workflows without rebuilding shell bridges.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => readClipboard(api, setClipboardState)}
                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
              >
                Read now
              </button>
              <button
                onClick={() => clearClipboard(api, setClipboardState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Clipboard text
              <textarea
                value={clipboardDraft}
                onChange={(event) => setClipboardDraft(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => writeClipboard(api, clipboardDraft, setClipboardState)}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
              >
                Write text
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Current Text" value={clipboardState?.currentText || 'clipboard is empty'} />
              <DiagnosticRow label="Last Action" value={clipboardState?.lastAction ?? 'none yet'} />
              <DiagnosticRow label="History Entries" value={String(clipboardState?.history.length ?? 0)} />
              <DiagnosticRow label="Surface" value="electron clipboard readText, writeText, clear" />
            </div>
            <div className="space-y-2">
              {clipboardState?.history.length ? clipboardState.history.map((entry) => (
                <div key={\`\${entry.action}-\${entry.timestamp}\`} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.action}</span>
                    <span className="text-xs text-slate-500">{entry.timestamp}</span>
                  </div>
                  <p className="mt-2 break-all text-xs text-white">{entry.text || '(empty text)'}</p>
                </div>
              )) : (
                <p className="text-xs text-slate-500">No clipboard history yet. Read or write text to exercise the starter clipboard bridge.</p>
              )}
            </div>
          </div>
        </section>
` : ''}${useExternalLinks ? `        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${features.length <= 2 ? 'md:col-span-2' : ''}">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">External Links</h3>
              <p className="mt-1 text-xs text-slate-400">Open external web or mail links through the system shell with starter history and error tracking for desktop link-out flows.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openExternalLink(api, externalLinkDraft, setExternalLinksState)}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
              >
                Open link
              </button>
              <button
                onClick={() => clearExternalLinks(api, setExternalLinksState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              External URL
              <input
                type="text"
                value={externalLinkDraft}
                onChange={(event) => setExternalLinkDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Default URL" value={externalLinksState?.defaultUrl ?? 'https://www.electronjs.org'} />
              <DiagnosticRow label="Last URL" value={externalLinksState?.lastUrl ?? 'nothing opened yet'} />
              <DiagnosticRow label="Last Opened At" value={externalLinksState?.lastOpenedAt ?? 'not available'} />
              <DiagnosticRow label="Open Count" value={String(externalLinksState?.openCount ?? 0)} />
            </div>
            {externalLinksState?.lastError && (
              <p className="text-xs text-rose-300">{externalLinksState.lastError}</p>
            )}
            <div className="space-y-2">
              {externalLinksState?.history.length ? externalLinksState.history.map((entry) => (
                <div key={\`\${entry.url}-\${entry.timestamp}\`} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.status}</span>
                    <span className="text-xs text-slate-500">{entry.timestamp}</span>
                  </div>
                  <p className="mt-2 break-all text-xs text-white">{entry.url}</p>
                  {entry.error && (
                    <p className="mt-2 break-all text-xs text-rose-300">{entry.error}</p>
                  )}
                </div>
              )) : (
                <p className="text-xs text-slate-500">No external-link history yet. Open a URL to exercise the starter shell bridge.</p>
              )}
            </div>
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
` : ''}${useGlobalShortcut ? `

async function toggleGlobalShortcut(
  api: ForgeDesktopAPI | undefined,
  current: GlobalShortcutState | null,
  setState: (next: GlobalShortcutState) => void,
) {
  try {
    const next = await api?.globalShortcut?.setEnabled?.(!(current?.enabled ?? false));
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter global shortcut failures.
  }
}

async function triggerGlobalShortcut(
  api: ForgeDesktopAPI | undefined,
  setState: (next: GlobalShortcutState) => void,
) {
  try {
    const next = await api?.globalShortcut?.trigger?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter global shortcut failures.
  }
}
` : ''}${useFileAssociation ? `

async function openAssociatedFile(
  api: ForgeDesktopAPI | undefined,
  filePath: string,
  setState: (next: FileAssociationState) => void,
) {
  try {
    const next = await api?.fileAssociation?.open?.(filePath);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter file-association failures.
  }
}
` : ''}${useFileDialogs ? `

async function runFileDialogAction(
  api: ForgeDesktopAPI | undefined,
  action: 'open' | 'save' | 'reveal',
  value: string,
  setState: (next: FileDialogState) => void,
) {
  try {
    const next = action === 'open'
      ? await api?.fileDialogs?.open?.(value)
      : action === 'save'
        ? await api?.fileDialogs?.save?.(value)
        : await api?.fileDialogs?.reveal?.(value);

    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter file-dialog failures.
  }
}
` : ''}${useRecentFiles ? `

async function mutateRecentFiles(
  api: ForgeDesktopAPI | undefined,
  action: 'add' | 'open',
  filePath: string,
  setState: (next: RecentFilesState) => void,
) {
  try {
    const next = action === 'open'
      ? await api?.recentFiles?.open?.(filePath)
      : await api?.recentFiles?.add?.(filePath);

    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter recent-files failures.
  }
}

async function clearRecentFilesState(
  api: ForgeDesktopAPI | undefined,
  setState: (next: RecentFilesState) => void,
) {
  try {
    const next = await api?.recentFiles?.clear?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter recent-files failures.
  }
}
` : ''}${useCrashRecovery ? `

async function clearCrashRecovery(
  api: ForgeDesktopAPI | undefined,
  setState: (next: CrashRecoveryState) => void,
) {
  try {
    const next = await api?.crashRecovery?.clear?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter crash-recovery failures.
  }
}

async function relaunchCrashRecovery(
  api: ForgeDesktopAPI | undefined,
  setState: (next: CrashRecoveryState) => void,
) {
  try {
    const next = await api?.crashRecovery?.relaunch?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter crash-recovery failures.
  }
}
` : ''}${usePowerMonitor ? `

async function refreshPowerMonitor(
  api: ForgeDesktopAPI | undefined,
  setState: (next: PowerMonitorState) => void,
) {
  try {
    const next = await api?.powerMonitor?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter power-monitor refresh failures.
  }
}

async function clearPowerMonitor(
  api: ForgeDesktopAPI | undefined,
  setState: (next: PowerMonitorState) => void,
) {
  try {
    const next = await api?.powerMonitor?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter power-monitor failures.
  }
}
` : ''}${useIdlePresence ? `

async function refreshIdlePresence(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IdlePresenceState) => void,
) {
  try {
    const next = await api?.idlePresence?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter idle-presence refresh failures.
  }
}

async function clearIdlePresence(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IdlePresenceState) => void,
) {
  try {
    const next = await api?.idlePresence?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter idle-presence clear failures.
  }
}
` : ''}${useSessionState ? `

async function refreshSessionState(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SessionStateSnapshot) => void,
) {
  try {
    const next = await api?.sessionState?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter session-state refresh failures.
  }
}

async function clearSessionState(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SessionStateSnapshot) => void,
) {
  try {
    const next = await api?.sessionState?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter session-state clear failures.
  }
}
` : ''}${useDownloads ? `

async function startDownload(
  api: ForgeDesktopAPI | undefined,
  url: string,
  setState: (next: DownloadsState) => void,
) {
  try {
    const next = await api?.downloads?.start?.(url);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter download failures.
  }
}

async function clearDownloads(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DownloadsState) => void,
) {
  try {
    const next = await api?.downloads?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter download history failures.
  }
}

async function revealDownloadedFile(
  api: ForgeDesktopAPI | undefined,
  targetPath: string | undefined,
  setState: (next: DownloadsState) => void,
) {
  try {
    const next = await api?.downloads?.reveal?.(targetPath);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter reveal failures.
  }
}
` : ''}${useClipboard ? `

async function readClipboard(
  api: ForgeDesktopAPI | undefined,
  setState: (next: ClipboardState) => void,
) {
  try {
    const next = await api?.clipboard?.readText?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter clipboard read failures.
  }
}

async function writeClipboard(
  api: ForgeDesktopAPI | undefined,
  text: string,
  setState: (next: ClipboardState) => void,
) {
  try {
    const next = await api?.clipboard?.writeText?.(text);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter clipboard write failures.
  }
}

async function clearClipboard(
  api: ForgeDesktopAPI | undefined,
  setState: (next: ClipboardState) => void,
) {
  try {
    const next = await api?.clipboard?.clear?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter clipboard clear failures.
  }
}
` : ''}${useExternalLinks ? `

async function openExternalLink(
  api: ForgeDesktopAPI | undefined,
  url: string,
  setState: (next: ExternalLinksState) => void,
) {
  try {
    const next = await api?.externalLinks?.open?.(url);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter external-link failures.
  }
}

async function clearExternalLinks(
  api: ForgeDesktopAPI | undefined,
  setState: (next: ExternalLinksState) => void,
) {
  try {
    const next = await api?.externalLinks?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter external-link history failures.
  }
}
` : ''}${useSystemInfo ? `

async function refreshSystemInfo(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SystemInfoState) => void,
) {
  try {
    const next = await api?.systemInfo?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter system-info refresh failures.
  }
}
` : ''}${usePermissions ? `

function formatPermissionEntry(entry: PermissionsState['camera'] | undefined) {
  if (!entry) {
    return 'unknown';
  }

  if (!entry.supported) {
    return 'unsupported';
  }

  return \`\${entry.status} / \${entry.canRequest ? 'requestable' : 'read-only'}\`;
}

async function refreshPermissions(
  api: ForgeDesktopAPI | undefined,
  setState: (next: PermissionsState) => void,
) {
  try {
    const next = await api?.permissions?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter permissions refresh failures.
  }
}

async function requestPermissionAccess(
  api: ForgeDesktopAPI | undefined,
  kind: 'camera' | 'microphone',
  setState: (next: PermissionsState) => void,
) {
  try {
    const next = await api?.permissions?.request?.(kind);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter permission request failures.
  }
}
` : ''}${useNetworkStatus ? `

async function refreshNetworkStatus(
  api: ForgeDesktopAPI | undefined,
  setState: (next: NetworkStatusState) => void,
) {
  try {
    const next = await api?.networkStatus?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter network-status refresh failures.
  }
}

async function clearNetworkStatus(
  api: ForgeDesktopAPI | undefined,
  setState: (next: NetworkStatusState) => void,
) {
  try {
    const next = await api?.networkStatus?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter network-status clear failures.
  }
}
` : ''}${useSecureStorage ? `

async function refreshSecureStorage(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SecureStorageState) => void,
  setLabelDraft: (next: string) => void,
) {
  try {
    const next = await api?.secureStorage?.getState?.();
    if (next) {
      setState(next);
      if (next.label) {
        setLabelDraft(next.label);
      }
    }
  } catch {
    // Ignore starter secure-storage refresh failures.
  }
}

async function saveSecureStorage(
  api: ForgeDesktopAPI | undefined,
  label: string,
  value: string,
  setState: (next: SecureStorageState) => void,
  setLabelDraft: (next: string) => void,
) {
  try {
    const next = await api?.secureStorage?.save?.(label, value);
    if (next) {
      setState(next);
      if (next.label) {
        setLabelDraft(next.label);
      }
    }
  } catch {
    // Ignore starter secure-storage save failures.
  }
}

async function loadSecureStorage(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SecureStorageState) => void,
  setLabelDraft: (next: string) => void,
) {
  try {
    const next = await api?.secureStorage?.load?.();
    if (next) {
      setState(next);
      if (next.label) {
        setLabelDraft(next.label);
      }
    }
  } catch {
    // Ignore starter secure-storage load failures.
  }
}

async function clearSecureStorage(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SecureStorageState) => void,
  setLabelDraft: (next: string) => void,
) {
  try {
    const next = await api?.secureStorage?.clear?.();
    if (next) {
      setState(next);
      setLabelDraft('api-token');
    }
  } catch {
    // Ignore starter secure-storage clear failures.
  }
}
` : ''}${useSupportBundle ? `

async function refreshSupportBundle(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SupportBundleState) => void,
) {
  try {
    const next = await api?.supportBundle?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter support-bundle refresh failures.
  }
}

async function exportSupportBundleFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SupportBundleState) => void,
) {
  try {
    const next = await api?.supportBundle?.export?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter support-bundle export failures.
  }
}

async function revealSupportBundleFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SupportBundleState) => void,
) {
  try {
    const next = await api?.supportBundle?.reveal?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter support-bundle reveal failures.
  }
}
` : ''}${useLogArchive ? `

async function refreshLogArchive(
  api: ForgeDesktopAPI | undefined,
  setState: (next: LogArchiveState) => void,
) {
  try {
    const next = await api?.logArchive?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter log-archive refresh failures.
  }
}

async function exportLogArchiveFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: LogArchiveState) => void,
) {
  try {
    const next = await api?.logArchive?.export?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter log-archive export failures.
  }
}

async function revealLogArchiveFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: LogArchiveState) => void,
) {
  try {
    const next = await api?.logArchive?.reveal?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter log-archive reveal failures.
  }
}
` : ''}${useIncidentReport ? `

async function refreshIncidentReport(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IncidentReportState) => void,
  setDraft: (next: IncidentReportDraft) => void,
) {
  try {
    const next = await api?.incidentReport?.getState?.();
    if (next) {
      setState(next);
      setDraft(next.currentDraft);
    }
  } catch {
    // Ignore starter incident-report refresh failures.
  }
}

async function exportIncidentReportFromStudio(
  api: ForgeDesktopAPI | undefined,
  draft: IncidentReportDraft,
  setState: (next: IncidentReportState) => void,
  setDraft: (next: IncidentReportDraft) => void,
) {
  try {
    const next = await api?.incidentReport?.export?.(draft);
    if (next) {
      setState(next);
      setDraft(next.currentDraft);
    }
  } catch {
    // Ignore starter incident-report export failures.
  }
}

async function revealIncidentReportFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IncidentReportState) => void,
  setDraft: (next: IncidentReportDraft) => void,
) {
  try {
    const next = await api?.incidentReport?.reveal?.();
    if (next) {
      setState(next);
      setDraft(next.currentDraft);
    }
  } catch {
    // Ignore starter incident-report reveal failures.
  }
}
` : ''}${useDiagnosticsTimeline ? `

async function refreshDiagnosticsTimeline(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline refresh failures.
  }
}

async function exportDiagnosticsTimelineFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.export?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline export failures.
  }
}

async function revealDiagnosticsTimelineFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.reveal?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline reveal failures.
  }
}

async function clearDiagnosticsTimelineFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline clear failures.
  }
}
` : ''}${useDiagnostics || useSystemInfo || usePermissions || useNetworkStatus || useSecureStorage || useSupportBundle || useLogArchive || useIncidentReport || useDiagnosticsTimeline || useWindowing || useTray || useDeepLink || useMenuBar || useAutoLaunch || useGlobalShortcut || useFileAssociation || useFileDialogs || useRecentFiles || useCrashRecovery || usePowerMonitor || useIdlePresence || useSessionState || useDownloads || useClipboard || useExternalLinks ? `

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 break-all text-xs text-white">{value}</p>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-slate-400 md:col-span-2">
      <span className="uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="min-h-[96px] w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
      />
    </label>
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
    '      - name: Electron security baseline',
    '        run: pnpm security:check',
    '',
    '      - name: Runtime hygiene baseline',
    '        run: pnpm ops:check',
    '',
    '      - name: Operations retention baseline',
    '        run: pnpm ops:retention -- --keep 3',
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
    '      - name: Operations recovery rehearsal',
    '        run: pnpm ops:recover -- --label validate --skip-retention',
    '',
    '      - name: Upload operations snapshots',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-snapshots-validate-${{ github.run_id }}',
    '          path: ops/snapshots',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations evidence',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-evidence-validate-${{ github.run_id }}',
    '          path: ops/evidence',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations index',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-index-validate-${{ github.run_id }}',
    '          path: ops/index',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations reports',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-reports-validate-${{ github.run_id }}',
    '          path: ops/reports',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations bundles',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-bundles-validate-${{ github.run_id }}',
    '          path: ops/bundles',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations doctors',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-doctors-validate-${{ github.run_id }}',
    '          path: ops/doctors',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations handoffs',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-handoffs-validate-${{ github.run_id }}',
    '          path: ops/handoffs',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations attestations',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-attestations-validate-${{ github.run_id }}',
    '          path: ops/attestations',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations ready summaries',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-ready-validate-${{ github.run_id }}',
    '          path: ops/ready',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations gates',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-gates-validate-${{ github.run_id }}',
    '          path: ops/gates',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations release packs',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-releasepacks-validate-${{ github.run_id }}',
    '          path: ops/releasepacks',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations exports',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-exports-validate-${{ github.run_id }}',
    '          path: ops/exports',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations restores',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-restores-validate-${{ github.run_id }}',
    '          path: ops/restores',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations recoveries',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-recoveries-validate-${{ github.run_id }}',
    '          path: ops/recoveries',
    '          if-no-files-found: error',
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
    '      - name: Electron security baseline',
    '        run: pnpm security:check',
    '',
    '      - name: Runtime hygiene baseline',
    '        run: pnpm ops:check',
    '',
    '      - name: Operations retention baseline',
    '        run: pnpm ops:retention -- --keep 3',
    '',
    '      - name: Verify publish environment',
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
    '        run: pnpm publish:check:github',
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
    '      - name: Operations recovery rehearsal',
    '        run: pnpm ops:recover -- --label release-${{ matrix.platform }} --skip-retention --require-release-output',
    '',
    '      - name: Upload operations snapshots',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-snapshots-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/snapshots',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations evidence',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-evidence-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/evidence',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations index',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-index-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/index',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations reports',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-reports-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/reports',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations bundles',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-bundles-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/bundles',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations doctors',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-doctors-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/doctors',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations handoffs',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-handoffs-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/handoffs',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations attestations',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-attestations-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/attestations',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations ready summaries',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-ready-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/ready',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations gates',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-gates-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/gates',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations release packs',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-releasepacks-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/releasepacks',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations exports',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-exports-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/exports',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations restores',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-restores-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/restores',
    '          if-no-files-found: error',
    '',
    '      - name: Upload operations recoveries',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: ops-recoveries-${{ matrix.platform }}-${{ github.ref_name }}',
    '          path: ops/recoveries',
    '          if-no-files-found: error',
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
    'pnpm security:check',
    'pnpm ops:check',
    'pnpm ops:retention -- --keep 3',
    'pnpm production:check',
    'pnpm package',
    'pnpm ops:recover -- --label release-smoke --require-release-output',
    '```',
    '',
    'Use `pnpm production:check:s3 -- --require-release-output` when the app will ship through a generic/S3 update channel.',
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
    '- Run `pnpm publish:check:s3` before a generic/S3 publish so missing bucket, endpoint, or update URL values fail fast.',
    '- Run `pnpm production:check:all -- --require-release-output` after local packaging when you want one command that rechecks every configured channel.',
    '',
  ].join('\n');
}

function getProductionReadinessGuide(projectName: string, metadata: ScaffoldMetadata): string {
  const productName = resolveProductName(projectName, metadata);

  return [
    `# ${productName} Production Readiness`,
    '',
    'Use these commands when you want one repeatable production-grade check before tagging or publishing a desktop release.',
    '',
    '## Default GitHub Release Path',
    '',
    '```bash',
    'pnpm security:check',
    'pnpm ops:check',
    'pnpm ops:retention -- --keep 3',
    'pnpm production:check',
    'pnpm package',
    'pnpm ops:recover -- --label github-readiness --require-release-output',
    '```',
    '',
    '## Generic or S3 Update Channel',
    '',
    '```bash',
    'pnpm security:check',
    'pnpm ops:check',
    'pnpm ops:retention -- --keep 3',
    'pnpm production:check:s3',
    'pnpm package:s3',
    'pnpm ops:recover -- --label s3-readiness --require-release-output',
    '```',
    '',
    '## Full Multi-Channel Audit',
    '',
    '```bash',
    'pnpm security:check',
    'pnpm ops:check',
    'pnpm ops:retention -- --keep 3',
    'pnpm production:check:all',
    'pnpm package',
    'pnpm ops:recover -- --label full-audit --require-release-output',
    '```',
    '',
    '## Standalone Attestation',
    '',
    '```bash',
    'pnpm ops:attest -- --label release-attestation --require-release-output',
    '```',
    '',
    'Use `pnpm ops:attest` when you want one checksum-backed Markdown and JSON inventory for the latest bundle, handoff, ready surface, and packaged release output without rerunning the whole `ops:ready` chain.',
    '',
    '## Final Recovery Rehearsal',
    '',
    '```bash',
    'pnpm ops:recover -- --label release-recovery --require-release-output',
    '```',
    '',
    'Use `pnpm ops:recover` when you want one final recovery rehearsal under `ops/recoveries/` that runs the latest restore record, proves the gate and export surfaces still align, and leaves a Markdown and JSON proof after the packaged release output is in place.',
    '',
    '## What Gets Checked',
    '',
    '- Release preflight files and metadata',
    '- Electron security baseline in `electron/main.ts` and `electron/preload.ts`',
    '- Runtime hygiene baseline for log retention and crash-dump retention in `electron/main.ts`',
    '- Operations retention baseline so repeated production checks keep only the most recent snapshot, evidence, report, bundle, index, doctor, handoff, attestation, ready, gate, and release pack directories by default',
    '- Operations report under `ops/reports/` so operators get one consolidated Markdown and JSON handoff for the latest production audit state',
    '- Operations bundle under `ops/bundles/` so operators can hand off one portable tarball with the latest production evidence set',
    '- Operations index under `ops/index/` so operators can inspect the current snapshot, evidence, report, bundle, doctor, handoff, attestation, and ready inventory in one Markdown and JSON surface',
    '- Operations doctor under `ops/doctors/` so operators get one final Markdown and JSON verdict that the latest ops surfaces are present and aligned before handoff or publish',
    '- Operations handoff under `ops/handoffs/` so operators get one portable Markdown, JSON, and tarball handoff package built from the latest doctor, bundle, report, docs, env template, and release manifests',
    '- Operations attestation under `ops/attestations/` so operators get one checksum-backed Markdown and JSON inventory for the latest bundle, handoff, ready surface, and release output',
    '- Operations ready summary under `ops/ready/` so operators get one final Markdown and JSON production verdict that refreshes the full ops chain, including attestation, in one command',
    '- Operations gate under `ops/gates/` so operators get one final Markdown and JSON go/no-go verdict that proves the latest ready, handoff, attestation, index, and release output are aligned',
    '- Operations release pack under `ops/releasepacks/` so operators still get one intermediate portable tarball and evidence directory that includes the latest gate, handoff, attestation, ready, docs, env template, and packaged release output',
    '- Operations export under `ops/exports/` so operators get one final offline-friendly tarball and evidence directory that packages the latest release pack plus the final gate, handoff, attestation, ready, index, docs, env template, and packaged release output',
    '- Operations restore rehearsal under `ops/restores/` so operators still get one final Markdown and JSON proof that the latest offline export can be unpacked and verified outside CI artifacts before handoff',
    '- Operations recovery rehearsal under `ops/recoveries/` so operators get one final Markdown and JSON proof that the latest restore record, gate verdict, and packaged payload are coherent enough for a recovery handoff',
    '- Operator-facing Markdown and JSON operations snapshot under `ops/snapshots/`',
    '- Reusable operations evidence bundle under `ops/evidence/` with the latest snapshot, production docs, env template, and release manifest inventory',
    '- TypeScript typecheck',
    '- Python worker environment and bundled worker build',
    '- Electron renderer and main-process build',
    '- Publish environment variables for the requested channel',
    '- Packaged installer and updater manifest verification when `release/` exists',
    '',
    'If you only want to validate source and environment state before packaging, omit `--require-release-output`.',
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
