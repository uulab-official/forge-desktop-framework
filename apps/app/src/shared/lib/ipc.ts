import type { WorkerRequest, WorkerResponse, JobDefinition } from '@forge/ipc-contract';

export interface ElectronAPI {
  worker: {
    execute: (request: WorkerRequest) => Promise<WorkerResponse>;
    cancel: () => Promise<void>;
  };
  job: {
    submit: (action: string, payload: Record<string, unknown>) => Promise<string>;
    cancel: (jobId: string) => Promise<void>;
    list: () => Promise<JobDefinition[]>;
    getStatus: (jobId: string) => Promise<JobDefinition | undefined>;
    onUpdate: (cb: (job: JobDefinition) => void) => () => void;
  };
  project: {
    create: (parentDir: string, name: string) => Promise<unknown>;
    open: (projectPath: string) => Promise<unknown>;
  };
  settings: {
    get: () => Promise<Record<string, unknown>>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  log: {
    onEntry: (cb: (entry: unknown) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function getAPI(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error('electronAPI not available — are you running inside Electron?');
  }
  return window.electronAPI;
}
