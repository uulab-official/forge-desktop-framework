import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { ProjectMeta, ProjectPaths } from '@forge/ipc-contract';
import { createLogger } from '@forge/logger';

const PROJECT_FILE = 'project.json';
const SUBDIRS = ['source', 'analysis', 'output', 'temp'] as const;

export interface ProjectHandle {
  meta: ProjectMeta;
  paths: ProjectPaths;
  save(): Promise<void>;
  updateMeta(partial: Partial<ProjectMeta>): void;
}

export async function createProject(
  parentDir: string,
  name: string,
): Promise<ProjectHandle> {
  const logger = createLogger('project');
  const root = join(parentDir, name);

  await mkdir(root, { recursive: true });
  for (const sub of SUBDIRS) {
    await mkdir(join(root, sub), { recursive: true });
  }

  const now = Date.now();
  const meta: ProjectMeta = {
    name,
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    settings: {},
  };

  const paths = buildPaths(root);
  const handle = buildHandle(meta, paths, root, logger);
  await handle.save();

  logger.info('Project created', { name, root });
  return handle;
}

export async function openProject(projectPath: string): Promise<ProjectHandle> {
  const logger = createLogger('project');
  const metaPath = join(projectPath, PROJECT_FILE);

  try {
    await access(metaPath);
  } catch {
    throw new Error(`Not a valid project: ${projectPath} (missing ${PROJECT_FILE})`);
  }

  const raw = await readFile(metaPath, 'utf-8');
  const meta = JSON.parse(raw) as ProjectMeta;
  const paths = buildPaths(projectPath);

  logger.info('Project opened', { name: meta.name, path: projectPath });
  return buildHandle(meta, paths, projectPath, logger);
}

export async function isValidProject(projectPath: string): Promise<boolean> {
  try {
    await access(join(projectPath, PROJECT_FILE));
    return true;
  } catch {
    return false;
  }
}

function buildPaths(root: string): ProjectPaths {
  return {
    root,
    source: join(root, 'source'),
    analysis: join(root, 'analysis'),
    output: join(root, 'output'),
    temp: join(root, 'temp'),
  };
}

function buildHandle(
  meta: ProjectMeta,
  paths: ProjectPaths,
  root: string,
  logger: ReturnType<typeof createLogger>,
): ProjectHandle {
  return {
    meta,
    paths,

    async save() {
      meta.updatedAt = Date.now();
      const metaPath = join(root, PROJECT_FILE);
      await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      logger.debug('Project saved', { name: meta.name });
    },

    updateMeta(partial) {
      Object.assign(meta, partial);
    },
  };
}
