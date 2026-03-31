import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  idlePresence: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.IDLE_PRESENCE_GET_STATE),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.IDLE_PRESENCE_CLEAR_HISTORY),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
