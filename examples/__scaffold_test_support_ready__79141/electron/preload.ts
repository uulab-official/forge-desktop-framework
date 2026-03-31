import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
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
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
