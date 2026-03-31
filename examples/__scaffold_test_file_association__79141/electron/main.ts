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

const enabledFeatures = ["file-association"];

let lastAssociatedFilePath: string | null = null;
let lastAssociatedFileSource: string | null = null;

function normalizeAssociatedFilePath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(value).pathname);
    } catch {
      return null;
    }
  }

  return value;
}

function matchesAssociatedFile(value: string | null | undefined) {
  const normalized = normalizeAssociatedFilePath(value);
  return normalized?.toLowerCase().endsWith(".scaffoldtestfileassociation79141doc") ?? false;
}

function getFileAssociationState() {
  return {
    extension: "scaffoldtestfileassociation79141doc",
    lastPath: lastAssociatedFilePath,
    source: lastAssociatedFileSource,
  };
}

function captureAssociatedFile(value: string | null | undefined, source: string) {
  const normalized = normalizeAssociatedFilePath(value);
  if (!matchesAssociatedFile(normalized)) {
    return getFileAssociationState();
  }

  lastAssociatedFilePath = normalized;
  lastAssociatedFileSource = source;

  return getFileAssociationState();
}

function findAssociatedFileArg(args: string[]) {
  return args.find((value) => matchesAssociatedFile(value)) ?? null;
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_ASSOCIATION_GET_STATE, async () => {
    return getFileAssociationState();
  });

  ipcMain.handle(IPC_CHANNELS.FILE_ASSOCIATION_OPEN, async (_event, filePath: string) => {
    return captureAssociatedFile(filePath, 'manual');
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

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    captureAssociatedFile(findAssociatedFileArg(argv), 'second-instance');
    if (!mainWindow) {
      createWindow();
      return;
    }

  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  captureAssociatedFile(filePath, 'open-file');
});

app.whenReady().then(async () => {
  logger.info('App starting', { isDev, appRoot });
  registerIpcHandlers();
  captureAssociatedFile(findAssociatedFileArg(process.argv), 'startup-argv');
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
