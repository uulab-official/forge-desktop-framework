import { app, BrowserWindow, ipcMain, powerMonitor, net, shell } from 'electron';
import path from 'node:path';
import os from 'node:os';

import { readFile, writeFile, mkdir } from 'node:fs/promises';
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

const enabledFeatures = ["diagnostics","support-bundle","crash-recovery","system-info","network-status","power-monitor","idle-presence","session-state"];

async function getDiagnosticsSummary() {
  return {
    productName: "Scaffold Test Ops Ready 79141",
    appId: "com.forge.scaffoldtestopsready79141",
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    logsPath: app.getPath('logs'),
    workerPath: resourceManager.getWorkerPath(),
    pythonPath: resourceManager.getPythonPath(),
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron,
    enabledFeatures,
  };
}

function createDiagnosticsFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `scaffoldtestopsready79141-diagnostics-${stamp}.json`;
}

async function exportDiagnosticsBundle() {
  const supportDir = path.join(app.getPath('downloads'), "scaffoldtestopsready79141-support");
  await mkdir(supportDir, { recursive: true });
  const filePath = path.join(supportDir, createDiagnosticsFileName());
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: await getDiagnosticsSummary(),
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { filePath, generatedAt: payload.generatedAt };
}

type SupportBundleState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  lastSizeBytes: number | null;
  exportCount: number;
  includedSections: string[];
  lastError: string | null;
};

const supportBundleState: SupportBundleState = {
  directoryPath: path.join(app.getPath('downloads'), "scaffoldtestopsready79141-support"),
  lastExportPath: null,
  lastGeneratedAt: null,
  lastSizeBytes: null,
  exportCount: 0,
  includedSections: [],
  lastError: null,
};

function getSupportBundleState() {
  return {
    directoryPath: supportBundleState.directoryPath,
    lastExportPath: supportBundleState.lastExportPath,
    lastGeneratedAt: supportBundleState.lastGeneratedAt,
    lastSizeBytes: supportBundleState.lastSizeBytes,
    exportCount: supportBundleState.exportCount,
    includedSections: [...supportBundleState.includedSections],
    lastError: supportBundleState.lastError,
  };
}

function createSupportBundleFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `scaffoldtestopsready79141-support-bundle-${stamp}.json`;
}

async function exportSupportBundle() {
  try {
    await mkdir(supportBundleState.directoryPath, { recursive: true });
    const generatedAt = new Date().toISOString();
    const includedSections = [
    'runtime',
    'diagnostics',
    'systemInfo',
    'networkStatus',
    'crashRecovery',
    'powerMonitor',
    'idlePresence',
    'sessionState',
  ] as const;

    const payload = {
      generatedAt,
      runtime: {
        productName: "Scaffold Test Ops Ready 79141",
        appId: "com.forge.scaffoldtestopsready79141",
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        appPath: app.getAppPath(),
        userDataPath: app.getPath('userData'),
        logsPath: app.getPath('logs'),
        downloadsPath: app.getPath('downloads'),
        workerPath: resourceManager.getWorkerPath(),
        pythonPath: resourceManager.getPythonPath(),
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome,
        electronVersion: process.versions.electron,
        enabledFeatures,
      },
    diagnostics: await getDiagnosticsSummary(),
    systemInfo: await getSystemInfoState(),
    networkStatus: snapshotNetworkStatus(),
    crashRecovery: getCrashRecoveryState(),
    powerMonitor: getPowerMonitorState(),
    idlePresence: snapshotIdlePresence(),
    sessionState: getSessionStateSnapshot(),
  };

    const filePath = path.join(supportBundleState.directoryPath, createSupportBundleFileName());
    const body = JSON.stringify(payload, null, 2);
    await writeFile(filePath, body, 'utf-8');
    supportBundleState.lastExportPath = filePath;
    supportBundleState.lastGeneratedAt = generatedAt;
    supportBundleState.lastSizeBytes = Buffer.byteLength(body, 'utf-8');
    supportBundleState.exportCount += 1;
    supportBundleState.includedSections = [...includedSections];
    supportBundleState.lastError = null;
    return getSupportBundleState();
  } catch (error) {
    supportBundleState.lastError = error instanceof Error ? error.message : 'Unknown support bundle export error';
    throw error;
  }
}

async function revealSupportBundle() {
  const targetPath = supportBundleState.lastExportPath ?? supportBundleState.directoryPath;
  try {
    shell.showItemInFolder(targetPath);
    supportBundleState.lastError = null;
  } catch (error) {
    supportBundleState.lastError = error instanceof Error ? error.message : 'Unknown support bundle reveal error';
  }
  return getSupportBundleState();
}

