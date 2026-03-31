import { app, BrowserWindow, ipcMain, dialog, shell, type OpenDialogOptions } from 'electron';
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

const enabledFeatures = ["file-dialogs"];

type FileDialogState = {
  suggestedName: string;
  lastOpenPath: string | null;
  lastSavePath: string | null;
  lastRevealPath: string | null;
  lastAction: 'open' | 'save' | 'reveal' | null;
};

const fileDialogState: FileDialogState = {
  suggestedName: "scaffoldtestfiledialogs79141-document.txt",
  lastOpenPath: null,
  lastSavePath: null,
  lastRevealPath: null,
  lastAction: null,
};

function normalizeDialogPath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(value).pathname);
    } catch {
      return value;
    }
  }

  return value;
}

function resolveDialogDefaultPath(value: string | null | undefined) {
  const normalized = normalizeDialogPath(value);
  if (normalized && normalized.trim().length > 0) {
    return normalized;
  }

  return path.join(app.getPath('documents'), fileDialogState.suggestedName);
}

function getFileDialogState() {
  return { ...fileDialogState };
}

async function openStarterFileDialog(defaultPath: string | null | undefined) {
  const options: OpenDialogOptions = {
    title: 'Open Document',
    defaultPath: resolveDialogDefaultPath(defaultPath),
    properties: ['openFile'],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (!result.canceled && result.filePaths[0]) {
    fileDialogState.lastOpenPath = result.filePaths[0];
    fileDialogState.lastAction = 'open';

  }

  return getFileDialogState();
}

async function saveStarterFileDialog(defaultPath: string | null | undefined) {
  const options = {
    title: 'Save Document',
    defaultPath: resolveDialogDefaultPath(defaultPath),
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (!result.canceled && result.filePath) {
    fileDialogState.lastSavePath = result.filePath;
    fileDialogState.lastAction = 'save';

  }

  return getFileDialogState();
}

function revealStarterPath(targetPath: string | null | undefined) {
  const normalized = normalizeDialogPath(targetPath)
    ?? fileDialogState.lastSavePath
    ?? fileDialogState.lastOpenPath;

  if (!normalized) {
    return getFileDialogState();
  }

  shell.showItemInFolder(normalized);
  fileDialogState.lastRevealPath = normalized;
  fileDialogState.lastAction = 'reveal';

  return getFileDialogState();
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_GET_STATE, async () => {
    return getFileDialogState();
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_OPEN, async (_event, defaultPath?: string) => {
    return openStarterFileDialog(defaultPath);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_SAVE, async (_event, defaultPath?: string) => {
    return saveStarterFileDialog(defaultPath);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOGS_REVEAL, async (_event, targetPath?: string) => {
    return revealStarterPath(targetPath);
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
