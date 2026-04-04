import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { createLogger } from '@forge/logger';
import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createJobEngine } from '@forge/job-engine';
import { IPC_CHANNELS } from '@forge/ipc-contract';
import type { WorkerRequest } from '@forge/ipc-contract';

const logger = createLogger('main');

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;
const appRoot = isDev
  ? path.resolve(__dirname, '..')
  : app.getAppPath();
const monorepoRoot = isDev
  ? path.resolve(__dirname, '../../..')
  : undefined;

const resourceManager = createResourceManager({
  isDev,
  appRoot,
  resourcesPath: isDev && monorepoRoot ? path.join(monorepoRoot, 'resources') : process.resourcesPath,
});

const workerClient = createWorkerClient({
  workerPath: resourceManager.getWorkerPath(),
  pythonPath: resourceManager.getPythonPath(),
  isDev,
});

const jobEngine = createJobEngine(workerClient);

function isTrustedRendererUrl(targetUrl: string) {
  if (!targetUrl) return false;
  if (!isDev) return targetUrl.startsWith('file://');
  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (!devServerUrl) return false;
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
  } catch {}
}

function registerIpcHandlers() {
  // Worker
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Worker execute', { action: request.action });
    return workerClient.execute(request);
  });

  // Jobs
  ipcMain.handle(IPC_CHANNELS.JOB_SUBMIT, async (_event, action: string, payload: Record<string, unknown>) => {
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

  logger.info('IPC handlers registered');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 700,
    minHeight: 500,
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
    if (!isTrustedRendererUrl(url)) maybeOpenExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRendererUrl(url)) return;
    event.preventDefault();
    maybeOpenExternalUrl(url);
  });

  // Forward job updates to renderer
  jobEngine.onJobUpdate((job) => {
    mainWindow?.webContents.send(IPC_CHANNELS.JOB_UPDATE, job);
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
  logger.info('File Processor starting', { isDev, appRoot });

  registerIpcHandlers();
  createWindow();

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
