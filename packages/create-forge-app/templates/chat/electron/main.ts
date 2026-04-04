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

let mainWindow: BrowserWindow | null = null;

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
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
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

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('worker:execute', async (_event, request: WorkerRequest) => {
  logger.info('Executing worker action', { action: request.action });
  return workerClient.execute(request);
});

ipcMain.handle('chat:send', async (_event, message: string) => {
  logger.info('Chat message received', { message });

  // Forward to Python worker for response generation
  const response = await workerClient.execute({
    action: 'chat_respond',
    payload: { message },
  });

  if (response.success && response.data) {
    // Simulate streaming by sending words one at a time
    const words = response.data.response.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      accumulated += (i > 0 ? ' ' : '') + words[i];
      await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 80));
      mainWindow?.webContents.send('chat:stream', {
        partial: accumulated,
        done: i === words.length - 1,
        timestamp: response.data.timestamp,
      });
    }
  }

  return response;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => workerClient.dispose());
