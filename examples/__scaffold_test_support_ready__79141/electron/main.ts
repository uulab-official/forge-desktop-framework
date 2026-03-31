import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

import { writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
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

const enabledFeatures = ["support-bundle","log-archive","incident-report","diagnostics-timeline"];

type LogArchiveFileEntry = {
  name: string;
  sourcePath: string;
  sizeBytes: number;
  modifiedAt: string;
};

type LogArchiveState = {
  logsPath: string;
  archiveDirectoryPath: string;
  fileCount: number;
  totalBytes: number;
  files: LogArchiveFileEntry[];
  lastArchivePath: string | null;
  lastArchivedAt: string | null;
  archiveCount: number;
  lastError: string | null;
};

const logArchiveState: LogArchiveState = {
  logsPath: app.getPath('logs'),
  archiveDirectoryPath: path.join(app.getPath('downloads'), "scaffoldtestsupportready79141-support", 'log-archives'),
  fileCount: 0,
  totalBytes: 0,
  files: [],
  lastArchivePath: null,
  lastArchivedAt: null,
  archiveCount: 0,
  lastError: null,
};

async function listLogArchiveFiles() {
  try {
    const entries = await readdir(logArchiveState.logsPath, { withFileTypes: true });
    const files = (
      await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
        const sourcePath = path.join(logArchiveState.logsPath, entry.name);
        const details = await stat(sourcePath);
        return {
          name: entry.name,
          sourcePath,
          sizeBytes: details.size,
          modifiedAt: details.mtime.toISOString(),
        } satisfies LogArchiveFileEntry;
      }))
    ).sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));

    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return [] as LogArchiveFileEntry[];
    }
    throw error;
  }
}

async function getLogArchiveState() {
  try {
    const files = await listLogArchiveFiles();
    logArchiveState.files = files;
    logArchiveState.fileCount = files.length;
    logArchiveState.totalBytes = files.reduce((total, entry) => total + entry.sizeBytes, 0);
    logArchiveState.lastError = null;
  } catch (error) {
    logArchiveState.lastError = error instanceof Error ? error.message : 'Unknown log archive inspection error';
  }

  return {
    logsPath: logArchiveState.logsPath,
    archiveDirectoryPath: logArchiveState.archiveDirectoryPath,
    fileCount: logArchiveState.fileCount,
    totalBytes: logArchiveState.totalBytes,
    files: [...logArchiveState.files],
    lastArchivePath: logArchiveState.lastArchivePath,
    lastArchivedAt: logArchiveState.lastArchivedAt,
    archiveCount: logArchiveState.archiveCount,
    lastError: logArchiveState.lastError,
  };
}

function createLogArchiveFolderName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `scaffoldtestsupportready79141-logs-${stamp}`;
}

