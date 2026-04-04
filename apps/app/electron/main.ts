import { app, BrowserWindow, dialog, shell } from 'electron';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { createLogger, onLogEntry } from '@forge/logger';
import { createResourceManager } from '@forge/resource-manager';
import { createSettingsManager } from '@forge/settings-core';
import { createWorkerClient } from '@forge/worker-client';
import { createJobEngine } from '@forge/job-engine';
import { IPC_CHANNELS } from '@forge/ipc-contract';
import { registerIpcHandlers } from './ipc-handlers';
import { initAutoUpdater } from './auto-updater';

const runtimePaths = {
  logs: path.join(app.getPath('userData'), 'logs'),
  crashDumps: path.join(app.getPath('userData'), 'crashDumps'),
};

app.setAppLogsPath(runtimePaths.logs);
app.setPath('crashDumps', runtimePaths.crashDumps);

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

function isTrustedRendererUrl(targetUrl: string) {
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
  await enforceRuntimeHygiene();

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
