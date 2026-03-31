import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';

import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const logger = createLogger('main');
let mainWindow: BrowserWindow | null = null;
let appTray: Tray | null = null;



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

const enabledFeatures = ["tray"];

const trayIcon = nativeImage.createFromDataURL(
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Crect x=%222%22 y=%222%22 width=%2212%22 height=%2212%22 rx=%223%22 fill=%22black%22/%3E%3C/svg%3E',
);
trayIcon.setTemplateImage(true);

function getTrayStatus() {
  return {
    enabled: Boolean(appTray),
    windowVisible: mainWindow?.isVisible() ?? false,
  };
}

function toggleMainWindowVisibility() {
  if (!mainWindow) {
    createWindow();
    return getTrayStatus();
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }

  return getTrayStatus();
}

function createTray() {
  if (appTray) {
    return;
  }

  appTray = new Tray(trayIcon);
  appTray.setToolTip("Scaffold Test Tray 79141");
  appTray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show or Hide',
      click: () => {
        toggleMainWindowVisibility();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]));
  appTray.on('click', () => {
    toggleMainWindowVisibility();
  });
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.TRAY_STATUS_GET, async () => {
    return getTrayStatus();
  });

  ipcMain.handle(IPC_CHANNELS.TRAY_TOGGLE_WINDOW, async () => {
    return toggleMainWindowVisibility();
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
  createTray();
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
  appTray?.destroy();
  workerClient.dispose();
});
