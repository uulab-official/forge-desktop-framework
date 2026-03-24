import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@forge/ipc-contract';
import type { WorkerRequest } from '@forge/ipc-contract';
import type { WorkerClient } from '@forge/worker-client';
import type { JobEngine } from '@forge/job-engine';
import type { SettingsManager } from '@forge/settings-core';
import type { ResourceManager } from '@forge/resource-manager';
import { createProject, openProject } from '@forge/project-core';
import { createLogger } from '@forge/logger';

interface HandlerDeps {
  workerClient: WorkerClient;
  jobEngine: JobEngine;
  settingsManager: SettingsManager;
  resourceManager: ResourceManager;
}

export function registerIpcHandlers(deps: HandlerDeps) {
  const { workerClient, jobEngine, settingsManager } = deps;
  const logger = createLogger('ipc');

  // Worker
  ipcMain.handle(IPC_CHANNELS.WORKER_EXECUTE, async (_event, request: WorkerRequest) => {
    logger.info('Worker execute', { action: request.action });
    return workerClient.execute(request);
  });

  ipcMain.handle(IPC_CHANNELS.WORKER_CANCEL, async () => {
    workerClient.cancel();
  });

  // Jobs
  ipcMain.handle(IPC_CHANNELS.JOB_SUBMIT, async (_event, action: string, payload: Record<string, unknown>) => {
    return jobEngine.submit(action, payload);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, async (_event, jobId: string) => {
    jobEngine.cancel(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_STATUS, async (_event, jobId: string) => {
    return jobEngine.getJob(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_LIST, async () => {
    return jobEngine.getAllJobs();
  });

  // Project
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, parentDir: string, name: string) => {
    const handle = await createProject(parentDir, name);
    return { meta: handle.meta, paths: handle.paths };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_event, projectPath?: string) => {
    let targetPath = projectPath;
    if (!targetPath) {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Open Project',
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      targetPath = result.filePaths[0];
    }
    const handle = await openProject(targetPath);
    return { meta: handle.meta, paths: handle.paths };
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsManager.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, key: string, value: unknown) => {
    settingsManager.set(key as any, value as any);
    await settingsManager.save();
  });

  logger.info('IPC handlers registered');
}
