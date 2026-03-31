import { app, BrowserWindow, ipcMain, Notification, Menu, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';
import { createSettingsManager } from '@forge/settings-core';
import { createJobEngine } from '@forge/job-engine';
import { createUpdater } from '@forge/updater';

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

const enabledFeatures = ["settings","updater","jobs","plugins","diagnostics","notifications","windowing","menu-bar"];
const settingsManager = createSettingsManager(path.join(app.getPath('userData'), 'settings.json'));
const jobEngine = createJobEngine(workerClient);
const updater = createUpdater({ autoDownload: false, autoInstallOnAppQuit: true });

const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
type WindowState = {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  maximized: boolean;
};

const defaultWindowState: WindowState = {
  width: 900,
  height: 680,
  x: null,
  y: null,
  maximized: false,
};
let windowState: WindowState = { ...defaultWindowState };

async function loadWindowState() {
  try {
    const raw = await readFile(windowStatePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    windowState = {
      width: typeof parsed.width === 'number' ? parsed.width : defaultWindowState.width,
      height: typeof parsed.height === 'number' ? parsed.height : defaultWindowState.height,
      x: typeof parsed.x === 'number' ? parsed.x : null,
      y: typeof parsed.y === 'number' ? parsed.y : null,
      maximized: parsed.maximized === true,
    };
  } catch {
    windowState = { ...defaultWindowState };
  }
}

async function saveWindowState(win: BrowserWindow) {
  const bounds = win.getBounds();
  windowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    maximized: win.isMaximized(),
  };
  await writeFile(windowStatePath, JSON.stringify(windowState, null, 2), 'utf-8');
}

async function resetWindowState() {
  windowState = { ...defaultWindowState };
  await writeFile(windowStatePath, JSON.stringify(windowState, null, 2), 'utf-8');
}

function getCurrentWindowState() {
  const bounds = mainWindow?.getBounds() ?? {
    width: windowState.width,
    height: windowState.height,
    x: windowState.x ?? undefined,
    y: windowState.y ?? undefined,
  };

  return {
    width: bounds.width,
    height: bounds.height,
    x: typeof bounds.x === 'number' ? bounds.x : null,
    y: typeof bounds.y === 'number' ? bounds.y : null,
    maximized: mainWindow?.isMaximized() ?? windowState.maximized,
    focused: mainWindow?.isFocused() ?? false,
  };
}


async function getDiagnosticsSummary() {
  return {
    productName: "Scaffold Test Launch Ready 79141",
    appId: "com.forge.scaffoldtestlaunchready79141",
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
  return `scaffoldtestlaunchready79141-diagnostics-${stamp}.json`;
}

async function exportDiagnosticsBundle() {
  const supportDir = path.join(app.getPath('downloads'), "scaffoldtestlaunchready79141-support");
  await mkdir(supportDir, { recursive: true });
  const filePath = path.join(supportDir, createDiagnosticsFileName());
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: await getDiagnosticsSummary(),
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { filePath, generatedAt: payload.generatedAt };
}

function buildApplicationMenu() {
  const macMenu: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [{
        label: "Scaffold Test Launch Ready 79141",
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
        label: 'About Scaffold Test Launch Ready 79141',
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

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsManager.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, key: string, value: unknown) => {
    settingsManager.set(key as never, value as never);
    await settingsManager.save();
  });

  ipcMain.handle(IPC_CHANNELS.JOB_SUBMIT, async (_event, action: string, payload: Record<string, unknown>) => {
    return jobEngine.submit(action, payload);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, async (_event, jobId: string) => {
    jobEngine.cancel(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_LIST, async () => {
    return jobEngine.getAllJobs();
  });

  ipcMain.handle(IPC_CHANNELS.JOB_STATUS, async (_event, jobId: string) => {
    return jobEngine.getJob(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    return updater.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    await updater.downloadUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    updater.quitAndInstall();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_STATUS, async () => {
    return updater.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_SUMMARY, async () => {
    return getDiagnosticsSummary();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_EXPORT, async () => {
    return exportDiagnosticsBundle();
  });

  ipcMain.handle(IPC_CHANNELS.NOTIFY_SHOW, async (_event, title: string, body: string) => {
    const safeTitle = title.trim() || "Scaffold Test Launch Ready 79141";
    const safeBody = body.trim() || 'Background work completed successfully.';

    if (!Notification.isSupported()) {
      return { supported: false, delivered: false };
    }

    const notification = new Notification({
      title: safeTitle,
      body: safeBody,
      silent: false,
    });

    notification.show();
    return { supported: true, delivered: true };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_STATE_GET, async () => {
    return getCurrentWindowState();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_FOCUS, async () => {
    if (!mainWindow) {
      createWindow();
      return getCurrentWindowState();
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
    return getCurrentWindowState();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_RESET, async () => {
    await resetWindowState();

    if (mainWindow) {
      mainWindow.unmaximize();
      mainWindow.setBounds({
        width: defaultWindowState.width,
        height: defaultWindowState.height,
      });
      mainWindow.center();
    }

    return getCurrentWindowState();
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
    width: windowState.width,
    height: windowState.height,
    ...(typeof windowState.x === 'number' && typeof windowState.y === 'number'
      ? { x: windowState.x, y: windowState.y }
      : {}),
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


  jobEngine.onJobUpdate((job) => {
    mainWindow?.webContents.send(IPC_CHANNELS.JOB_UPDATE, job);
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const persistWindowState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      void saveWindowState(mainWindow);
    }
  };

  mainWindow.on('resize', persistWindowState);
  mainWindow.on('move', persistWindowState);
  mainWindow.on('maximize', persistWindowState);
  mainWindow.on('unmaximize', persistWindowState);



  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  if (windowState.maximized) {
    mainWindow.maximize();
  }

}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  logger.info('App starting', { isDev, appRoot });
  await settingsManager.load();
  await loadWindowState();
  registerIpcHandlers();
  createWindow();
  installApplicationMenu();
  if (app.isPackaged) {
    setTimeout(() => {
      updater.checkForUpdates().catch(() => {
        logger.info('Initial update check skipped');
      });
    }, 3000);
  }
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    void saveWindowState(mainWindow);
  }
  updater.dispose();
  jobEngine.dispose();
});
