import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  deepLink: {
    getLast: () => ipcRenderer.invoke(IPC_CHANNELS.DEEP_LINK_GET_LAST),
    open: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.DEEP_LINK_OPEN, url),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
