import { app, BrowserWindow, ipcMain, Notification, Menu, type MenuItemConstructorOptions, powerMonitor, net, shell, dialog, type OpenDialogOptions } from 'electron';
import path from 'node:path';
import os from 'node:os';

import { mkdir, readdir, rm, stat, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createResourceManager } from '@forge/resource-manager';
import { createWorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';
import { createSettingsManager } from '@forge/settings-core';
import { createJobEngine } from '@forge/job-engine';
import { createUpdater } from '@forge/updater';

const runtimePaths = {
  logs: path.join(app.getPath('userData'), 'logs'),
  crashDumps: path.join(app.getPath('userData'), 'crashDumps'),
};

app.setAppLogsPath(runtimePaths.logs);
app.setPath('crashDumps', runtimePaths.crashDumps);

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

const runtimeRetentionPolicy = {
  logs: {
    maxAgeDays: 14,
    maxEntries: 40,
  },
  crashDumps: {
    maxAgeDays: 7,
    maxEntries: 20,
  },
};

async function ensureRuntimeDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true });
}

async function pruneRuntimeDirectory(
  label: keyof typeof runtimeRetentionPolicy,
  directoryPath: string,
  policy: (typeof runtimeRetentionPolicy)[keyof typeof runtimeRetentionPolicy],
) {
  const cutoff = Date.now() - policy.maxAgeDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: Array<{ path: string; modifiedAt: number }> = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);
    const details = await stat(entryPath);
    files.push({
      path: entryPath,
      modifiedAt: details.mtimeMs,
    });
  }

  files.sort((left, right) => right.modifiedAt - left.modifiedAt);
  const removed: string[] = [];

  for (const [index, file] of files.entries()) {
    const expired = file.modifiedAt < cutoff;
    const overflow = index >= policy.maxEntries;
    if (!expired && !overflow) {
      continue;
    }

    await rm(file.path, { force: true });
    removed.push(path.basename(file.path));
  }

  return {
    label,
    retained: Math.max(files.length - removed.length, 0),
    removed,
  };
}

async function enforceRuntimeHygiene() {
  await ensureRuntimeDirectory(runtimePaths.logs);
  await ensureRuntimeDirectory(runtimePaths.crashDumps);

  const logs = await pruneRuntimeDirectory('logs', runtimePaths.logs, runtimeRetentionPolicy.logs);
  const crashDumps = await pruneRuntimeDirectory('crashDumps', runtimePaths.crashDumps, runtimeRetentionPolicy.crashDumps);

  logger.info('Runtime hygiene completed', {
    logsPath: runtimePaths.logs,
    crashDumpsPath: runtimePaths.crashDumps,
    logsRetained: logs.retained,
    logsRemoved: logs.removed,
    crashDumpsRetained: crashDumps.retained,
    crashDumpsRemoved: crashDumps.removed,
  });
}

const enabledFeatures = ["settings","updater","jobs","plugins","diagnostics","notifications","windowing","menu-bar","support-bundle","log-archive","incident-report","diagnostics-timeline","crash-recovery","system-info","network-status","power-monitor","idle-presence","session-state","file-association","file-dialogs","recent-files"];
const settingsManager = createSettingsManager(path.join(app.getPath('userData'), 'settings.json'));
const jobEngine = createJobEngine(workerClient);
const updater = createUpdater({ autoDownload: false, autoInstallOnAppQuit: true });
function isTrustedRendererUrl(targetUrl: string) {
  if (!targetUrl) {
    return false;
  }

  if (!isDev) {
    return targetUrl.startsWith('file://');
  }

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (!devServerUrl) {
    return false;
  }

  try {
    return new URL(targetUrl).origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}

function maybeOpenExternalUrl(targetUrl: string) {
  try {
    const parsed = new URL(targetUrl);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      void shell.openExternal(targetUrl);
    }
  } catch {
    // Ignore malformed URLs; they stay blocked inside the Electron shell.
  }
}


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
    productName: "Authority Repro 26172",
    appId: "com.forge.authorityrepro26172",
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
  return `authorityrepro26172-diagnostics-${stamp}.json`;
}

