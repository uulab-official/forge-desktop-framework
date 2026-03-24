import { contextBridge, ipcRenderer } from 'electron';
import type { WorkerRequest } from '@forge/ipc-contract';

contextBridge.exposeInMainWorld('api', {
  execute: (request: WorkerRequest) => ipcRenderer.invoke('worker:execute', request),
  chat: {
    send: (message: string) => ipcRenderer.invoke('chat:send', message),
    onStream: (cb: (data: { partial: string; done: boolean; timestamp: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => cb(data);
      ipcRenderer.on('chat:stream', handler);
      return () => ipcRenderer.removeListener('chat:stream', handler);
    },
  },
});
