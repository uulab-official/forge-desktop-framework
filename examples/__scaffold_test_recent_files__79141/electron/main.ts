import { app, BrowserWindow, ipcMain, dialog, shell, type OpenDialogOptions } from 'electron';
import path from 'node:path';

import { readFile, writeFile } from 'node:fs/promises';
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

const enabledFeatures = ["recent-files","file-association","file-dialogs"];

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
  return normalized?.toLowerCase().endsWith(".scaffoldtestrecentfiles79141doc") ?? false;
}

function getFileAssociationState() {
  return {
    extension: "scaffoldtestrecentfiles79141doc",
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
  void rememberRecentFile(normalized);
  return getFileAssociationState();
}

function findAssociatedFileArg(args: string[]) {
  return args.find((value) => matchesAssociatedFile(value)) ?? null;
}

type FileDialogState = {
  suggestedName: string;
  lastOpenPath: string | null;
  lastSavePath: string | null;
  lastRevealPath: string | null;
  lastAction: 'open' | 'save' | 'reveal' | null;
};

const fileDialogState: FileDialogState = {
  suggestedName: "scaffoldtestrecentfiles79141-document.txt",
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
    await rememberRecentFile(result.filePaths[0]);
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
    await rememberRecentFile(result.filePath);
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
  void rememberRecentFile(normalized);
  return getFileDialogState();
}

type RecentFilesState = {
  limit: number;
  items: string[];
  lastOpenedPath: string | null;
};

const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json');
const recentFilesState: RecentFilesState = {
  limit: 8,
  items: [],
  lastOpenedPath: null,
};

function normalizeRecentFilePath(value: string | null | undefined) {
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

async function loadRecentFiles() {
  try {
    const raw = await readFile(recentFilesPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<RecentFilesState>;
    recentFilesState.items = Array.isArray(parsed.items)
      ? parsed.items.filter((value): value is string => typeof value === 'string').slice(0, recentFilesState.limit)
      : [];
    recentFilesState.lastOpenedPath = typeof parsed.lastOpenedPath === 'string' ? parsed.lastOpenedPath : null;
  } catch {
    recentFilesState.items = [];
    recentFilesState.lastOpenedPath = null;
  }
}

async function saveRecentFiles() {
  await writeFile(recentFilesPath, JSON.stringify(recentFilesState, null, 2), 'utf-8');
}

function getRecentFilesState() {
  return {
    limit: recentFilesState.limit,
    items: [...recentFilesState.items],
    lastOpenedPath: recentFilesState.lastOpenedPath,
  };
}

async function rememberRecentFile(value: string | null | undefined) {
  const normalized = normalizeRecentFilePath(value);
  if (!normalized) {
    return getRecentFilesState();
  }

  recentFilesState.items = [
    normalized,
    ...recentFilesState.items.filter((item) => item !== normalized),
  ].slice(0, recentFilesState.limit);
  recentFilesState.lastOpenedPath = normalized;
  app.addRecentDocument(normalized);
  await saveRecentFiles();
  return getRecentFilesState();
}

async function clearRecentFiles() {
  recentFilesState.items = [];
  recentFilesState.lastOpenedPath = null;
  app.clearRecentDocuments();
  await saveRecentFiles();
  return getRecentFilesState();
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

  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_GET_STATE, async () => {
    return getRecentFilesState();
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_ADD, async (_event, filePath: string) => {
    return rememberRecentFile(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_OPEN, async (_event, filePath: string) => {
    const normalized = normalizeRecentFilePath(filePath);
    if (normalized && matchesAssociatedFile(normalized)) {
      captureAssociatedFile(normalized, 'recent-files');
    }
    return rememberRecentFile(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_FILES_CLEAR, async () => {
    return clearRecentFiles();
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
  await loadRecentFiles();
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
