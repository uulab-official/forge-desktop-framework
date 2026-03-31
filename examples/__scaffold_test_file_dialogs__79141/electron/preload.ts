import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  fileDialogs: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_GET_STATE),
    open: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_OPEN, defaultPath),
    save: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_SAVE, defaultPath),
    reveal: (targetPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_REVEAL, targetPath),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
