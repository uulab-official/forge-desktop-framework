import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  powerMonitor: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.POWER_MONITOR_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.POWER_MONITOR_CLEAR_HISTORY),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
