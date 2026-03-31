import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  crashRecovery: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_GET_STATE),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_CLEAR),
    relaunch: () => ipcRenderer.invoke(IPC_CHANNELS.CRASH_RECOVERY_RELAUNCH),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
