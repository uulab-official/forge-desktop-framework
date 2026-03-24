import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AppSettings } from '@forge/ipc-contract';
import { DEFAULT_SETTINGS } from '@forge/ipc-contract';
import { createLogger } from '@forge/logger';

export interface SettingsManager {
  get<K extends keyof AppSettings>(key: K): AppSettings[K];
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  getAll(): AppSettings;
  load(): Promise<void>;
  save(): Promise<void>;
  onChange(cb: (settings: AppSettings) => void): () => void;
}

export function createSettingsManager(filePath: string): SettingsManager {
  const logger = createLogger('settings');
  let settings: AppSettings = { ...DEFAULT_SETTINGS };
  const listeners = new Set<(settings: AppSettings) => void>();

  function notify(): void {
    for (const cb of listeners) {
      cb({ ...settings });
    }
  }

  return {
    get(key) {
      return settings[key];
    },

    set(key, value) {
      settings[key] = value;
      notify();
    },

    getAll() {
      return { ...settings };
    },

    async load() {
      try {
        const raw = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        settings = { ...DEFAULT_SETTINGS, ...parsed };
        logger.info('Settings loaded', { filePath });
      } catch {
        settings = { ...DEFAULT_SETTINGS };
        logger.info('No existing settings file, using defaults');
      }
    },

    async save() {
      try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
        logger.info('Settings saved');
      } catch (err) {
        logger.error('Failed to save settings', err);
        throw err;
      }
    },

    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
