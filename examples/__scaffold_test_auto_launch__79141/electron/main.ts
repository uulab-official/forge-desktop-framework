import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const logger = createLogger('main');
let mainWindow: BrowserWindow | null = null;



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

const enabledFeatures = ["auto-launch"];

function isAutoLaunchSupported() {
  return process.platform === 'darwin' || process.platform === 'win32';
}

function getAutoLaunchState() {
  const supported = isAutoLaunchSupported();
  const settings = supported ? app.getLoginItemSettings() : null;

  return {
    supported,
    enabled: supported ? settings?.openAtLogin === true : false,
    openAsHidden: supported ? settings?.openAsHidden === true : false,
  };
}

function setAutoLaunchEnabled(enabled: boolean) {
  if (!isAutoLaunchSupported()) {
    return getAutoLaunchState();
  }

  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
    });
  } else {
    app.setLoginItemSettings({
      openAtLogin: enabled,
    });
  }

  return getAutoLaunchState();
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.AUTO_LAUNCH_GET_STATUS, async () => {
    return getAutoLaunchState();
  });

  ipcMain.handle(IPC_CHANNELS.AUTO_LAUNCH_SET_ENABLED, async (_event, enabled: boolean) => {
    return setAutoLaunchEnabled(enabled);
  });

  logger.info('IPC handlers registered');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,

    minWidth: 760,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
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
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  workerClient.dispose();
});
