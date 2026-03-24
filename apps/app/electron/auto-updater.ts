/**
 * Auto-updater integration for Forge Desktop apps.
 *
 * This module is opt-in: it only runs when the app is packaged (app.isPackaged).
 * It uses electron-updater which reads the publish config from electron-builder.yml.
 *
 * Supports both GitHub Releases and S3/R2 (generic provider) depending on
 * which electron-builder config was used to package the app.
 */

import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export function initAutoUpdater(mainWindow: BrowserWindow, logger: Logger) {
  // Configure logging
  autoUpdater.logger = {
    info: (msg: string) => logger.info(`[updater] ${msg}`),
    warn: (msg: string) => logger.info(`[updater:warn] ${msg}`),
    error: (msg: string) => logger.error(`[updater] ${msg}`),
    debug: (msg: string) => logger.info(`[updater:debug] ${msg}`),
  };

  // Don't auto-download — let the user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    logger.info('Update available', { version: info.version });

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available.`,
      detail: 'Would you like to download and install it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('No updates available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    logger.info('Update downloaded', { version: info.version });
    mainWindow.setProgressBar(-1); // Remove progress bar

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The app will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (err: Error) => {
    logger.error('Auto-update error', { error: err.message });
  });

  // Check for updates after a short delay to avoid blocking startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('Failed to check for updates', { error: err.message });
    });
  }, 5000);
}
