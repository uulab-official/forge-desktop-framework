import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@forge/ipc-contract';
import type { WorkerRequest, JobDefinition } from '@forge/ipc-contract';

const electronAPI = {
  worker: {
    execute: (request: WorkerRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  },

  job: {
    submit: (action: string, payload: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_SUBMIT, action, payload),
    cancel: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_LIST),
    onUpdate: (cb: (job: JobDefinition) => void) => {
      const listener = (_event: unknown, job: JobDefinition) => cb(job);
      ipcRenderer.on(IPC_CHANNELS.JOB_UPDATE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_UPDATE, listener);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
