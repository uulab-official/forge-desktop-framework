import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { createLogger, onLogEntry } from '@forge/logger';
import { createResourceManager } from '@forge/resource-manager';
import { createSettingsManager } from '@forge/settings-core';
import { createWorkerClient } from '@forge/worker-client';
import { createJobEngine } from '@forge/job-engine';
import { IPC_CHANNELS } from '@forge/ipc-contract';
import { registerIpcHandlers } from './ipc-handlers';
import { initAutoUpdater } from './auto-updater';

const logger = createLogger('main');

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;
const appRoot = isDev
  ? path.resolve(__dirname, '..')      // apps/app/
  : app.getAppPath();
const appsRoot = isDev
  ? path.resolve(__dirname, '../..')    // apps/
  : undefined;
const monorepoRoot = isDev
  ? path.resolve(__dirname, '../../..')  // monorepo root
  : undefined;

const resourceManager = createResourceManager({
  isDev,
  appRoot,
  resourcesPath: isDev ? path.join(monorepoRoot!, 'resources') : process.resourcesPath,
});

const settingsManager = createSettingsManager(
  path.join(app.getPath('userData'), 'settings.json'),
);

// Worker lives at apps/worker/ in dev, resources/worker/ in prod
const workerPath = isDev
  ? path.join(appsRoot!, 'worker', 'main.py')
  : resourceManager.getWorkerPath();

const workerClient = createWorkerClient({
  workerPath,
  pythonPath: resourceManager.getPythonPath(),
  isDev,
});

const jobEngine = createJobEngine(workerClient);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Forward job updates to renderer
  jobEngine.onJobUpdate((job) => {
    mainWindow?.webContents.send(IPC_CHANNELS.JOB_UPDATE, job);
  });

  // Forward log entries to renderer
  onLogEntry((entry) => {
    mainWindow?.webContents.send(IPC_CHANNELS.LOG_ENTRY, entry);
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  logger.info('App starting', { isDev, appRoot });

  await settingsManager.load();

  registerIpcHandlers({
    workerClient,
    jobEngine,
    settingsManager,
    resourceManager,
  });

  createWindow();

  // Initialize auto-updater (only in packaged builds)
  if (app.isPackaged) {
    initAutoUpdater(mainWindow!, logger);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  jobEngine.dispose();
});
