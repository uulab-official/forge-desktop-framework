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
  const [menuBarState, setMenuBarState] = useState<MenuBarState | null>(null);
  const featureNames = ["menu-bar"];


  useEffect(() => {
    api?.menuBar?.getState?.().then((next) => {
      setMenuBarState(next);
    }).catch(() => {});
  }, [api]);
  return (
    <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Scaffold Test Menu Bar 79141 Feature Packs</p>
        {featureNames.map((feature) => (
          <span key={feature} className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200">
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:col-span-2">
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
      </div>
    </div>
  );
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

