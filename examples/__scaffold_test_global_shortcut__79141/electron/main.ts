import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
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

const enabledFeatures = ["global-shortcut"];

const starterShortcutAccelerator = 'CommandOrControl+Shift+Y';
let starterShortcutEnabled = true;
let starterShortcutLastTriggeredAt: string | null = null;
let starterShortcutError: string | null = null;

function runStarterShortcutAction() {
  starterShortcutLastTriggeredAt = new Date().toISOString();

  if (!mainWindow) {
    createWindow();
    return getGlobalShortcutState();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  return getGlobalShortcutState();
}

function registerStarterShortcut() {
  globalShortcut.unregister(starterShortcutAccelerator);

  if (!starterShortcutEnabled) {
    starterShortcutError = null;
    return getGlobalShortcutState();
  }

  const registered = globalShortcut.register(starterShortcutAccelerator, () => {
    runStarterShortcutAction();
  });

  starterShortcutError = registered
    ? null
    : 'Unable to register the starter shortcut. Another app may already be using it.';

  return getGlobalShortcutState();
}

function setGlobalShortcutEnabled(enabled: boolean) {
  starterShortcutEnabled = enabled;
  return registerStarterShortcut();
}

function getGlobalShortcutState() {
  return {
    accelerator: starterShortcutAccelerator,
    enabled: starterShortcutEnabled,
    registered: globalShortcut.isRegistered(starterShortcutAccelerator),
    lastTriggeredAt: starterShortcutLastTriggeredAt,
    error: starterShortcutError,
  };
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.GLOBAL_SHORTCUT_GET_STATUS, async () => {
    return getGlobalShortcutState();
  });

  ipcMain.handle(IPC_CHANNELS.GLOBAL_SHORTCUT_SET_ENABLED, async (_event, enabled: boolean) => {
    return setGlobalShortcutEnabled(enabled);
  });

  ipcMain.handle(IPC_CHANNELS.GLOBAL_SHORTCUT_TRIGGER, async () => {
    return runStarterShortcutAction();
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
  registerStarterShortcut();
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
  globalShortcut.unregister(starterShortcutAccelerator);
  workerClient.dispose();
});