async function exportLogArchive() {
  try {
    const files = await listLogArchiveFiles();
    await mkdir(logArchiveState.archiveDirectoryPath, { recursive: true });
    const archivePath = path.join(logArchiveState.archiveDirectoryPath, createLogArchiveFolderName());
    await mkdir(archivePath, { recursive: true });

    for (const entry of files) {
      await copyFile(entry.sourcePath, path.join(archivePath, entry.name));
    }

    const generatedAt = new Date().toISOString();
    const manifest = {
      generatedAt,
      sourceLogsPath: logArchiveState.logsPath,
      fileCount: files.length,
      totalBytes: files.reduce((total, entry) => total + entry.sizeBytes, 0),
      files,
    };

    await writeFile(path.join(archivePath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    logArchiveState.lastArchivePath = archivePath;
    logArchiveState.lastArchivedAt = generatedAt;
    logArchiveState.archiveCount += 1;
    logArchiveState.lastError = null;
    pushDiagnosticsTimelineEvent('support', 'log-archive-exported', archivePath);
    return getLogArchiveState();
  } catch (error) {
    logArchiveState.lastError = error instanceof Error ? error.message : 'Unknown log archive export error';
    throw error;
  }
}

async function revealLogArchive() {
  const targetPath = logArchiveState.lastArchivePath ?? logArchiveState.logsPath;
  try {
    shell.showItemInFolder(targetPath);
    logArchiveState.lastError = null;
    pushDiagnosticsTimelineEvent('support', 'log-archive-revealed', targetPath);
  } catch (error) {
    logArchiveState.lastError = error instanceof Error ? error.message : 'Unknown log archive reveal error';
  }
  return getLogArchiveState();
}

type IncidentReportSeverity = 'low' | 'medium' | 'high' | 'critical';

type IncidentReportDraft = {
  title: string;
  severity: IncidentReportSeverity;
  affectedArea: string;
  summary: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  recommendedAction: string;
  notes: string;
};

type IncidentReportState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  exportCount: number;
  lastError: string | null;
  currentDraft: IncidentReportDraft;
};

const defaultIncidentReportDraft: IncidentReportDraft = {
  title: "Scaffold Test Support Ready 79141 desktop issue",
  severity: 'medium',
  affectedArea: 'desktop-shell',
  summary: 'Customer-facing issue observed in the packaged desktop flow.',
  stepsToReproduce: '1. Launch the app\n2. Navigate to the affected workflow\n3. Capture the incorrect behavior',
  expectedBehavior: 'The workflow should complete without a shell or runtime issue.',
  actualBehavior: 'The desktop shell or runtime produced an unexpected result.',
  recommendedAction: 'Attach support bundle and logs, then triage with product and QA owners.',
  notes: '',
};

const incidentReportState: IncidentReportState = {
  directoryPath: path.join(app.getPath('downloads'), "scaffoldtestsupportready79141-support", 'incident-reports'),
  lastExportPath: null,
  lastGeneratedAt: null,
  exportCount: 0,
  lastError: null,
  currentDraft: { ...defaultIncidentReportDraft },
};

function getIncidentReportState() {
  return {
    directoryPath: incidentReportState.directoryPath,
    lastExportPath: incidentReportState.lastExportPath,
    lastGeneratedAt: incidentReportState.lastGeneratedAt,
    exportCount: incidentReportState.exportCount,
    lastError: incidentReportState.lastError,
    currentDraft: { ...incidentReportState.currentDraft },
  };
}

function sanitizeIncidentReportDraft(
  draft: Partial<IncidentReportDraft> | undefined,
): IncidentReportDraft {
  return {
    title: draft?.title?.trim() || defaultIncidentReportDraft.title,
    severity: draft?.severity && ['low', 'medium', 'high', 'critical'].includes(draft.severity)
      ? draft.severity
      : defaultIncidentReportDraft.severity,
    affectedArea: draft?.affectedArea?.trim() || defaultIncidentReportDraft.affectedArea,
    summary: draft?.summary?.trim() || defaultIncidentReportDraft.summary,
    stepsToReproduce: draft?.stepsToReproduce?.trim() || defaultIncidentReportDraft.stepsToReproduce,
    expectedBehavior: draft?.expectedBehavior?.trim() || defaultIncidentReportDraft.expectedBehavior,
    actualBehavior: draft?.actualBehavior?.trim() || defaultIncidentReportDraft.actualBehavior,
    recommendedAction: draft?.recommendedAction?.trim() || defaultIncidentReportDraft.recommendedAction,
    notes: draft?.notes?.trim() || '',
  };
}

function createIncidentReportFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `scaffoldtestsupportready79141-incident-report-${stamp}.json`;
}

async function exportIncidentReport(draft: Partial<IncidentReportDraft> | undefined) {
  try {
    await mkdir(incidentReportState.directoryPath, { recursive: true });
    const resolvedDraft = sanitizeIncidentReportDraft(draft);
    const generatedAt = new Date().toISOString();
    incidentReportState.currentDraft = { ...resolvedDraft };

    const payload = {
      generatedAt,
      runtime: {
        productName: "Scaffold Test Support Ready 79141",
        appId: "com.forge.scaffoldtestsupportready79141",
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        logsPath: app.getPath('logs'),
        downloadsPath: app.getPath('downloads'),
        userDataPath: app.getPath('userData'),
      },
      report: resolvedDraft,
      artifacts: {
        supportBundle: getSupportBundleState(),
        logArchive: await getLogArchiveState(),
        diagnosticsTimeline: getDiagnosticsTimelineState(),
      },
    };

    const filePath = path.join(incidentReportState.directoryPath, createIncidentReportFileName());
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    incidentReportState.lastExportPath = filePath;
    incidentReportState.lastGeneratedAt = generatedAt;
    incidentReportState.exportCount += 1;
    incidentReportState.lastError = null;
    pushDiagnosticsTimelineEvent('support', 'incident-report-exported', filePath);
    return getIncidentReportState();
  } catch (error) {
    incidentReportState.lastError = error instanceof Error ? error.message : 'Unknown incident report export error';
    throw error;
  }
}

