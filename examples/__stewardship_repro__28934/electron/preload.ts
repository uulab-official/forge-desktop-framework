import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest, JobDefinition, AppSettings } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (key: keyof AppSettings, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },
  job: {
    submit: (action: string, payload: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_SUBMIT, action, payload),
    cancel: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
    list: (): Promise<JobDefinition[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_LIST),
    getStatus: (jobId: string): Promise<JobDefinition | undefined> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_STATUS, jobId),
    onUpdate: (cb: (job: JobDefinition) => void) => {
      const listener = (_event: unknown, job: JobDefinition) => cb(job);
      ipcRenderer.on(IPC_CHANNELS.JOB_UPDATE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_UPDATE, listener);
    },
  },
  updater: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_STATUS),
  },
  diagnostics: {
    getSummary: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_SUMMARY),
    exportBundle: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_EXPORT),
  },
  systemInfo: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_INFO_GET_STATE),
  },
  networkStatus: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORK_STATUS_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORK_STATUS_CLEAR_HISTORY),
  },
  supportBundle: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.SUPPORT_BUNDLE_GET_STATE),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.SUPPORT_BUNDLE_EXPORT),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.SUPPORT_BUNDLE_REVEAL),
  },
  logArchive: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_ARCHIVE_GET_STATE),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_ARCHIVE_EXPORT),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_ARCHIVE_REVEAL),
  },
  incidentReport: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.INCIDENT_REPORT_GET_STATE),
    export: (draft?: unknown) => ipcRenderer.invoke(IPC_CHANNELS.INCIDENT_REPORT_EXPORT, draft),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.INCIDENT_REPORT_REVEAL),
  },
  diagnosticsTimeline: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_GET_STATE),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_EXPORT),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_REVEAL),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_TIMELINE_CLEAR_HISTORY),
  },
  notifications: {
    show: (title: string, body: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFY_SHOW, title, body),
  },
  windowing: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_STATE_GET),
    focus: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FOCUS),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_RESET),
  },
  menuBar: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_STATE_GET),
    rebuild: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_REBUILD),
  },
  fileAssociation: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_GET_STATE),
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_OPEN, filePath),
  },
  fileDialogs: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_GET_STATE),
    open: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_OPEN, defaultPath),
    save: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_SAVE, defaultPath),
    reveal: (targetPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_REVEAL, targetPath),
  },
  recentFiles: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_GET_STATE),
    add: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_ADD, filePath),
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_OPEN, filePath),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_CLEAR),
  },
  crashRecovery: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_GET_STATE),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_CLEAR),
    relaunch: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_RELAUNCH),
  },
  powerMonitor: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.POWER_MONITOR_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.POWER_MONITOR_CLEAR_HISTORY),
  },
  idlePresence: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.IDLE_PRESENCE_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.IDLE_PRESENCE_CLEAR_HISTORY),
  },
  sessionState: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_STATE_GET),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_STATE_CLEAR_HISTORY),
  },
};

contextBridge.exposeInMainWorld('api', Object.freeze(api));

export type ForgeDesktopAPI = typeof api;
