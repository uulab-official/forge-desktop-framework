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
  const [systemInfoState, setSystemInfoState] = useState<SystemInfoState | null>(null);
  const [networkStatusState, setNetworkStatusState] = useState<NetworkStatusState | null>(null);
  const [supportBundleState, setSupportBundleState] = useState<SupportBundleState | null>(null);
  const [logArchiveState, setLogArchiveState] = useState<LogArchiveState | null>(null);
  const [incidentReportState, setIncidentReportState] = useState<IncidentReportState | null>(null);
  const [incidentReportDraft, setIncidentReportDraft] = useState<IncidentReportDraft>({
    title: 'Stewardship Repro 28934 desktop issue',
    severity: 'medium',
    affectedArea: 'desktop-shell',
    summary: 'Customer-facing issue observed in the packaged desktop flow.',
    stepsToReproduce: '1. Launch the app\n2. Navigate to the affected workflow\n3. Capture the incorrect behavior',
    expectedBehavior: 'The workflow should complete without a shell or runtime issue.',
    actualBehavior: 'The desktop shell or runtime produced an unexpected result.',
    recommendedAction: 'Attach support bundle and logs, then triage with product and QA owners.',
    notes: '',
  });
  const [diagnosticsTimelineState, setDiagnosticsTimelineState] = useState<DiagnosticsTimelineState | null>(null);
  const [notificationDraft, setNotificationDraft] = useState({ title: 'Forge Ready', body: 'Stewardship Repro 28934 is ready for customer testing.' });
  const [notificationState, setNotificationState] = useState<'idle' | 'sent' | 'unsupported'>('idle');
  const [windowState, setWindowState] = useState<WindowStateSummary | null>(null);
  const [menuBarState, setMenuBarState] = useState<MenuBarState | null>(null);
  const [fileAssociationState, setFileAssociationState] = useState<FileAssociationState | null>(null);
  const [fileAssociationDraft, setFileAssociationDraft] = useState('sample.stewardshiprepro28934doc');
  const [fileDialogState, setFileDialogState] = useState<FileDialogState | null>(null);
  const [fileDialogDraft, setFileDialogDraft] = useState('stewardshiprepro28934-document.txt');
  const [recentFilesState, setRecentFilesState] = useState<RecentFilesState | null>(null);
  const [recentFileDraft, setRecentFileDraft] = useState('stewardshiprepro28934-document.txt');
  const [crashRecoveryState, setCrashRecoveryState] = useState<CrashRecoveryState | null>(null);
  const [powerMonitorState, setPowerMonitorState] = useState<PowerMonitorState | null>(null);
  const [idlePresenceState, setIdlePresenceState] = useState<IdlePresenceState | null>(null);
  const [sessionStateSnapshot, setSessionStateSnapshot] = useState<SessionStateSnapshot | null>(null);
  const featureNames = ["settings","updater","jobs","plugins","diagnostics","notifications","windowing","menu-bar","support-bundle","log-archive","incident-report","diagnostics-timeline","crash-recovery","system-info","network-status","power-monitor","idle-presence","session-state","file-association","file-dialogs","recent-files"];

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
    refreshSupportBundle(api, setSupportBundleState);
  }, [api]);

  useEffect(() => {
    refreshLogArchive(api, setLogArchiveState);
  }, [api]);

  useEffect(() => {
    refreshIncidentReport(api, setIncidentReportState, setIncidentReportDraft);
  }, [api]);

  useEffect(() => {
    refreshDiagnosticsTimeline(api, setDiagnosticsTimelineState);
  }, [api]);

  useEffect(() => {
    if (!api?.systemInfo?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.systemInfo?.getState?.();
        if (active && next) {
          setSystemInfoState(next);
        }
      } catch {
        // Ignore starter system-info polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);

  useEffect(() => {
    if (!api?.networkStatus?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.networkStatus?.getState?.();
        if (active && next) {
          setNetworkStatusState(next);
        }
      } catch {
        // Ignore starter network-status polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
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

  useEffect(() => {
    api?.fileAssociation?.getState?.().then((next) => {
      setFileAssociationState(next);
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    api?.fileDialogs?.getState?.().then((next) => {
      setFileDialogState(next);
      if (next?.suggestedName) {
        setFileDialogDraft(next.suggestedName);
      }
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (!api?.recentFiles?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.recentFiles?.getState?.();
        if (active && next) {
          setRecentFilesState(next);
          if (next.items[0]) {
            setRecentFileDraft(next.items[0]);
          }
        }
      } catch {
        // Ignore starter recent-files polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);

  useEffect(() => {
    if (!api?.crashRecovery?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.crashRecovery?.getState?.();
        if (active && next) {
          setCrashRecoveryState(next);
        }
      } catch {
        // Ignore starter crash-recovery polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);

  useEffect(() => {
    if (!api?.powerMonitor?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api.powerMonitor?.getState?.();
        if (active && next) {
          setPowerMonitorState(next);
        }
      } catch {
        // Ignore starter power-monitor polling failures.
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
    if (!api?.idlePresence?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api?.idlePresence?.getState?.();
        if (active && next) {
          setIdlePresenceState(next);
        }
      } catch {
        // Ignore starter idle-presence polling failures.
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
    if (!api?.sessionState?.getState) {
      return undefined;
    }

    let active = true;
    const sync = async () => {
      try {
        const next = await api?.sessionState?.getState?.();
        if (active && next) {
          setSessionStateSnapshot(next);
        }
      } catch {
        // Ignore starter session-state polling failures.
      }
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api]);
  return (
    <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Stewardship Repro 28934 Feature Packs</p>
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
              <h3 className="text-sm font-semibold text-white">Support Bundle</h3>
              <p className="mt-1 text-xs text-slate-400">Export structured runtime evidence into a single JSON handoff and reveal the last bundle in Finder without wiring a custom support tool first.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportSupportBundleFromStudio(api, setSupportBundleState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealSupportBundleFromStudio(api, setSupportBundleState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
            </div>
          </div>
          {supportBundleState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Bundle Folder" value={supportBundleState.directoryPath} />
                <DiagnosticRow label="Exports" value={String(supportBundleState.exportCount)} />
                <DiagnosticRow label="Last Export" value={supportBundleState.lastExportPath ?? 'Not exported yet'} />
                <DiagnosticRow label="Generated" value={supportBundleState.lastGeneratedAt ?? 'Not exported yet'} />
                <DiagnosticRow label="Bundle Size" value={supportBundleState.lastSizeBytes ? `${supportBundleState.lastSizeBytes} bytes` : 'Unknown'} />
                <DiagnosticRow label="Last Error" value={supportBundleState.lastError ?? 'none'} />
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Included sections: <span className="text-white">{supportBundleState.includedSections.length > 0 ? supportBundleState.includedSections.join(', ') : 'runtime'}</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Support bundle state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Log Archive</h3>
              <p className="mt-1 text-xs text-slate-400">Snapshot the runtime logs directory into a timestamped handoff folder so QA and support can attach real desktop evidence without opening the app bundle by hand.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshLogArchive(api, setLogArchiveState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => exportLogArchiveFromStudio(api, setLogArchiveState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealLogArchiveFromStudio(api, setLogArchiveState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
            </div>
          </div>
          {logArchiveState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Logs Folder" value={logArchiveState.logsPath} />
                <DiagnosticRow label="Archive Folder" value={logArchiveState.archiveDirectoryPath} />
                <DiagnosticRow label="Log Files" value={String(logArchiveState.fileCount)} />
                <DiagnosticRow label="Bytes" value={String(logArchiveState.totalBytes)} />
                <DiagnosticRow label="Last Archive" value={logArchiveState.lastArchivePath ?? 'Not archived yet'} />
                <DiagnosticRow label="Archived At" value={logArchiveState.lastArchivedAt ?? 'Not archived yet'} />
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Archive exports: <span className="text-white">{logArchiveState.archiveCount}</span>
                {' · '}
                Last error: <span className="text-white">{logArchiveState.lastError ?? 'none'}</span>
              </div>
              <div className="mt-3 space-y-2">
                {logArchiveState.files.length === 0 ? (
                  <p className="text-xs text-slate-500">No log files were found yet. Generate activity in the app and refresh to inspect the runtime logs folder.</p>
                ) : (
                  logArchiveState.files.map((entry) => (
                    <div key={entry.sourcePath} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white">{entry.name}</span>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{entry.sizeBytes} bytes</span>
                      </div>
                      <p className="mt-1 break-all text-xs text-slate-500">{entry.sourcePath}</p>
                      <p className="mt-1 text-xs text-slate-500">Modified {entry.modifiedAt}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Log archive state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Incident Report</h3>
              <p className="mt-1 text-xs text-slate-400">Draft a support-ready desktop escalation with severity, summary, repro steps, and recommended action, then export the handoff JSON into the support folder.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshIncidentReport(api, setIncidentReportState, setIncidentReportDraft)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => exportIncidentReportFromStudio(api, incidentReportDraft, setIncidentReportState, setIncidentReportDraft)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealIncidentReportFromStudio(api, setIncidentReportState, setIncidentReportDraft)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-400">
              <span className="uppercase tracking-[0.18em] text-slate-500">Title</span>
              <input
                value={incidentReportDraft.title}
                onChange={(event) => setIncidentReportDraft((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span className="uppercase tracking-[0.18em] text-slate-500">Severity</span>
              <select
                value={incidentReportDraft.severity}
                onChange={(event) => setIncidentReportDraft((current) => ({ ...current, severity: event.target.value as IncidentReportSeverity }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400 md:col-span-2">
              <span className="uppercase tracking-[0.18em] text-slate-500">Affected Area</span>
              <input
                value={incidentReportDraft.affectedArea}
                onChange={(event) => setIncidentReportDraft((current) => ({ ...current, affectedArea: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
              />
            </label>
            <TextAreaField label="Summary" value={incidentReportDraft.summary} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, summary: value }))} />
            <TextAreaField label="Steps To Reproduce" value={incidentReportDraft.stepsToReproduce} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, stepsToReproduce: value }))} />
            <TextAreaField label="Expected Behavior" value={incidentReportDraft.expectedBehavior} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, expectedBehavior: value }))} />
            <TextAreaField label="Actual Behavior" value={incidentReportDraft.actualBehavior} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, actualBehavior: value }))} />
            <TextAreaField label="Recommended Action" value={incidentReportDraft.recommendedAction} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, recommendedAction: value }))} />
            <TextAreaField label="Notes" value={incidentReportDraft.notes} onChange={(value) => setIncidentReportDraft((current) => ({ ...current, notes: value }))} />
          </div>
          {incidentReportState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Report Folder" value={incidentReportState.directoryPath} />
                <DiagnosticRow label="Exports" value={String(incidentReportState.exportCount)} />
                <DiagnosticRow label="Last Export" value={incidentReportState.lastExportPath ?? 'Not exported yet'} />
                <DiagnosticRow label="Generated" value={incidentReportState.lastGeneratedAt ?? 'Not exported yet'} />
                <DiagnosticRow label="Last Error" value={incidentReportState.lastError ?? 'none'} />
                <DiagnosticRow label="Severity" value={incidentReportState.currentDraft.severity} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Incident report state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Diagnostics Timeline</h3>
              <p className="mt-1 text-xs text-slate-400">Capture a support-ready desktop event history with export, reveal, and clear controls so investigations can start from a structured shell timeline.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshDiagnosticsTimeline(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => exportDiagnosticsTimelineFromStudio(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Export
              </button>
              <button
                onClick={() => revealDiagnosticsTimelineFromStudio(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Reveal
              </button>
              <button
                onClick={() => clearDiagnosticsTimelineFromStudio(api, setDiagnosticsTimelineState)}
                className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-400 hover:text-rose-100"
              >
                Clear
              </button>
            </div>
          </div>
          {diagnosticsTimelineState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Timeline Folder" value={diagnosticsTimelineState.directoryPath} />
                <DiagnosticRow label="Events" value={String(diagnosticsTimelineState.eventCount)} />
                <DiagnosticRow label="Last Event" value={diagnosticsTimelineState.lastEventAt ?? 'not recorded yet'} />
                <DiagnosticRow label="Last Export" value={diagnosticsTimelineState.lastExportPath ?? 'not exported yet'} />
                <DiagnosticRow label="Exported At" value={diagnosticsTimelineState.lastExportedAt ?? 'not exported yet'} />
                <DiagnosticRow label="Last Error" value={diagnosticsTimelineState.lastError ?? 'none'} />
              </div>
              <div className="mt-3 space-y-2">
                {diagnosticsTimelineState.entries.length ? diagnosticsTimelineState.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.category}</span>
                      <span className="text-xs text-slate-500">{entry.timestamp}</span>
                    </div>
                    <p className="mt-2 text-sm text-white">{entry.event}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{entry.detail ?? 'no detail'}</p>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500">No timeline events yet. Launch, focus, export support data, or reopen the window to seed the starter diagnostics timeline.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Diagnostics timeline state is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">System Info</h3>
              <p className="mt-1 text-xs text-slate-400">Inspect live runtime, OS, memory, and path details so teams can debug real desktop environments without wiring a custom shell panel first.</p>
            </div>
            <button
              onClick={() => refreshSystemInfo(api, setSystemInfoState)}
              className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
            >
              Refresh
            </button>
          </div>
          {systemInfoState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="App" value={`${systemInfoState.runtime.appName} ${systemInfoState.runtime.appVersion}`} />
                <DiagnosticRow label="Runtime" value={systemInfoState.runtime.isPackaged ? 'packaged' : 'development'} />
                <DiagnosticRow label="Platform" value={`${systemInfoState.os.platform} / ${systemInfoState.os.arch}`} />
                <DiagnosticRow label="Host" value={systemInfoState.os.hostname} />
                <DiagnosticRow label="OS Release" value={systemInfoState.os.release} />
                <DiagnosticRow label="Uptime" value={`${systemInfoState.os.uptimeMinutes} minutes`} />
                <DiagnosticRow label="CPU" value={`${systemInfoState.os.cpuModel} (${systemInfoState.os.cpuCores} cores)`} />
                <DiagnosticRow label="Load Average" value={systemInfoState.os.loadAverage.join(' / ')} />
                <DiagnosticRow label="Memory Free / Total" value={`${systemInfoState.os.freeMemoryMb} MB / ${systemInfoState.os.totalMemoryMb} MB`} />
                <DiagnosticRow label="RSS / Heap Used" value={`${systemInfoState.process.rssMb} MB / ${systemInfoState.process.heapUsedMb} MB`} />
                <DiagnosticRow label="Heap Total / Processes" value={`${systemInfoState.process.heapTotalMb} MB / ${systemInfoState.process.processCount}`} />
                <DiagnosticRow label="PID / Refreshed" value={`${systemInfoState.process.pid} / ${systemInfoState.refreshedAt}`} />
                <DiagnosticRow label="App Path" value={systemInfoState.paths.appPath} />
                <DiagnosticRow label="User Data" value={systemInfoState.paths.userDataPath} />
                <DiagnosticRow label="Downloads" value={systemInfoState.paths.downloadsPath} />
                <DiagnosticRow label="Logs" value={systemInfoState.paths.logsPath} />
                <DiagnosticRow label="Temp" value={systemInfoState.paths.tempPath} />
                <DiagnosticRow label="Electron / Node" value={`${systemInfoState.runtime.electronVersion} / ${systemInfoState.runtime.nodeVersion}`} />
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Chrome version: <span className="text-white">{systemInfoState.runtime.chromeVersion}</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">System info is unavailable until the desktop bridge finishes booting.</p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Network Status</h3>
              <p className="mt-1 text-xs text-slate-400">Inspect online or offline state from the desktop shell so teams can harden retry, sync, and degraded-mode UX before wiring their own diagnostics surface.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshNetworkStatus(api, setNetworkStatusState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => clearNetworkStatus(api, setNetworkStatusState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          {networkStatusState ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DiagnosticRow label="Supported" value={networkStatusState.supported ? 'yes' : 'fallback only'} />
                <DiagnosticRow label="Status" value={networkStatusState.status} />
                <DiagnosticRow label="Online" value={networkStatusState.online ? 'yes' : 'no'} />
                <DiagnosticRow label="Check Count" value={String(networkStatusState.checkCount)} />
                <DiagnosticRow label="Last Checked" value={networkStatusState.lastCheckedAt ?? 'not checked yet'} />
                <DiagnosticRow label="Surface" value="electron net.isOnline starter probe" />
              </div>
              <div className="mt-3 space-y-2">
                {networkStatusState.history.length ? networkStatusState.history.map((entry) => (
                  <div key={entry.timestamp} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.status}</span>
                    <span className="text-xs text-slate-500">{entry.timestamp}</span>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500">No network checks recorded yet. Refresh to seed a starter online or offline history.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Network status is unavailable until the desktop bridge finishes booting.</p>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">File Association</h3>
              <p className="mt-1 text-xs text-slate-400">Capture starter document opens from the operating system and inspect the last received file path in the desktop shell.</p>
            </div>
            <button
              onClick={() => openAssociatedFile(api, fileAssociationDraft, setFileAssociationState)}
              className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
            >
              Open sample file
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Sample file path
              <input
                type="text"
                value={fileAssociationDraft}
                onChange={(event) => setFileAssociationDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Extension" value={fileAssociationState?.extension ?? 'stewardshiprepro28934doc'} />
              <DiagnosticRow label="Source" value={fileAssociationState?.source ?? 'not opened yet'} />
              <DiagnosticRow label="Last Path" value={fileAssociationState?.lastPath ?? 'none captured yet'} />
              <DiagnosticRow label="Packaging" value="electron-builder fileAssociations preset" />
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">File Dialogs</h3>
              <p className="mt-1 text-xs text-slate-400">Open files, choose save destinations, and reveal generated paths with the native desktop dialogs users already understand.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => runFileDialogAction(api, 'open', fileDialogDraft, setFileDialogState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Open file
              </button>
              <button
                onClick={() => runFileDialogAction(api, 'save', fileDialogDraft, setFileDialogState)}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-emerald-100"
              >
                Save as
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Default path or file name
              <input
                type="text"
                value={fileDialogDraft}
                onChange={(event) => setFileDialogDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => runFileDialogAction(api, 'reveal', fileDialogState?.lastSavePath ?? fileDialogState?.lastOpenPath ?? fileDialogDraft, setFileDialogState)}
                className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-400 hover:text-amber-100"
              >
                Reveal latest path
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Suggested Name" value={fileDialogState?.suggestedName ?? 'stewardshiprepro28934-document.txt'} />
              <DiagnosticRow label="Last Action" value={fileDialogState?.lastAction ?? 'idle'} />
              <DiagnosticRow label="Opened File" value={fileDialogState?.lastOpenPath ?? 'none selected yet'} />
              <DiagnosticRow label="Saved File" value={fileDialogState?.lastSavePath ?? 'none saved yet'} />
              <DiagnosticRow label="Revealed Path" value={fileDialogState?.lastRevealPath ?? 'nothing revealed yet'} />
              <DiagnosticRow label="Shell Surface" value="dialog + shell.showItemInFolder" />
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Files</h3>
              <p className="mt-1 text-xs text-slate-400">Persist the last documents a user touched and make reopen flows part of the starter desktop shell by default.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => mutateRecentFiles(api, 'add', recentFileDraft, setRecentFilesState)}
                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
              >
                Add file
              </button>
              <button
                onClick={() => clearRecentFilesState(api, setRecentFilesState)}
                className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-400 hover:text-rose-100"
              >
                Clear list
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-400">
              Recent file path
              <input
                type="text"
                value={recentFileDraft}
                onChange={(event) => setRecentFileDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagnosticRow label="Tracked Items" value={String(recentFilesState?.items.length ?? 0)} />
              <DiagnosticRow label="Limit" value={String(recentFilesState?.limit ?? 8)} />
              <DiagnosticRow label="Last Opened" value={recentFilesState?.lastOpenedPath ?? 'no documents tracked yet'} />
              <DiagnosticRow label="Auto Sources" value="file-association + file-dialogs when enabled together" />
            </div>
            <div className="space-y-2">
              {recentFilesState?.items.length ? recentFilesState.items.map((item) => (
                <div key={item} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <span className="break-all text-xs text-white">{item}</span>
                  <button
                    onClick={() => mutateRecentFiles(api, 'open', item, setRecentFilesState)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
                  >
                    Reopen
                  </button>
                </div>
              )) : (
                <p className="text-xs text-slate-500">No recent files yet. Add one manually or combine this pack with file dialogs and file associations to populate the list automatically.</p>
              )}
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Crash Recovery</h3>
              <p className="mt-1 text-xs text-slate-400">Capture starter renderer and child-process incidents so teams can inspect failures and relaunch cleanly without wiring recovery paths from scratch.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => clearCrashRecovery(api, setCrashRecoveryState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear incident
              </button>
              <button
                onClick={() => relaunchCrashRecovery(api, setCrashRecoveryState)}
                className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-400 hover:text-rose-100"
              >
                Relaunch app
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Incident Recorded" value={crashRecoveryState?.hasIncident ? 'yes' : 'no'} />
            <DiagnosticRow label="Scope" value={crashRecoveryState?.lastIncident?.scope ?? 'none'} />
            <DiagnosticRow label="Reason" value={crashRecoveryState?.lastIncident?.reason ?? 'no incidents captured'} />
            <DiagnosticRow label="Timestamp" value={crashRecoveryState?.lastIncident?.timestamp ?? 'not available'} />
          </div>
          {crashRecoveryState?.lastIncident?.details && (
            <p className="mt-2 break-all text-xs text-amber-200">{crashRecoveryState.lastIncident.details}</p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Power Monitor</h3>
              <p className="mt-1 text-xs text-slate-400">Track suspend, resume, lock, unlock, and power-source events so desktop products can harden long-running work around real device lifecycle changes.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshPowerMonitor(api, setPowerMonitorState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Refresh
              </button>
              <button
                onClick={() => clearPowerMonitor(api, setPowerMonitorState)}
                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-400 hover:text-sky-100"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Power Source" value={powerMonitorState?.powerSource ?? 'unknown'} />
            <DiagnosticRow label="Idle State" value={powerMonitorState?.idleState ?? 'unknown'} />
            <DiagnosticRow label="Idle Time" value={powerMonitorState ? `${powerMonitorState.idleTimeSeconds}s` : '0s'} />
            <DiagnosticRow label="Last Event" value={powerMonitorState?.lastEvent ?? 'no lifecycle events yet'} />
            <DiagnosticRow label="Last Event At" value={powerMonitorState?.lastEventAt ?? 'not available'} />
            <DiagnosticRow label="Tracked Events" value={String(powerMonitorState?.eventCount ?? 0)} />
          </div>
          <div className="mt-3 space-y-2">
            {powerMonitorState?.history.length ? powerMonitorState.history.map((entry) => (
              <div key={`${entry.name}-${entry.timestamp}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">{entry.name}</span>
                <span className="text-xs text-slate-500">{entry.timestamp}</span>
              </div>
            )) : (
              <p className="text-xs text-slate-500">No power lifecycle events captured yet. Suspend or lock the device to exercise the starter hooks.</p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Idle Presence</h3>
              <p className="mt-1 text-xs text-slate-400">Track whether the user is active, idle, locked, or away from the app window so teams can design presence-aware desktop flows without rebuilding shell diagnostics.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshIdlePresence(api, setIdlePresenceState)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => clearIdlePresence(api, setIdlePresenceState)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Idle State" value={idlePresenceState?.idleState ?? 'unknown'} />
            <DiagnosticRow label="Idle Time" value={idlePresenceState ? `${idlePresenceState.idleTimeSeconds}s` : '0s'} />
            <DiagnosticRow label="Attention" value={idlePresenceState?.attention ?? 'no-window'} />
            <DiagnosticRow label="Threshold" value={idlePresenceState ? `${idlePresenceState.thresholdSeconds}s` : '45s'} />
            <DiagnosticRow label="Last Sampled" value={idlePresenceState?.lastSampledAt ?? 'not sampled yet'} />
            <DiagnosticRow label="Last Changed" value={idlePresenceState?.lastChangedAt ?? 'not available'} />
            <DiagnosticRow label="Sample Count" value={String(idlePresenceState?.sampleCount ?? 0)} />
            <DiagnosticRow label="Surface" value="electron powerMonitor getSystemIdleState + window focus visibility" />
          </div>
          <div className="mt-3 space-y-2">
            {idlePresenceState?.history.length ? idlePresenceState.history.map((entry) => (
              <div key={`${entry.timestamp}-${entry.attention}`} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.idleState} / {entry.attention}</span>
                  <span className="text-xs text-slate-500">{entry.timestamp}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Idle time: <span className="text-white">{entry.idleTimeSeconds}s</span></p>
              </div>
            )) : (
              <p className="text-xs text-slate-500">No idle-presence samples yet. Refresh or wait for the starter polling loop to record user activity state.</p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Session State</h3>
              <p className="mt-1 text-xs text-slate-400">Track whether the desktop app is active, backgrounded, hidden, or quitting while capturing window focus and visibility events in a starter lifecycle log.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshSessionState(api, setSessionStateSnapshot)}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400 hover:text-cyan-100"
              >
                Refresh
              </button>
              <button
                onClick={() => clearSessionState(api, setSessionStateSnapshot)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DiagnosticRow label="Lifecycle" value={sessionStateSnapshot?.lifecycle ?? 'ready'} />
            <DiagnosticRow label="Attention" value={sessionStateSnapshot?.attention ?? 'no-window'} />
            <DiagnosticRow label="Windows" value={String(sessionStateSnapshot?.windowCount ?? 0)} />
            <DiagnosticRow label="Visible Windows" value={String(sessionStateSnapshot?.visibleWindowCount ?? 0)} />
            <DiagnosticRow label="Focused Windows" value={String(sessionStateSnapshot?.focusedWindowCount ?? 0)} />
            <DiagnosticRow label="Last Event" value={sessionStateSnapshot?.lastEvent ?? 'none yet'} />
            <DiagnosticRow label="Last Event At" value={sessionStateSnapshot?.lastEventAt ?? 'not available'} />
            <DiagnosticRow label="Event Count" value={String(sessionStateSnapshot?.eventCount ?? 0)} />
          </div>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
            Session started at <span className="text-white">{sessionStateSnapshot?.startedAt ?? 'not available'}</span>
          </div>
          <div className="mt-3 space-y-2">
            {sessionStateSnapshot?.history.length ? sessionStateSnapshot.history.map((entry) => (
              <div key={`${entry.name}-${entry.timestamp}`} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{entry.name}</span>
                  <span className="text-xs text-slate-500">{entry.timestamp}</span>
                </div>
                {entry.detail && (
                  <p className="mt-2 break-all text-xs text-slate-400">{entry.detail}</p>
                )}
              </div>
            )) : (
              <p className="text-xs text-slate-500">No session-state events yet. Focus, hide, or reactivate the app window to exercise the starter lifecycle log.</p>
            )}
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


async function openAssociatedFile(
  api: ForgeDesktopAPI | undefined,
  filePath: string,
  setState: (next: FileAssociationState) => void,
) {
  try {
    const next = await api?.fileAssociation?.open?.(filePath);
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter file-association failures.
  }
}


async function runFileDialogAction(
  api: ForgeDesktopAPI | undefined,
  action: 'open' | 'save' | 'reveal',
  value: string,
  setState: (next: FileDialogState) => void,
) {
  try {
    const next = action === 'open'
      ? await api?.fileDialogs?.open?.(value)
      : action === 'save'
        ? await api?.fileDialogs?.save?.(value)
        : await api?.fileDialogs?.reveal?.(value);

    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter file-dialog failures.
  }
}


async function mutateRecentFiles(
  api: ForgeDesktopAPI | undefined,
  action: 'add' | 'open',
  filePath: string,
  setState: (next: RecentFilesState) => void,
) {
  try {
    const next = action === 'open'
      ? await api?.recentFiles?.open?.(filePath)
      : await api?.recentFiles?.add?.(filePath);

    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter recent-files failures.
  }
}

async function clearRecentFilesState(
  api: ForgeDesktopAPI | undefined,
  setState: (next: RecentFilesState) => void,
) {
  try {
    const next = await api?.recentFiles?.clear?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter recent-files failures.
  }
}


async function clearCrashRecovery(
  api: ForgeDesktopAPI | undefined,
  setState: (next: CrashRecoveryState) => void,
) {
  try {
    const next = await api?.crashRecovery?.clear?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter crash-recovery failures.
  }
}

async function relaunchCrashRecovery(
  api: ForgeDesktopAPI | undefined,
  setState: (next: CrashRecoveryState) => void,
) {
  try {
    const next = await api?.crashRecovery?.relaunch?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter crash-recovery failures.
  }
}


async function refreshPowerMonitor(
  api: ForgeDesktopAPI | undefined,
  setState: (next: PowerMonitorState) => void,
) {
  try {
    const next = await api?.powerMonitor?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter power-monitor refresh failures.
  }
}

async function clearPowerMonitor(
  api: ForgeDesktopAPI | undefined,
  setState: (next: PowerMonitorState) => void,
) {
  try {
    const next = await api?.powerMonitor?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter power-monitor failures.
  }
}


async function refreshIdlePresence(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IdlePresenceState) => void,
) {
  try {
    const next = await api?.idlePresence?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter idle-presence refresh failures.
  }
}

async function clearIdlePresence(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IdlePresenceState) => void,
) {
  try {
    const next = await api?.idlePresence?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter idle-presence clear failures.
  }
}


async function refreshSessionState(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SessionStateSnapshot) => void,
) {
  try {
    const next = await api?.sessionState?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter session-state refresh failures.
  }
}

async function clearSessionState(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SessionStateSnapshot) => void,
) {
  try {
    const next = await api?.sessionState?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter session-state clear failures.
  }
}


async function refreshSystemInfo(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SystemInfoState) => void,
) {
  try {
    const next = await api?.systemInfo?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter system-info refresh failures.
  }
}


async function refreshNetworkStatus(
  api: ForgeDesktopAPI | undefined,
  setState: (next: NetworkStatusState) => void,
) {
  try {
    const next = await api?.networkStatus?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter network-status refresh failures.
  }
}

async function clearNetworkStatus(
  api: ForgeDesktopAPI | undefined,
  setState: (next: NetworkStatusState) => void,
) {
  try {
    const next = await api?.networkStatus?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter network-status clear failures.
  }
}


async function refreshSupportBundle(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SupportBundleState) => void,
) {
  try {
    const next = await api?.supportBundle?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter support-bundle refresh failures.
  }
}

async function exportSupportBundleFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SupportBundleState) => void,
) {
  try {
    const next = await api?.supportBundle?.export?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter support-bundle export failures.
  }
}

async function revealSupportBundleFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: SupportBundleState) => void,
) {
  try {
    const next = await api?.supportBundle?.reveal?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter support-bundle reveal failures.
  }
}


async function refreshLogArchive(
  api: ForgeDesktopAPI | undefined,
  setState: (next: LogArchiveState) => void,
) {
  try {
    const next = await api?.logArchive?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter log-archive refresh failures.
  }
}

async function exportLogArchiveFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: LogArchiveState) => void,
) {
  try {
    const next = await api?.logArchive?.export?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter log-archive export failures.
  }
}

async function revealLogArchiveFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: LogArchiveState) => void,
) {
  try {
    const next = await api?.logArchive?.reveal?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter log-archive reveal failures.
  }
}


async function refreshIncidentReport(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IncidentReportState) => void,
  setDraft: (next: IncidentReportDraft) => void,
) {
  try {
    const next = await api?.incidentReport?.getState?.();
    if (next) {
      setState(next);
      setDraft(next.currentDraft);
    }
  } catch {
    // Ignore starter incident-report refresh failures.
  }
}

async function exportIncidentReportFromStudio(
  api: ForgeDesktopAPI | undefined,
  draft: IncidentReportDraft,
  setState: (next: IncidentReportState) => void,
  setDraft: (next: IncidentReportDraft) => void,
) {
  try {
    const next = await api?.incidentReport?.export?.(draft);
    if (next) {
      setState(next);
      setDraft(next.currentDraft);
    }
  } catch {
    // Ignore starter incident-report export failures.
  }
}

async function revealIncidentReportFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: IncidentReportState) => void,
  setDraft: (next: IncidentReportDraft) => void,
) {
  try {
    const next = await api?.incidentReport?.reveal?.();
    if (next) {
      setState(next);
      setDraft(next.currentDraft);
    }
  } catch {
    // Ignore starter incident-report reveal failures.
  }
}


async function refreshDiagnosticsTimeline(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.getState?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline refresh failures.
  }
}

async function exportDiagnosticsTimelineFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.export?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline export failures.
  }
}

async function revealDiagnosticsTimelineFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.reveal?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline reveal failures.
  }
}

async function clearDiagnosticsTimelineFromStudio(
  api: ForgeDesktopAPI | undefined,
  setState: (next: DiagnosticsTimelineState) => void,
) {
  try {
    const next = await api?.diagnosticsTimeline?.clearHistory?.();
    if (next) {
      setState(next);
    }
  } catch {
    // Ignore starter diagnostics-timeline clear failures.
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

