import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
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

const enabledFeatures = ["idle-presence"];

type IdlePresenceState = {
  supported: boolean;
  idleState: 'active' | 'idle' | 'locked' | 'unknown';
  idleTimeSeconds: number;
  thresholdSeconds: number;
  attention: 'focused' | 'visible' | 'hidden' | 'no-window';
  lastSampledAt: string | null;
  lastChangedAt: string | null;
  sampleCount: number;
  history: Array<{
    idleState: 'active' | 'idle' | 'locked' | 'unknown';
    idleTimeSeconds: number;
    attention: 'focused' | 'visible' | 'hidden' | 'no-window';
    timestamp: string;
  }>;
};

const idlePresenceThresholdSeconds = 45;
const idlePresenceHistoryLimit = 8;
const idlePresenceState: IdlePresenceState = {
  supported: true,
  idleState: 'unknown',
  idleTimeSeconds: 0,
  thresholdSeconds: idlePresenceThresholdSeconds,
  attention: 'no-window',
  lastSampledAt: null,
  lastChangedAt: null,
  sampleCount: 0,
  history: [],
};

function resolveIdlePresenceAttention(): IdlePresenceState['attention'] {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return 'no-window';
  }

  if (mainWindow.isFocused()) {
    return 'focused';
  }

  if (mainWindow.isVisible()) {
    return 'visible';
  }

  return 'hidden';
}

function resolveIdlePresenceSnapshot() {
  try {
    return {
      idleState: powerMonitor.getSystemIdleState(idlePresenceThresholdSeconds),
      idleTimeSeconds: powerMonitor.getSystemIdleTime(),
    };
  } catch {
    return {
      idleState: 'unknown' as const,
      idleTimeSeconds: 0,
    };
  }
}

function snapshotIdlePresence() {
  const snapshot = resolveIdlePresenceSnapshot();
  const attention = resolveIdlePresenceAttention();
  const timestamp = new Date().toISOString();
  const stateChanged = idlePresenceState.idleState !== snapshot.idleState
    || idlePresenceState.attention !== attention;

  idlePresenceState.supported = true;
  idlePresenceState.idleState = snapshot.idleState;
  idlePresenceState.idleTimeSeconds = snapshot.idleTimeSeconds;
  idlePresenceState.attention = attention;
  idlePresenceState.lastSampledAt = timestamp;
  idlePresenceState.sampleCount += 1;
  if (stateChanged || !idlePresenceState.lastChangedAt) {
    idlePresenceState.lastChangedAt = timestamp;
  }
  idlePresenceState.history = [
    {
      idleState: snapshot.idleState,
      idleTimeSeconds: snapshot.idleTimeSeconds,
      attention,
      timestamp,
    },
    ...idlePresenceState.history,
  ].slice(0, idlePresenceHistoryLimit);

  return {
    supported: idlePresenceState.supported,
    idleState: idlePresenceState.idleState,
    idleTimeSeconds: idlePresenceState.idleTimeSeconds,
    thresholdSeconds: idlePresenceState.thresholdSeconds,
    attention: idlePresenceState.attention,
    lastSampledAt: idlePresenceState.lastSampledAt,
    lastChangedAt: idlePresenceState.lastChangedAt,
    sampleCount: idlePresenceState.sampleCount,
    history: [...idlePresenceState.history],
  };
}

function clearIdlePresenceHistory() {
  idlePresenceState.lastSampledAt = null;
  idlePresenceState.lastChangedAt = null;
  idlePresenceState.sampleCount = 0;
  idlePresenceState.history = [];
  return snapshotIdlePresence();
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.IDLE_PRESENCE_GET_STATE, async () => {
    return snapshotIdlePresence();
  });

  ipcMain.handle(IPC_CHANNELS.IDLE_PRESENCE_CLEAR_HISTORY, async () => {
    return clearIdlePresenceHistory();
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
