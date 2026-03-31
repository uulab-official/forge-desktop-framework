import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
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

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
