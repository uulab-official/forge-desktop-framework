import { describe, it, expect } from 'vitest';
import { isWorkerProgress, isWorkerReady, isWorkerResponse } from '../index.js';

describe('type guards', () => {
  it('identifies WorkerResponse', () => {
    expect(isWorkerResponse({ success: true, data: null, error: null })).toBe(true);
    expect(isWorkerResponse({ progress: { current: 1, total: 10 } })).toBe(false);
    expect(isWorkerResponse({ ready: true })).toBe(false);
  });

  it('identifies WorkerProgress', () => {
    expect(isWorkerProgress({ progress: { current: 5, total: 10 } })).toBe(true);
    expect(isWorkerProgress({ success: true, data: null, error: null })).toBe(false);
  });

  it('identifies WorkerReady', () => {
    expect(isWorkerReady({ ready: true })).toBe(true);
    expect(isWorkerReady({ ready: false } as any)).toBe(false);
    expect(isWorkerReady({ success: true, data: null, error: null })).toBe(false);
  });
});

describe('IPC_CHANNELS', () => {
  it('exports all required channels', async () => {
    const { IPC_CHANNELS } = await import('../index.js');
    expect(IPC_CHANNELS.WORKER_EXECUTE).toBe('worker:execute');
    expect(IPC_CHANNELS.JOB_SUBMIT).toBe('job:submit');
    expect(IPC_CHANNELS.SETTINGS_GET).toBe('settings:get');
    expect(IPC_CHANNELS.UPDATE_CHECK).toBe('update:check');
  });
});
