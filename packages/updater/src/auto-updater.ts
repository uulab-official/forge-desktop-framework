import { autoUpdater, type UpdateCheckResult } from 'electron-updater';
import { createLogger } from '@forge/logger';
import type { UpdateStatus, UpdaterOptions } from './types.js';

export interface ForgeUpdater {
  checkForUpdates(): Promise<UpdateCheckResult | null>;
  downloadUpdate(): Promise<void>;
  quitAndInstall(): void;
  getStatus(): UpdateStatus;
  onStatus(cb: (status: UpdateStatus) => void): () => void;
  dispose(): void;
}

export function createUpdater(opts?: UpdaterOptions): ForgeUpdater {
  const logger = createLogger('updater');
  const listeners = new Set<(status: UpdateStatus) => void>();
  let currentStatus: UpdateStatus = { status: 'not-available' };
  let checkTimer: ReturnType<typeof setInterval> | null = null;

  autoUpdater.autoDownload = opts?.autoDownload ?? false;
  autoUpdater.autoInstallOnAppQuit = opts?.autoInstallOnAppQuit ?? true;

  function notify(status: UpdateStatus): void {
    currentStatus = status;
    for (const cb of listeners) {
      cb(status);
    }
  }

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates...');
    notify({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available', { version: info.version });
    notify({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('No update available');
    notify({ status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    notify({
      status: 'downloading',
      progress: {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded', { version: info.version });
    notify({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Update error', err.message);
    notify({ status: 'error', error: err.message });
  });

  if (opts?.checkInterval) {
    checkTimer = setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, opts.checkInterval);
  }

  return {
    async checkForUpdates() {
      try {
        return await autoUpdater.checkForUpdates();
      } catch (err) {
        logger.error('Failed to check for updates', err);
        return null;
      }
    },

    async downloadUpdate() {
      await autoUpdater.downloadUpdate();
    },

    quitAndInstall() {
      autoUpdater.quitAndInstall();
    },

    getStatus() {
      return currentStatus;
    },

    onStatus(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    dispose() {
      if (checkTimer) clearInterval(checkTimer);
      listeners.clear();
    },
  };
}
