import { contextBridge, ipcRenderer } from 'electron';
import type { WorkerRequest } from '@forge/ipc-contract';

contextBridge.exposeInMainWorld('api', {
  execute: (request: WorkerRequest) => ipcRenderer.invoke('worker:execute', request),
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
});
