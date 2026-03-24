import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import type { WorkerRequest } from '@forge/ipc-contract';

const logger = createLogger('main');
const isDev = !app.isPackaged;
const appRoot = isDev ? path.resolve(__dirname, '../../..') : app.getAppPath();

const resourceManager = createResourceManager({ isDev, appRoot });
const workerClient = createWorkerClient({
  workerPath: resourceManager.getWorkerPath(),
  pythonPath: resourceManager.getPythonPath(),
  isDev,
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
