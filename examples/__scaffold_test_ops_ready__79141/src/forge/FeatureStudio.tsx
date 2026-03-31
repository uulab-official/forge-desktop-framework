import { useEffect, useState } from 'react';

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
    get: () => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  job?: {
    submit: (action: string, payload: Record<string, unknown>) => Promise<string> | string;
    list: () => Promise<unknown[]>;
    onUpdate: (cb: (job: unknown) => void) => () => void;
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
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [diagnosticsExport, setDiagnosticsExport] = useState<{ filePath: string; generatedAt: string } | null>(null);
  const [systemInfoState, setSystemInfoState] = useState<SystemInfoState | null>(null);
  const [networkStatusState, setNetworkStatusState] = useState<NetworkStatusState | null>(null);
  const [supportBundleState, setSupportBundleState] = useState<SupportBundleState | null>(null);
  const [crashRecoveryState, setCrashRecoveryState] = useState<CrashRecoveryState | null>(null);
  const [powerMonitorState, setPowerMonitorState] = useState<PowerMonitorState | null>(null);
  const [idlePresenceState, setIdlePresenceState] = useState<IdlePresenceState | null>(null);
  const [sessionStateSnapshot, setSessionStateSnapshot] = useState<SessionStateSnapshot | null>(null);
  const featureNames = ["diagnostics","support-bundle","crash-recovery","system-info","network-status","power-monitor","idle-presence","session-state"];


  useEffect(() => {
    api?.diagnostics?.getSummary?.().then((next) => {
      setDiagnostics(next);
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    refreshSupportBundle(api, setSupportBundleState);
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
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Scaffold Test Ops Ready 79141 Feature Packs</p>
        {featureNames.map((feature) => (
          <span key={feature} className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200">
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
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
      </div>
    </div>
  );
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