async function revealIncidentReport() {
  const targetPath = incidentReportState.lastExportPath ?? incidentReportState.directoryPath;
  try {
    shell.showItemInFolder(targetPath);
    incidentReportState.lastError = null;
    pushDiagnosticsTimelineEvent('support', 'incident-report-revealed', targetPath);
  } catch (error) {
    incidentReportState.lastError = error instanceof Error ? error.message : 'Unknown incident report reveal error';
  }
  return getIncidentReportState();
}

type DiagnosticsTimelineCategory = 'app' | 'window' | 'support';

type DiagnosticsTimelineEntry = {
  id: string;
  category: DiagnosticsTimelineCategory;
  event: string;
  detail: string | null;
  timestamp: string;
};

type DiagnosticsTimelineState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastExportedAt: string | null;
  eventCount: number;
  lastEventAt: string | null;
  lastError: string | null;
  entries: DiagnosticsTimelineEntry[];
};

const diagnosticsTimelineLimit = 60;
const diagnosticsTimelineState: DiagnosticsTimelineState = {
  directoryPath: path.join(app.getPath('downloads'), "scaffoldtestsupportready79141-support", 'diagnostics-timeline'),
  lastExportPath: null,
  lastExportedAt: null,
  eventCount: 0,
  lastEventAt: null,
  lastError: null,
  entries: [],
};

function getDiagnosticsTimelineState() {
  return {
    directoryPath: diagnosticsTimelineState.directoryPath,
    lastExportPath: diagnosticsTimelineState.lastExportPath,
    lastExportedAt: diagnosticsTimelineState.lastExportedAt,
    eventCount: diagnosticsTimelineState.eventCount,
    lastEventAt: diagnosticsTimelineState.lastEventAt,
    lastError: diagnosticsTimelineState.lastError,
    entries: diagnosticsTimelineState.entries.map((entry) => ({ ...entry })),
  };
}

function pushDiagnosticsTimelineEvent(
  category: DiagnosticsTimelineCategory,
  event: string,
  detail?: string | null,
) {
  const timestamp = new Date().toISOString();
  diagnosticsTimelineState.lastEventAt = timestamp;
  diagnosticsTimelineState.eventCount += 1;
  diagnosticsTimelineState.entries = [
    {
      id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      category,
      event,
      detail: detail ?? null,
      timestamp,
    },
    ...diagnosticsTimelineState.entries,
  ].slice(0, diagnosticsTimelineLimit);
  return getDiagnosticsTimelineState();
}

function clearDiagnosticsTimelineHistory() {
  diagnosticsTimelineState.eventCount = 0;
  diagnosticsTimelineState.lastEventAt = null;
  diagnosticsTimelineState.lastError = null;
  diagnosticsTimelineState.entries = [];
  return getDiagnosticsTimelineState();
}

function createDiagnosticsTimelineFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `scaffoldtestsupportready79141-diagnostics-timeline-${stamp}.json`;
}

async function exportDiagnosticsTimeline() {
  try {
    const snapshot = pushDiagnosticsTimelineEvent('support', 'timeline-exported', diagnosticsTimelineState.lastExportPath);
    await mkdir(diagnosticsTimelineState.directoryPath, { recursive: true });
    const generatedAt = new Date().toISOString();
    const payload = {
      generatedAt,
      runtime: {
        productName: "Scaffold Test Support Ready 79141",
        appId: "com.forge.scaffoldtestsupportready79141",
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        userDataPath: app.getPath('userData'),
        logsPath: app.getPath('logs'),
        downloadsPath: app.getPath('downloads'),
      },
      timeline: snapshot,
    };
    const filePath = path.join(diagnosticsTimelineState.directoryPath, createDiagnosticsTimelineFileName());
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    diagnosticsTimelineState.lastExportPath = filePath;
    diagnosticsTimelineState.lastExportedAt = generatedAt;
    diagnosticsTimelineState.lastError = null;
    return getDiagnosticsTimelineState();
  } catch (error) {
    diagnosticsTimelineState.lastError = error instanceof Error ? error.message : 'Unknown diagnostics timeline export error';
    throw error;
  }
}

