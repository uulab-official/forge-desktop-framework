import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import type { WorkerRequest } from '@forge/ipc-contract';

const logger = createLogger('main');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    win.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('worker:execute', async (_event, request: WorkerRequest) => {
  logger.info('Executing worker action', { action: request.action });
  return workerClient.execute(request);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => workerClient.dispose());
