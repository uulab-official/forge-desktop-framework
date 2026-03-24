import { join } from 'node:path';
import { createLogger } from '@forge/logger';
import { getExeSuffix } from './platform.js';

export interface ResourceManagerOptions {
  isDev: boolean;
  appRoot: string;
  resourcesPath?: string;
}

export interface ResourceManager {
  getWorkerPath(): string;
  getPythonPath(): string;
  getBinaryPath(name: string): string;
  getModelsDir(): string;
  getTemplatesDir(): string;
  getFontsDir(): string;
  getResourcesDir(): string;
}

export function createResourceManager(opts: ResourceManagerOptions): ResourceManager {
  const logger = createLogger('resources');
  const { isDev, appRoot } = opts;

  const resourcesBase = opts.resourcesPath
    ?? (isDev ? join(appRoot, 'resources') : join(appRoot, 'resources'));

  const exe = getExeSuffix();

  logger.info('Resource manager initialized', { isDev, appRoot, resourcesBase });

  return {
    getWorkerPath() {
      if (isDev) {
        return join(appRoot, 'worker', 'main.py');
      }
      return join(resourcesBase, 'worker', `forge-worker${exe}`);
    },

    getPythonPath() {
      return 'python3';
    },

    getBinaryPath(name: string) {
      return join(resourcesBase, 'binaries', `${name}${exe}`);
    },

    getModelsDir() {
      return join(resourcesBase, 'models');
    },

    getTemplatesDir() {
      return join(resourcesBase, 'templates');
    },

    getFontsDir() {
      return join(resourcesBase, 'fonts');
    },

    getResourcesDir() {
      return resourcesBase;
    },
  };
}
