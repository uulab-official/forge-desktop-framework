import { app, BrowserWindow, ipcMain, shell } from 'electron';
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedRendererUrl(url)) maybeOpenExternalUrl(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRendererUrl(url)) return;
    event.preventDefault();
    maybeOpenExternalUrl(url);
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
