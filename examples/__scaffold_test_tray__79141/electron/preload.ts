import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  tray: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TRAY_STATUS_GET),
    toggleWindow: () => ipcRenderer.invoke(IPC_CHANNELS.TRAY_TOGGLE_WINDOW),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
