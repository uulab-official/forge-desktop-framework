import { useEffect, useState } from 'react';
import type { AppSettings, JobDefinition } from '@forge/ipc-contract';
import { forgeFeaturePlugins } from './plugins';

type DiagnosticsSummary = {
  productName: string;
  appId: string;
  version: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
  appPath: string;
  userDataPath: string;
  logsPath: string;
  workerPath: string;
  pythonPath: string;
  nodeVersion: string;
  chromeVersion: string;
  electronVersion: string;
  enabledFeatures: string[];
};

type SystemInfoState = {
  refreshedAt: string;
  runtime: {
    appName: string;
    appVersion: string;
    isPackaged: boolean;
    electronVersion: string;
    chromeVersion: string;
    nodeVersion: string;
  };
  os: {
    platform: string;
    arch: string;
    hostname: string;
    release: string;
    uptimeMinutes: number;
    cpuModel: string;
    cpuCores: number;
    loadAverage: number[];
    totalMemoryMb: number;
    freeMemoryMb: number;
  };
  process: {
    pid: number;
    processCount: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  paths: {
    appPath: string;
    userDataPath: string;
    tempPath: string;
    downloadsPath: string;
    logsPath: string;
  };
};

type PermissionsState = {
  platform: string;
  camera: {
    status: string;
    supported: boolean;
    canRequest: boolean;
  };
  microphone: {
    status: string;
    supported: boolean;
    canRequest: boolean;
  };
  screen: {
    status: string;
    supported: boolean;
    canRequest: boolean;
  };
  lastRequest: {
    kind: 'camera' | 'microphone' | null;
    granted: boolean | null;
    timestamp: string | null;
    error: string | null;
  };
};

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

type SecureStorageState = {
  supported: boolean;
  label: string | null;
  hasStoredValue: boolean;
  lastUpdatedAt: string | null;
  lastLoadedValue: string | null;
  lastError: string | null;
};

type SupportBundleState = {
  directoryPath: string;
  lastExportPath: string | null;
  lastGeneratedAt: string | null;
  lastSizeBytes: number | null;
  exportCount: number;
  includedSections: string[];
  lastError: string | null;
};

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

type DiagnosticsTimelineEntry = {
  id: string;
  category: 'app' | 'window' | 'support';
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

type WindowStateSummary = {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  maximized: boolean;
  focused: boolean;
};

type TrayStatus = {
  enabled: boolean;
  windowVisible: boolean;
};

type DeepLinkState = {
  scheme: string;
  lastUrl: string | null;
};

type MenuBarState = {
  enabled: boolean;
  itemLabels: string[];
};

type AutoLaunchState = {
  supported: boolean;
  enabled: boolean;
  openAsHidden: boolean;
};

type GlobalShortcutState = {
  accelerator: string;
  enabled: boolean;
  registered: boolean;
  lastTriggeredAt: string | null;
  error: string | null;
};

type FileAssociationState = {
  extension: string;
  lastPath: string | null;
  source: string | null;
};

type FileDialogState = {
  suggestedName: string;
  lastOpenPath: string | null;
  lastSavePath: string | null;
  lastRevealPath: string | null;
  lastAction: 'open' | 'save' | 'reveal' | null;
};

type RecentFilesState = {
  limit: number;
  items: string[];
  lastOpenedPath: string | null;
};

type CrashRecoveryState = {
  hasIncident: boolean;
  lastIncident: {
    scope: 'renderer' | 'window' | 'child-process';
    reason: string;
    details: string | null;
    timestamp: string;
  } | null;
};

type PowerMonitorState = {
  supported: boolean;
  powerSource: 'ac' | 'battery' | 'unknown';
  idleState: 'active' | 'idle' | 'locked' | 'unknown';
  idleTimeSeconds: number;
  lastEvent: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery' | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{
    name: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery';
    timestamp: string;
  }>;
};

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

type SessionStateSnapshot = {
  startedAt: string;
  lifecycle: 'ready' | 'active' | 'background' | 'hidden' | 'quitting';
  attention: 'focused' | 'visible' | 'hidden' | 'no-window';
  windowCount: number;
  visibleWindowCount: number;
  focusedWindowCount: number;
  lastEvent: 'ready' | 'activate' | 'browser-window-focus' | 'browser-window-blur' | 'show' | 'hide' | 'before-quit' | 'window-all-closed' | null;
  lastEventAt: string | null;
  eventCount: number;
  history: Array<{
    name: 'ready' | 'activate' | 'browser-window-focus' | 'browser-window-blur' | 'show' | 'hide' | 'before-quit' | 'window-all-closed';
    timestamp: string;
    detail: string | null;
  }>;
};

type DownloadsState = {
  sampleUrl: string;
  activeCount: number;
  lastDownloadPath: string | null;
  items: Array<{
    id: string;
    url: string;
    fileName: string;
    savePath: string | null;
    state: 'idle' | 'progressing' | 'completed' | 'cancelled' | 'interrupted';
    receivedBytes: number;
    totalBytes: number;
    startedAt: string;
    finishedAt: string | null;
  }>;
};

type ClipboardState = {
  currentText: string;
  lastAction: 'read' | 'write' | 'clear' | null;
  history: Array<{
    action: 'read' | 'write' | 'clear';
    text: string;
    timestamp: string;
  }>;
};

type ExternalLinksState = {
  defaultUrl: string;
  lastUrl: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  lastError: string | null;
  history: Array<{
    url: string;
    status: 'opened' | 'failed';
    error: string | null;
    timestamp: string;
  }>;
};

type ForgeDesktopAPI = {
  settings?: {
    get: () => Promise<AppSettings>;
    set: (key: keyof AppSettings, value: unknown) => Promise<void>;
  };
  job?: {
    submit: (action: string, payload: Record<string, unknown>) => Promise<string> | string;
    list: () => Promise<JobDefinition[]>;
    onUpdate: (cb: (job: JobDefinition) => void) => () => void;
  };
  updater?: {
    check: () => Promise<unknown>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    getStatus: () => Promise<{
      status: string;
      version?: string;
      progress?: { percent: number };
      error?: string;
    }>;
  };
  diagnostics?: {
    getSummary: () => Promise<DiagnosticsSummary>;
    exportBundle: () => Promise<{ filePath: string; generatedAt: string }>;
  };
  systemInfo?: {
    getState: () => Promise<SystemInfoState>;
  };
  permissions?: {
    getState: () => Promise<PermissionsState>;
    request: (kind: 'camera' | 'microphone') => Promise<PermissionsState>;
  };
  networkStatus?: {
    getState: () => Promise<NetworkStatusState>;
    clearHistory: () => Promise<NetworkStatusState>;
  };
  secureStorage?: {
    getState: () => Promise<SecureStorageState>;
    save: (label?: string, value?: string) => Promise<SecureStorageState>;
    load: () => Promise<SecureStorageState>;
    clear: () => Promise<SecureStorageState>;
  };
  supportBundle?: {
    getState: () => Promise<SupportBundleState>;
    export: () => Promise<SupportBundleState>;
    reveal: () => Promise<SupportBundleState>;
  };
  logArchive?: {
    getState: () => Promise<LogArchiveState>;
    export: () => Promise<LogArchiveState>;
    reveal: () => Promise<LogArchiveState>;
  };
  incidentReport?: {
    getState: () => Promise<IncidentReportState>;
    export: (draft?: IncidentReportDraft) => Promise<IncidentReportState>;
    reveal: () => Promise<IncidentReportState>;
  };
  diagnosticsTimeline?: {
    getState: () => Promise<DiagnosticsTimelineState>;
    export: () => Promise<DiagnosticsTimelineState>;
    reveal: () => Promise<DiagnosticsTimelineState>;
    clearHistory: () => Promise<DiagnosticsTimelineState>;
  };
  notifications?: {
    show: (title: string, body: string) => Promise<{ supported: boolean; delivered: boolean }>;
  };
  windowing?: {
    getState: () => Promise<WindowStateSummary>;
    focus: () => Promise<WindowStateSummary>;
    reset: () => Promise<WindowStateSummary>;
  };
  tray?: {
    getStatus: () => Promise<TrayStatus>;
    toggleWindow: () => Promise<TrayStatus>;
  };
  deepLink?: {
    getLast: () => Promise<DeepLinkState>;
    open: (url: string) => Promise<DeepLinkState>;
  };
  menuBar?: {
    getState: () => Promise<MenuBarState>;
    rebuild: () => Promise<MenuBarState>;
  };
  autoLaunch?: {
    getStatus: () => Promise<AutoLaunchState>;
    setEnabled: (enabled: boolean) => Promise<AutoLaunchState>;
  };
  globalShortcut?: {
    getStatus: () => Promise<GlobalShortcutState>;
    setEnabled: (enabled: boolean) => Promise<GlobalShortcutState>;
    trigger: () => Promise<GlobalShortcutState>;
  };
  fileAssociation?: {
    getState: () => Promise<FileAssociationState>;
    open: (filePath: string) => Promise<FileAssociationState>;
  };
  fileDialogs?: {
    getState: () => Promise<FileDialogState>;
    open: (defaultPath?: string) => Promise<FileDialogState>;
    save: (defaultPath?: string) => Promise<FileDialogState>;
    reveal: (targetPath?: string) => Promise<FileDialogState>;
  };
  recentFiles?: {
    getState: () => Promise<RecentFilesState>;
    add: (filePath: string) => Promise<RecentFilesState>;
    open: (filePath: string) => Promise<RecentFilesState>;
    clear: () => Promise<RecentFilesState>;
  };
  crashRecovery?: {
    getState: () => Promise<CrashRecoveryState>;
    clear: () => Promise<CrashRecoveryState>;
    relaunch: () => Promise<CrashRecoveryState & { relaunching?: boolean }>;
  };
  powerMonitor?: {
    getState: () => Promise<PowerMonitorState>;
    clearHistory: () => Promise<PowerMonitorState>;
  };
  idlePresence?: {
    getState: () => Promise<IdlePresenceState>;
    clearHistory: () => Promise<IdlePresenceState>;
  };
  sessionState?: {
    getState: () => Promise<SessionStateSnapshot>;
    clearHistory: () => Promise<SessionStateSnapshot>;
  };
  downloads?: {
    getState: () => Promise<DownloadsState>;
    start: (url?: string) => Promise<DownloadsState>;
    clearHistory: () => Promise<DownloadsState>;
    reveal: (targetPath?: string) => Promise<DownloadsState>;
  };
  clipboard?: {
    getState: () => Promise<ClipboardState>;
    readText: () => Promise<ClipboardState>;
    writeText: (text?: string) => Promise<ClipboardState>;
    clear: () => Promise<ClipboardState>;
  };
  externalLinks?: {
    getState: () => Promise<ExternalLinksState>;
    open: (url?: string) => Promise<ExternalLinksState>;
    clearHistory: () => Promise<ExternalLinksState>;
  };
};

function getDesktopApi(): ForgeDesktopAPI | undefined {
  const value = (window as unknown as Record<string, unknown>).api;
  return value as ForgeDesktopAPI | undefined;
}

export function FeatureStudio() {
  const api = getDesktopApi();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [jobs, setJobs] = useState<JobDefinition[]>([]);
  const [updateStatus, setUpdateStatus] = useState<{ status: string; version?: string; progress?: { percent: number }; error?: string }>({ status: 'idle' });
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [diagnosticsExport, setDiagnosticsExport] = useState<{ filePath: string; generatedAt: string } | null>(null);
  const [notificationDraft, setNotificationDraft] = useState({ title: 'Forge Ready', body: 'Scaffold Test Launch Ready 79141 is ready for customer testing.' });
  const [notificationState, setNotificationState] = useState<'idle' | 'sent' | 'unsupported'>('idle');
  const [windowState, setWindowState] = useState<WindowStateSummary | null>(null);
  const [menuBarState, setMenuBarState] = useState<MenuBarState | null>(null);
  const featureNames = ["settings","updater","jobs","plugins","diagnostics","notifications","windowing","menu-bar"];

  useEffect(() => {
    api?.settings?.get().then((next) => {
      setSettings(next);
      applyTheme(next.theme);
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
    }
  }, [settings]);

  useEffect(() => {
    api?.job?.list?.().then((initial) => {
      setJobs(initial.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
    }).catch(() => {});

    if (!api?.job?.onUpdate) {
      return undefined;
    }

    return api.job.onUpdate((job) => {
      setJobs((prev) => {
        const next = [job, ...prev.filter((entry) => entry.id !== job.id)];
        return next.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
      });
    });
  }, [api]);

  useEffect(() => {
    if (!api?.updater?.getStatus) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.updater?.getStatus?.();
        if (active && next) {
          setUpdateStatus(next);
        }
      } catch {
        // Ignore polling failures in development.
      }
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);

  useEffect(() => {
    api?.diagnostics?.getSummary?.().then((next) => {
      setDiagnostics(next);
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    api?.windowing?.getState?.().then((next) => {
      setWindowState(next);
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    api?.menuBar?.getState?.().then((next) => {
      setMenuBarState(next);
    }).catch(() => {});
  }, [api]);
  return (
    <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Scaffold Test Launch Ready 79141 Feature Packs</p>
        {featureNames.map((feature) => (
          <span key={feature} className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200">
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold text-white">Settings</h3>
          <p className="mt-1 text-xs text-slate-400">Persisted desktop preferences powered by Forge settings core.</p>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Theme
              <select
                value={settings?.theme ?? 'system'}
                onChange={(event) => updateSetting(api, settings, setSettings, 'theme', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="system">system</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Worker concurrency
              <input
                type="number"
                min={1}
                max={8}
                value={settings?.concurrency ?? 1}
                onChange={(event) => updateSetting(api, settings, setSettings, 'concurrency', Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Background Jobs</h3>
              <p className="mt-1 text-xs text-slate-400">Queue Python work without blocking the UI.</p>
            </div>
            <button
              onClick={() => queueDemoJob(api)}
              className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
            >
              Queue demo
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {jobs.length === 0 ? (
              <p className="text-xs text-slate-500">No queued jobs yet. Use the button above to submit the bundled reverse action.</p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{job.action}</span>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{job.status}</span>
                  </div>
                  {job.progress && (
                    <p className="mt-1 text-xs text-slate-500">
                      {job.progress.current}/{job.progress.total} {job.progress.message ?? ''}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Updater</h3>
              <p className="mt-1 text-xs text-slate-400">Checks packaged builds against the publish target from electron-builder.</p>
            </div>
            <button
              onClick={() => api?.updater?.check?.()}
              className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
            >
              Check now
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-400">
            <p>Status: <span className="text-white">{updateStatus.status}</span></p>
            {updateStatus.version && <p>Version: <span className="text-white">{updateStatus.version}</span></p>}
            {updateStatus.progress && <p>Download: <span className="text-white">{Math.round(updateStatus.progress.percent)}%</span></p>}
            {updateStatus.error && <p className="text-rose-300">{updateStatus.error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => api?.updater?.download?.()}
                className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
              >
                Download
              </button>
              <button
                onClick={() => api?.updater?.install?.()}
                className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
              >
                Install
              </button>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Diagnostics</h3>
              <p className="mt-1 text-xs text-slate-400">Built-in support snapshot for release checks, bug reports, and customer handoff.</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const next = await api?.diagnostics?.exportBundle?.();
                  if (next) {
                    setDiagnosticsExport(next);
                  }
                } catch {
                  // Ignore export failures in starter apps.
                }
              }}
              className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
            >
              Export bundle
            </button>
          </div>
          {diagnostics ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Version" value={diagnostics.version} />
              <DiagnosticRow label="Runtime" value={diagnostics.isPackaged ? 'packaged' : 'development'} />
              <DiagnosticRow label="Platform" value={`${diagnostics.platform} / ${diagnostics.arch}`} />
              <DiagnosticRow label="App ID" value={diagnostics.appId} />
              <DiagnosticRow label="Electron" value={diagnostics.electronVersion} />
              <DiagnosticRow label="Node / Chrome" value={`${diagnostics.nodeVersion} / ${diagnostics.chromeVersion}`} />
              <DiagnosticRow label="Worker" value={diagnostics.workerPath} />
              <DiagnosticRow label="Python" value={diagnostics.pythonPath} />
              <DiagnosticRow label="Logs" value={diagnostics.logsPath} />
              <DiagnosticRow label="User Data" value={diagnostics.userDataPath} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Diagnostics summary is unavailable until the desktop bridge finishes booting.</p>
          )}
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
            Enabled features: <span className="text-white">{featureNames.join(', ')}</span>
          </div>
          {diagnosticsExport && (
            <p className="mt-2 text-xs text-amber-200">
              Support bundle exported to <span className="text-white">{diagnosticsExport.filePath}</span>
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              <p className="mt-1 text-xs text-slate-400">Trigger native desktop notifications for reminders, completions, and support follow-ups.</p>
            </div>
            <button
              onClick={() => sendNotification(api, notificationDraft, setNotificationState)}
              className="rounded-full border border-fuchsia-500/40 px-3 py-1 text-xs font-medium text-fuchsia-300 hover:border-fuchsia-400 hover:text-fuchsia-100"
            >
              Send sample
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Title
              <input
                type="text"
                value={notificationDraft.title}
                onChange={(event) => setNotificationDraft((prev) => ({ ...prev, title: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Body
              <textarea
                rows={3}
                value={notificationDraft.body}
                onChange={(event) => setNotificationDraft((prev) => ({ ...prev, body: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <p className="text-xs text-slate-500">
              Status:{' '}
              <span className="text-white">
                {notificationState === 'idle' ? 'ready' : notificationState === 'sent' ? 'delivered' : 'not supported on this platform'}
              </span>
            </p>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Windowing</h3>
              <p className="mt-1 text-xs text-slate-400">Restore window bounds between launches and keep duplicate launches focused on the active window.</p>
            </div>
            <button
              onClick={() => runWindowAction(api, 'focus', setWindowState)}
              className="rounded-full border border-indigo-500/40 px-3 py-1 text-xs font-medium text-indigo-300 hover:border-indigo-400 hover:text-indigo-100"
            >
              Focus app
            </button>
          </div>
          {windowState ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Size" value={`${windowState.width} × ${windowState.height}`} />
              <DiagnosticRow label="Position" value={windowState.x === null || windowState.y === null ? 'centered' : `${windowState.x}, ${windowState.y}`} />
              <DiagnosticRow label="Maximized" value={windowState.maximized ? 'yes' : 'no'} />
              <DiagnosticRow label="Focused" value={windowState.focused ? 'yes' : 'no'} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Window state becomes available after the desktop bridge initializes.</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => runWindowAction(api, 'reset', setWindowState)}
              className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
            >
              Reset bounds
            </button>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Menu Bar</h3>
              <p className="mt-1 text-xs text-slate-400">Ship a starter application menu with the standard desktop commands users expect.</p>
            </div>
            <button
              onClick={() => rebuildMenuBar(api, setMenuBarState)}
              className="rounded-full border border-orange-500/40 px-3 py-1 text-xs font-medium text-orange-300 hover:border-orange-400 hover:text-orange-100"
            >
              Rebuild menu
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Menu Enabled" value={menuBarState?.enabled ? 'yes' : 'no'} />
            <DiagnosticRow label="Top Level Items" value={menuBarState?.itemLabels.join(', ') || 'none'} />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <h3 className="text-sm font-semibold text-white">Plugin Registry</h3>
          <p className="mt-1 text-xs text-slate-400">Sample plugin slots are ready for feature-oriented modules.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {forgeFeaturePlugins.map((plugin) => (
              <div key={plugin.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{plugin.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{plugin.version}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{plugin.description ?? 'No description provided.'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function updateSetting(
  api: ForgeDesktopAPI | undefined,
  current: AppSettings | null,
  setState: (next: AppSettings) => void,
  key: keyof AppSettings,
  value: AppSettings[keyof AppSettings],
) {
  const next = { ...(current ?? {}), [key]: value } as AppSettings;
  setState(next);
  api?.settings?.set(key, value).catch(() => {});
}

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement;
  const resolved = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme === 'dark';
  root.classList.toggle('dark', resolved);
}

async function queueDemoJob(api: ForgeDesktopAPI | undefined) {
  try {
    await api?.job?.submit?.('reverse', { text: 'Queued from Feature Studio' });
  } catch {
    // Ignore demo failures in starter apps.
  }
}


async function sendNotification(
  api: ForgeDesktopAPI | undefined,
  draft: { title: string; body: string },
  setState: (next: 'idle' | 'sent' | 'unsupported') => void,
) {
  try {
    const result = await api?.notifications?.show?.(draft.title, draft.body);
    setState(result?.supported ? 'sent' : 'unsupported');
  } catch {
    setState('unsupported');
  }
}


async function runWindowAction(
  api: ForgeDesktopAPI | undefined,
  action: 'focus' | 'reset',
  setState: (next: WindowStateSummary) => void,
) {
  try {
    const next = action === 'focus'
      ? await api?.windowing?.focus?.()
      : await api?.windowing?.reset?.();

    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter windowing failures.
  }
}


async function rebuildMenuBar(
  api: ForgeDesktopAPI | undefined,
  setState: (next: MenuBarState) => void,
) {
  try {
    const next = await api?.menuBar?.rebuild?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter menu-bar failures.
  }
}


function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 break-all text-xs text-white">{value}</p>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-slate-400 md:col-span-2">
      <span className="uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="min-h-[96px] w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
      />
    </label>
  );
}

