import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  globalShortcut: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GLOBAL_SHORTCUT_GET_STATUS),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.GLOBAL_SHORTCUT_SET_ENABLED, enabled),
    trigger: () => ipcRenderer.invoke(IPC_CHANNELS.GLOBAL_SHORTCUT_TRIGGER),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
