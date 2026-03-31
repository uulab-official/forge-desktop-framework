import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WorkerRequest, JobDefinition, AppSettings } from '@forge/ipc-contract';

const api = {
  execute: (request: WorkerRequest) => ipcRenderer.invoke(IPC_CHANNELS.WORKER_EXECUTE, request),
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (key: keyof AppSettings, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },
  job: {
    submit: (action: string, payload: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_SUBMIT, action, payload),
    cancel: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
    list: (): Promise<JobDefinition[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_LIST),
    getStatus: (jobId: string): Promise<JobDefinition | undefined> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOB_STATUS, jobId),
    onUpdate: (cb: (job: JobDefinition) => void) => {
      const listener = (_event: unknown, job: JobDefinition) => cb(job);
      ipcRenderer.on(IPC_CHANNELS.JOB_UPDATE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_UPDATE, listener);
    },
  },
  updater: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_STATUS),
  },
  diagnostics: {
    getSummary: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_SUMMARY),
    exportBundle: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_EXPORT),
  },
  notifications: {
    show: (title: string, body: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFY_SHOW, title, body),
  },
  windowing: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_STATE_GET),
    focus: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FOCUS),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_RESET),
  },
  menuBar: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_STATE_GET),
    rebuild: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_REBUILD),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ForgeDesktopAPI = typeof api;
