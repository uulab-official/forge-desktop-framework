import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';

import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const logger = createLogger('main');
let mainWindow: BrowserWindow | null = null;

let menuInstalled = false;


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

const enabledFeatures = ["menu-bar"];

function buildApplicationMenu() {
  const macMenu: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [{
        label: "Scaffold Test Menu Bar 79141",
        submenu: [
          { role: 'about' as const },
          { type: 'separator' as const },
          { role: 'services' as const },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
          { role: 'quit' as const },
        ] satisfies MenuItemConstructorOptions[],
      }]
    : [];

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'Show Main Window',
        click: () => {
          if (!mainWindow) {
            createWindow();
            return;
          }

          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }

          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' as const },
      ...(process.platform === 'darwin' ? [{ role: 'close' as const }] : [{ role: 'quit' as const }]),
    ] satisfies MenuItemConstructorOptions[],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { role: 'reload' as const },
      { role: 'forceReload' as const },
      { role: 'togglefullscreen' as const },
      ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
    ] satisfies MenuItemConstructorOptions[],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [
      { role: 'minimize' as const },
      { role: 'zoom' as const },
      ...(process.platform === 'darwin' ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
    ] satisfies MenuItemConstructorOptions[],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: 'Help',
    submenu: [
      {
        label: 'About Scaffold Test Menu Bar 79141',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
    ] satisfies MenuItemConstructorOptions[],
  };

  return Menu.buildFromTemplate([...macMenu, fileMenu, viewMenu, windowMenu, helpMenu]);
}

function installApplicationMenu() {
  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu);
  menuInstalled = true;
}

function getMenuState() {
  return {
    enabled: menuInstalled,
    itemLabels: Menu.getApplicationMenu()?.items.map((item) => item.label || '').filter((value) => value.length > 0) ?? [],
  };
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.MENU_STATE_GET, async () => {
    return getMenuState();
  });

  ipcMain.handle(IPC_CHANNELS.MENU_REBUILD, async () => {
    installApplicationMenu();
    return getMenuState();
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
  installApplicationMenu();
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