async function revealDiagnosticsTimeline() {
  const targetPath = diagnosticsTimelineState.lastExportPath ?? diagnosticsTimelineState.directoryPath;
  try {
    shell.showItemInFolder(targetPath);
    diagnosticsTimelineState.lastError = null;
  } catch (error) {
    diagnosticsTimelineState.lastError = error instanceof Error ? error.message : 'Unknown diagnostics timeline reveal error';
  }
  return getDiagnosticsTimelineState();
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
  directoryPath: path.join(app.getPath('downloads'), "scaffoldtestsupportready79141-support"),
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
  return `scaffoldtestsupportready79141-support-bundle-${stamp}.json`;
}

async function exportSupportBundle() {
  try {
    await mkdir(supportBundleState.directoryPath, { recursive: true });
    const generatedAt = new Date().toISOString();
    const includedSections = [
    'runtime',
    'logArchive',
    'diagnosticsTimeline',
  ] as const;

    const payload = {
      generatedAt,
      runtime: {
        productName: "Scaffold Test Support Ready 79141",
        appId: "com.forge.scaffoldtestsupportready79141",
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
    logArchive: await getLogArchiveState(),
    diagnosticsTimeline: getDiagnosticsTimelineState(),
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
    pushDiagnosticsTimelineEvent('support', 'support-bundle-exported', filePath);
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
    pushDiagnosticsTimelineEvent('support', 'support-bundle-revealed', targetPath);
  } catch (error) {
    supportBundleState.lastError = error instanceof Error ? error.message : 'Unknown support bundle reveal error';
  }
  return getSupportBundleState();
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Executing worker action', { action: request.action });
    return workerClient.execute(request);
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

  ipcMain.handle(IPC_CHANNELS.LOG_ARCHIVE_GET_STATE, async () => {
    return getLogArchiveState();
  });

  ipcMain.handle(IPC_CHANNELS.LOG_ARCHIVE_EXPORT, async () => {
    return exportLogArchive();
  });

  ipcMain.handle(IPC_CHANNELS.LOG_ARCHIVE_REVEAL, async () => {
    return revealLogArchive();
  });

  ipcMain.handle(IPC_CHANNELS.INCIDENT_REPORT_GET_STATE, async () => {
    return getIncidentReportState();
  });

  ipcMain.handle(IPC_CHANNELS.INCIDENT_REPORT_EXPORT, async (_event, draft?: Partial<IncidentReportDraft>) => {
    return exportIncidentReport(draft);
  });

  ipcMain.handle(IPC_CHANNELS.INCIDENT_REPORT_REVEAL, async () => {
    return revealIncidentReport();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_GET_STATE, async () => {
    return getDiagnosticsTimelineState();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_EXPORT, async () => {
    return exportDiagnosticsTimeline();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_REVEAL, async () => {
    return revealDiagnosticsTimeline();
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_CLEAR_HISTORY, async () => {
    return clearDiagnosticsTimelineHistory();
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

  pushDiagnosticsTimelineEvent('window', 'created', `window:${mainWindow.id}`);

  mainWindow.on('ready-to-show', () => {
    pushDiagnosticsTimelineEvent('window', 'ready-to-show', mainWindow ? `window:${mainWindow.id}` : null);
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    pushDiagnosticsTimelineEvent('window', 'closed', mainWindow ? `window:${mainWindow.id}` : null);
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
  pushDiagnosticsTimelineEvent('app', 'ready', isDev ? 'development' : 'packaged');
  app.on('activate', () => {
    pushDiagnosticsTimelineEvent('app', 'activate');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  pushDiagnosticsTimelineEvent('app', 'window-all-closed');
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  pushDiagnosticsTimelineEvent('app', 'before-quit');
  workerClient.dispose();
});
