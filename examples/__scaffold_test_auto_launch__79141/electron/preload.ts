import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  autoLaunch: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AUTO_LAUNCH_GET_STATUS),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.AUTO_LAUNCH_SET_ENABLED, enabled),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
