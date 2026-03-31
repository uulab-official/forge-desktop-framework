import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  menuBar: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_STATE_GET),
    rebuild: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_REBUILD),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