async function exportDiagnosticsBundle() {
  const supportDir = path.join(app.getPath('downloads'), "authorityrepro26172-support");
  await mkdir(supportDir, { recursive: true });
  const filePath = path.join(supportDir, createDiagnosticsFileName());
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: await getDiagnosticsSummary(),
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { filePath, generatedAt: payload.generatedAt };
}

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
  archiveDirectoryPath: path.join(app.getPath('downloads'), "authorityrepro26172-support", 'log-archives'),
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
  return `authorityrepro26172-logs-${stamp}`;
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
  title: "Authority Repro 26172 desktop issue",
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
  directoryPath: path.join(app.getPath('downloads'), "authorityrepro26172-support", 'incident-reports'),
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
  return `authorityrepro26172-incident-report-${stamp}.json`;
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
        productName: "Authority Repro 26172",
        appId: "com.forge.authorityrepro26172",
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
        crashRecovery: getCrashRecoveryState(),
        sessionState: getSessionStateSnapshot(),
        networkStatus: snapshotNetworkStatus(),
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
  directoryPath: path.join(app.getPath('downloads'), "authorityrepro26172-support", 'diagnostics-timeline'),
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
  return `authorityrepro26172-diagnostics-timeline-${stamp}.json`;
}

async function exportDiagnosticsTimeline() {
  try {
    const snapshot = pushDiagnosticsTimelineEvent('support', 'timeline-exported', diagnosticsTimelineState.lastExportPath);
    await mkdir(diagnosticsTimelineState.directoryPath, { recursive: true });
    const generatedAt = new Date().toISOString();
    const payload = {
      generatedAt,
      runtime: {
        productName: "Authority Repro 26172",
        appId: "com.forge.authorityrepro26172",
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
  directoryPath: path.join(app.getPath('downloads'), "authorityrepro26172-support"),
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
  return `authorityrepro26172-support-bundle-${stamp}.json`;
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
    'logArchive',
    'diagnosticsTimeline',
    'windowing',
    'menuBar',
    'fileAssociation',
    'fileDialogs',
    'recentFiles',
    'crashRecovery',
    'powerMonitor',
    'idlePresence',
    'sessionState',
  ] as const;

    const payload = {
      generatedAt,
      runtime: {
        productName: "Authority Repro 26172",
        appId: "com.forge.authorityrepro26172",
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
    logArchive: await getLogArchiveState(),
    diagnosticsTimeline: getDiagnosticsTimelineState(),
    windowing: getCurrentWindowState(),
    menuBar: getMenuState(),
    fileAssociation: getFileAssociationState(),
    fileDialogs: getFileDialogState(),
    recentFiles: getRecentFilesState(),
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

function buildApplicationMenu() {
  const macMenu: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [{
        label: "Authority Repro 26172",
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
        label: 'About Authority Repro 26172',
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
  return normalized?.toLowerCase().endsWith(".authorityrepro26172doc") ?? false;
}

function getFileAssociationState() {
  return {
    extension: "authorityrepro26172doc",
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
  suggestedName: "authorityrepro26172-document.txt",
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

  ipcMain.handle(IPC_CHANNELS.NOTIFY_SHOW, async (_event, title: string, body: string) => {
    const safeTitle = title.trim() || "Authority Repro 26172";
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
      sandbox: true,
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedRendererUrl(url)) {
      maybeOpenExternalUrl(url);
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRendererUrl(url)) {
      return;
    }

    event.preventDefault();
    maybeOpenExternalUrl(url);
  });

  pushDiagnosticsTimelineEvent('window', 'created', `window:${mainWindow.id}`);

  jobEngine.onJobUpdate((job) => {
    mainWindow?.webContents.send(IPC_CHANNELS.JOB_UPDATE, job);
  });

  mainWindow.on('ready-to-show', () => {
    pushDiagnosticsTimelineEvent('window', 'ready-to-show', mainWindow ? `window:${mainWindow.id}` : null);
    mainWindow?.show();
  });

  trackSessionWindow(mainWindow);

  mainWindow.on('closed', () => {
    pushDiagnosticsTimelineEvent('window', 'closed', mainWindow ? `window:${mainWindow.id}` : null);
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

  if (windowState.maximized) {
    mainWindow.maximize();
  }

}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    captureAssociatedFile(findAssociatedFileArg(argv), 'second-instance');
    if (!mainWindow) {
      pushDiagnosticsTimelineEvent('app', 'second-instance', 'recreated-window');
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

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  captureAssociatedFile(filePath, 'open-file');
});

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
  await enforceRuntimeHygiene();
  await settingsManager.load();
  await loadWindowState();
  await loadRecentFiles();
  await loadCrashRecoveryState();
  registerIpcHandlers();
  captureAssociatedFile(findAssociatedFileArg(process.argv), 'startup-argv');
  createWindow();
  pushDiagnosticsTimelineEvent('app', 'ready', isDev ? 'development' : 'packaged');
  installApplicationMenu();
  registerPowerMonitor();
  registerSessionState();
  if (app.isPackaged) {
    setTimeout(() => {
      updater.checkForUpdates().catch(() => {
        logger.info('Initial update check skipped');
      });
    }, 3000);
  }
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    void saveWindowState(mainWindow);
  }
  updater.dispose();
  jobEngine.dispose();
});