function toMegabytes(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

async function getSystemInfoState() {
  const cpus = os.cpus();
  const memoryUsage = process.memoryUsage();

  return {
    refreshedAt: new Date().toISOString(),
    runtime: {
      appName: app.getName(),
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    },
    os: {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      release: os.release(),
      uptimeMinutes: Math.round(os.uptime() / 60),
      cpuModel: cpus[0]?.model ?? 'unknown',
      cpuCores: cpus.length,
      loadAverage: os.loadavg().map((value) => Math.round(value * 100) / 100),
      totalMemoryMb: toMegabytes(os.totalmem()),
      freeMemoryMb: toMegabytes(os.freemem()),
    },
    process: {
      pid: process.pid,
      processCount: app.getAppMetrics().length,
      rssMb: toMegabytes(memoryUsage.rss),
      heapUsedMb: toMegabytes(memoryUsage.heapUsed),
      heapTotalMb: toMegabytes(memoryUsage.heapTotal),
    },
    paths: {
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      tempPath: app.getPath('temp'),
      downloadsPath: app.getPath('downloads'),
      logsPath: app.getPath('logs'),
    },
  };
}

type NetworkStatusState = {
  supported: boolean;
  online: boolean;
  status: 'online' | 'offline';
  checkCount: number;
  lastCheckedAt: string | null;
  history: Array<{
    online: boolean;
    status: 'online' | 'offline';
    timestamp: string;
  }>;
};

const networkStatusHistoryLimit = 8;
const networkStatusState: NetworkStatusState = {
  supported: typeof net.isOnline === 'function',
  online: true,
  status: 'online',
  checkCount: 0,
  lastCheckedAt: null,
  history: [],
};

function snapshotNetworkStatus() {
  const online = typeof net.isOnline === 'function' ? net.isOnline() : true;
  const status: NetworkStatusState['status'] = online ? 'online' : 'offline';
  const timestamp = new Date().toISOString();
  networkStatusState.supported = typeof net.isOnline === 'function';
  networkStatusState.online = online;
  networkStatusState.status = status;
  networkStatusState.lastCheckedAt = timestamp;
  networkStatusState.checkCount += 1;
  const history: NetworkStatusState['history'] = [
    {
      online,
      status,
      timestamp,
    },
    ...networkStatusState.history,
  ].slice(0, networkStatusHistoryLimit);
  networkStatusState.history = history;
  return {
    supported: networkStatusState.supported,
    online: networkStatusState.online,
    status: networkStatusState.status,
    checkCount: networkStatusState.checkCount,
    lastCheckedAt: networkStatusState.lastCheckedAt,
    history: [...networkStatusState.history],
  };
}

function clearNetworkStatusHistory() {
  networkStatusState.checkCount = 0;
  networkStatusState.lastCheckedAt = null;
  networkStatusState.history = [];
  return snapshotNetworkStatus();
}

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

type SessionEventName =
  | 'ready'
  | 'activate'
  | 'browser-window-focus'
  | 'browser-window-blur'
  | 'show'
  | 'hide'
  | 'before-quit'
  | 'window-all-closed';

type SessionLifecycle = 'ready' | 'active' | 'background' | 'hidden' | 'quitting';
type SessionAttention = 'focused' | 'visible' | 'hidden' | 'no-window';

type SessionStateSnapshot = {
  startedAt: string;
  lifecycle: SessionLifecycle;
  attention: SessionAttention;
  windowCount: number;
  visibleWindowCount: number;
  focusedWindowCount: number;
  lastEvent: SessionEventName | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{
    name: SessionEventName;
    timestamp: string;
    detail: string | null;
  }>;
};

const sessionStateHistoryLimit = 10;
const sessionStartedAt = new Date().toISOString();
let sessionStateRegistered = false;
let sessionStateQuitting = false;
const sessionStateSnapshot: SessionStateSnapshot = {
  startedAt: sessionStartedAt,
  lifecycle: 'ready',
  attention: 'no-window',
  windowCount: 0,
  visibleWindowCount: 0,
  focusedWindowCount: 0,
  lastEvent: null,
  lastEventAt: null,
  eventCount: 0,
  history: [],
};

function resolveSessionAttention(): SessionAttention {
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  if (windows.length === 0) {
    return 'no-window';
  }

  if (windows.some((window) => window.isFocused())) {
    return 'focused';
  }

  if (windows.some((window) => window.isVisible())) {
    return 'visible';
  }

  return 'hidden';
}

function resolveSessionLifecycle(
  attention: SessionAttention,
  windowCount: number,
  visibleWindowCount: number,
): SessionLifecycle {
  if (sessionStateQuitting) {
    return 'quitting';
  }

  if (attention === 'focused') {
    return 'active';
  }

  if (visibleWindowCount > 0) {
    return 'background';
  }

  if (windowCount > 0) {
    return 'hidden';
  }

  return 'ready';
}

function getSessionStateSnapshot() {
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  const visibleWindowCount = windows.filter((window) => window.isVisible()).length;
  const focusedWindowCount = windows.filter((window) => window.isFocused()).length;
  const attention = resolveSessionAttention();

  sessionStateSnapshot.attention = attention;
  sessionStateSnapshot.windowCount = windows.length;
  sessionStateSnapshot.visibleWindowCount = visibleWindowCount;
  sessionStateSnapshot.focusedWindowCount = focusedWindowCount;
  sessionStateSnapshot.lifecycle = resolveSessionLifecycle(attention, windows.length, visibleWindowCount);

  return {
    startedAt: sessionStateSnapshot.startedAt,
    lifecycle: sessionStateSnapshot.lifecycle,
    attention: sessionStateSnapshot.attention,
    windowCount: sessionStateSnapshot.windowCount,
    visibleWindowCount: sessionStateSnapshot.visibleWindowCount,
    focusedWindowCount: sessionStateSnapshot.focusedWindowCount,
    lastEvent: sessionStateSnapshot.lastEvent,
    lastEventAt: sessionStateSnapshot.lastEventAt,
    eventCount: sessionStateSnapshot.eventCount,
    history: [...sessionStateSnapshot.history],
  };
}

function recordSessionEvent(name: SessionEventName, detail: string | null = null) {
  const timestamp = new Date().toISOString();
  sessionStateSnapshot.lastEvent = name;
  sessionStateSnapshot.lastEventAt = timestamp;
  sessionStateSnapshot.eventCount += 1;
  sessionStateSnapshot.history = [
    { name, timestamp, detail },
    ...sessionStateSnapshot.history,
  ].slice(0, sessionStateHistoryLimit);
  return getSessionStateSnapshot();
}

function clearSessionStateHistory() {
  sessionStateSnapshot.lastEvent = null;
  sessionStateSnapshot.lastEventAt = null;
  sessionStateSnapshot.eventCount = 0;
  sessionStateSnapshot.history = [];
  return getSessionStateSnapshot();
}

function trackSessionWindow(window: BrowserWindow) {
  const detail = `window:${window.id}`;
  window.on('show', () => {
    recordSessionEvent('show', detail);
  });
  window.on('hide', () => {
    recordSessionEvent('hide', detail);
  });
}

function registerSessionState() {
  if (sessionStateRegistered) {
    return;
  }

  sessionStateRegistered = true;
  app.on('activate', () => {
    recordSessionEvent('activate');
  });
  app.on('browser-window-focus', (_event, window) => {
    recordSessionEvent('browser-window-focus', `window:${window.id}`);
  });
  app.on('browser-window-blur', (_event, window) => {
    recordSessionEvent('browser-window-blur', `window:${window.id}`);
  });
  app.on('before-quit', () => {
    sessionStateQuitting = true;
    recordSessionEvent('before-quit');
  });
  app.on('window-all-closed', () => {
    recordSessionEvent('window-all-closed');
  });
  recordSessionEvent('ready');
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_SUMMARY, async () => {
    return getDiagnosticsSummary();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_EXPORT, async () => {
    return exportDiagnosticsBundle();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO_GET_STATE, async () => {
    return getSystemInfoState();
  });

  ipcMain.handle(IPC_CHANNELS.NETWORK_STATUS_GET_STATE, async () => {
    return snapshotNetworkStatus();
  });

  ipcMain.handle(IPC_CHANNELS.NETWORK_STATUS_CLEAR_HISTORY, async () => {
    return clearNetworkStatusHistory();
  });

  ipcMain.handle(IPC_CHANNELS.SUPPORT_BUNDLE_GET_STATE, async () => {
    return getSupportBundleState();
  });

  ipcMain.handle(IPC_CHANNELS.SUPPORT_BUNDLE_EXPORT, async () => {
    return exportSupportBundle();
  });

  ipcMain.handle(IPC_CHANNELS.SUPPORT_BUNDLE_REVEAL, async () => {
    return revealSupportBundle();
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

  ipcMain.handle(IPC_CHANNELS.POWER_MONITOR_GET_STATE, async () => {
    return getPowerMonitorState();
  });

  ipcMain.handle(IPC_CHANNELS.POWER_MONITOR_CLEAR_HISTORY, async () => {
    return clearPowerMonitorHistory();
  });

  ipcMain.handle(IPC_CHANNELS.IDLE_PRESENCE_GET_STATE, async () => {
    return snapshotIdlePresence();
  });

  ipcMain.handle(IPC_CHANNELS.IDLE_PRESENCE_CLEAR_HISTORY, async () => {
    return clearIdlePresenceHistory();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_STATE_GET, async () => {
    return getSessionStateSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_STATE_CLEAR_HISTORY, async () => {
    return clearSessionStateHistory();
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

  trackSessionWindow(mainWindow);

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
  registerPowerMonitor();
  registerSessionState();
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
