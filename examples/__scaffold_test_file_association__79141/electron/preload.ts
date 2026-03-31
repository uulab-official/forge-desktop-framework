import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  fileAssociation: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_GET_STATE),
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_OPEN, filePath),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
