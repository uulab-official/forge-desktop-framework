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

const enabledFeatures = ["power-monitor"];

type PowerMonitorEventName = 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery';

type PowerMonitorState = {
  supported: boolean;
  powerSource: 'ac' | 'battery' | 'unknown';
  idleState: 'active' | 'idle' | 'locked' | 'unknown';
  idleTimeSeconds: number;
  lastEvent: PowerMonitorEventName | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{ name: PowerMonitorEventName; timestamp: string }>;
};

const powerMonitorHistoryLimit = 6;
const powerMonitorState: PowerMonitorState = {
  supported: true,
  powerSource: 'unknown',
  idleState: 'unknown',
  idleTimeSeconds: 0,
  lastEvent: null,
  lastEventAt: null,
  eventCount: 0,
  history: [],
};

function resolvePowerSource() {
  try {
    return powerMonitor.isOnBatteryPower() ? 'battery' : 'ac';
  } catch {
    return 'unknown';
  }
}

function resolveIdleSnapshot() {
  try {
    return {
      idleState: powerMonitor.getSystemIdleState(60),
      idleTimeSeconds: powerMonitor.getSystemIdleTime(),
    };
  } catch {
    return {
      idleState: 'unknown' as const,
      idleTimeSeconds: 0,
    };
  }
}

function getPowerMonitorState() {
  const idleSnapshot = resolveIdleSnapshot();
  powerMonitorState.powerSource = resolvePowerSource();
  powerMonitorState.idleState = idleSnapshot.idleState;
  powerMonitorState.idleTimeSeconds = idleSnapshot.idleTimeSeconds;

  return {
    supported: powerMonitorState.supported,
    powerSource: powerMonitorState.powerSource,
    idleState: powerMonitorState.idleState,
    idleTimeSeconds: powerMonitorState.idleTimeSeconds,
    lastEvent: powerMonitorState.lastEvent,
    lastEventAt: powerMonitorState.lastEventAt,
    eventCount: powerMonitorState.eventCount,
    history: [...powerMonitorState.history],
  };
}

function recordPowerMonitorEvent(name: PowerMonitorEventName) {
  const timestamp = new Date().toISOString();
  powerMonitorState.lastEvent = name;
  powerMonitorState.lastEventAt = timestamp;
  powerMonitorState.eventCount += 1;
  powerMonitorState.history = [{ name, timestamp }, ...powerMonitorState.history].slice(0, powerMonitorHistoryLimit);
  return getPowerMonitorState();
}

function clearPowerMonitorHistory() {
  powerMonitorState.lastEvent = null;
  powerMonitorState.lastEventAt = null;
  powerMonitorState.eventCount = 0;
  powerMonitorState.history = [];
  return getPowerMonitorState();
}

function registerPowerMonitor() {
  powerMonitor.on('suspend', () => {
    recordPowerMonitorEvent('suspend');
  });
  powerMonitor.on('resume', () => {
    recordPowerMonitorEvent('resume');
  });
  powerMonitor.on('lock-screen', () => {
    recordPowerMonitorEvent('lock-screen');
  });
  powerMonitor.on('unlock-screen', () => {
    recordPowerMonitorEvent('unlock-screen');
  });
  powerMonitor.on('on-ac', () => {
    recordPowerMonitorEvent('on-ac');
  });
  powerMonitor.on('on-battery', () => {
    recordPowerMonitorEvent('on-battery');
  });
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.POWER_MONITOR_GET_STATE, async () => {
    return getPowerMonitorState();
  });

  ipcMain.handle(IPC_CHANNELS.POWER_MONITOR_CLEAR_HISTORY, async () => {
    return clearPowerMonitorHistory();
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
  registerPowerMonitor();
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
