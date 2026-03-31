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
  const [supportBundleState, setSupportBundleState] = useState<SupportBundleState | null>(null);
  const [logArchiveState, setLogArchiveState] = useState<LogArchiveState | null>(null);
  const [incidentReportState, setIncidentReportState] = useState<IncidentReportState | null>(null);
  const [incidentReportDraft, setIncidentReportDraft] = useState<IncidentReportDraft>({
    title: 'Scaffold Test Support Ready 79141 desktop issue',
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
  const featureNames = ["support-bundle","log-archive","incident-report","diagnostics-timeline"];


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
  return (
    <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Scaffold Test Support Ready 79141 Feature Packs</p>
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
      </div>
    </div>
  );
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

