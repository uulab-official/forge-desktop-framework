import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@forge/ipc-contract';
import type { WorkerRequest, JobDefinition, AppSettings } from '@forge/ipc-contract';
import type { LogEntry } from '@forge/logger';

const electronAPI = {
  worker: {
    execute: (request: WorkerRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
    cancel: () =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKER_CANCEL),
  },

  job: {
    submit: (action: string, payload: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_SUBMIT, action, payload),
    cancel: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_LIST),
    getStatus: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_STATUS, jobId),
    onUpdate: (cb: (job: JobDefinition) => void) => {
      const listener = (_event: unknown, job: JobDefinition) => cb(job);
      ipcRenderer.on(IPC_CHANNELS.JOB_UPDATE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_UPDATE, listener);
    },
  },

  project: {
    create: (parentDir: string, name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, parentDir, name),
    open: (projectPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, projectPath),
  },

  settings: {
    get: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },

  log: {
    onEntry: (cb: (entry: LogEntry) => void) => {
      const listener = (_event: unknown, entry: LogEntry) => cb(entry);
      ipcRenderer.on(IPC_CHANNELS.LOG_ENTRY, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_ENTRY, listener);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', Object.freeze(electronAPI));

export type ElectronAPI = typeof electronAPI;
