import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  fileAssociation: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_GET_STATE),
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_ASSOCIATION_OPEN, filePath),
  },
  fileDialogs: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_GET_STATE),
    open: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_OPEN, defaultPath),
    save: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_SAVE, defaultPath),
    reveal: (targetPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOGS_REVEAL, targetPath),
  },
  recentFiles: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_GET_STATE),
    add: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_ADD, filePath),
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_OPEN, filePath),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_FILES_CLEAR),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
