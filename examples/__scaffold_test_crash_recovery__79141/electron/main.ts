import { app, BrowserWindow, ipcMain } from 'electron';
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

const enabledFeatures = ["crash-recovery"];

type CrashIncident = {
  scope: 'renderer' | 'window' | 'child-process';
  reason: string;
  details: string | null;
  timestamp: string;
};

type CrashRecoveryState = {
  hasIncident: boolean;
  lastIncident: CrashIncident | null;
};

const crashRecoveryPath = path.join(app.getPath('userData'), 'crash-recovery.json');
const crashRecoveryState: CrashRecoveryState = {
  hasIncident: false,
  lastIncident: null,
};

async function loadCrashRecoveryState() {
  try {
    const raw = await readFile(crashRecoveryPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CrashRecoveryState>;
    crashRecoveryState.hasIncident = parsed.hasIncident === true;
    crashRecoveryState.lastIncident = parsed.lastIncident
      && typeof parsed.lastIncident.reason === 'string'
      && typeof parsed.lastIncident.scope === 'string'
      && typeof parsed.lastIncident.timestamp === 'string'
      ? {
          scope: parsed.lastIncident.scope as CrashIncident['scope'],
          reason: parsed.lastIncident.reason,
          details: typeof parsed.lastIncident.details === 'string' ? parsed.lastIncident.details : null,
          timestamp: parsed.lastIncident.timestamp,
        }
      : null;
  } catch {
    crashRecoveryState.hasIncident = false;
    crashRecoveryState.lastIncident = null;
  }
}

async function saveCrashRecoveryState() {
  await writeFile(crashRecoveryPath, JSON.stringify(crashRecoveryState, null, 2), 'utf-8');
}

function getCrashRecoveryState() {
  return {
    hasIncident: crashRecoveryState.hasIncident,
    lastIncident: crashRecoveryState.lastIncident,
  };
}

function getCrashDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) {
    return null;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
}

async function recordCrashIncident(
  scope: CrashIncident['scope'],
  reason: string,
  details: string | null = null,
) {
  crashRecoveryState.hasIncident = true;
  crashRecoveryState.lastIncident = {
    scope,
    reason,
    details,
    timestamp: new Date().toISOString(),
  };
  await saveCrashRecoveryState();
  return getCrashRecoveryState();
}

async function clearCrashRecoveryState() {
  crashRecoveryState.hasIncident = false;
  crashRecoveryState.lastIncident = null;
  await saveCrashRecoveryState();
  return getCrashRecoveryState();
}

function relaunchFromCrashRecovery() {
  app.relaunch();
  setTimeout(() => {
    app.exit(0);
  }, 25);

  return {
    ...getCrashRecoveryState(),
    relaunching: true,
  };
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.CRASH_RECOVERY_GET_STATE, async () => {
    return getCrashRecoveryState();
  });

  ipcMain.handle(IPC_CHANNELS.CRASH_RECOVERY_CLEAR, async () => {
    return clearCrashRecoveryState();
  });

  ipcMain.handle(IPC_CHANNELS.CRASH_RECOVERY_RELAUNCH, async () => {
    return relaunchFromCrashRecovery();
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


  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    void recordCrashIncident('renderer', details.reason, getCrashDetails({
      exitCode: details.exitCode,
    }));
  });

  mainWindow.on('unresponsive', () => {
    void recordCrashIncident('window', 'unresponsive', 'Main window stopped responding.');
  });


  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }


}

app.on('child-process-gone', (_event, details) => {
  void recordCrashIncident('child-process', details.reason, getCrashDetails({
    type: details.type,
    name: details.name,
    serviceName: details.serviceName,
    exitCode: details.exitCode,
  }));
});

app.whenReady().then(async () => {
  logger.info('App starting', { isDev, appRoot });
  await loadCrashRecoveryState();
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
