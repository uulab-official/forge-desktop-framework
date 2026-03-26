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
    expect(IPC_CHANNELS.DIAGNOSTICS_SUMMARY).toBe('diagnostics:summary');
    expect(IPC_CHANNELS.NOTIFY_SHOW).toBe('notify:show');
    expect(IPC_CHANNELS.WINDOW_STATE_GET).toBe('window:get-state');
    expect(IPC_CHANNELS.TRAY_STATUS_GET).toBe('tray:get-status');
    expect(IPC_CHANNELS.DEEP_LINK_GET_LAST).toBe('deep-link:get-last');
    expect(IPC_CHANNELS.MENU_STATE_GET).toBe('menu:get-state');
    expect(IPC_CHANNELS.AUTO_LAUNCH_GET_STATUS).toBe('auto-launch:get-status');
    expect(IPC_CHANNELS.GLOBAL_SHORTCUT_GET_STATUS).toBe('global-shortcut:get-status');
    expect(IPC_CHANNELS.FILE_ASSOCIATION_GET_STATE).toBe('file-association:get-state');
    expect(IPC_CHANNELS.FILE_DIALOGS_GET_STATE).toBe('file-dialogs:get-state');
    expect(IPC_CHANNELS.RECENT_FILES_GET_STATE).toBe('recent-files:get-state');
    expect(IPC_CHANNELS.CRASH_RECOVERY_GET_STATE).toBe('crash-recovery:get-state');
    expect(IPC_CHANNELS.POWER_MONITOR_GET_STATE).toBe('power-monitor:get-state');
    expect(IPC_CHANNELS.IDLE_PRESENCE_GET_STATE).toBe('idle-presence:get-state');
    expect(IPC_CHANNELS.SESSION_STATE_GET).toBe('session-state:get-state');
    expect(IPC_CHANNELS.DOWNLOADS_GET_STATE).toBe('downloads:get-state');
    expect(IPC_CHANNELS.CLIPBOARD_GET_STATE).toBe('clipboard:get-state');
    expect(IPC_CHANNELS.EXTERNAL_LINKS_GET_STATE).toBe('external-links:get-state');
    expect(IPC_CHANNELS.SYSTEM_INFO_GET_STATE).toBe('system-info:get-state');
    expect(IPC_CHANNELS.PERMISSIONS_GET_STATE).toBe('permissions:get-state');
    expect(IPC_CHANNELS.NETWORK_STATUS_GET_STATE).toBe('network-status:get-state');
    expect(IPC_CHANNELS.SECURE_STORAGE_GET_STATE).toBe('secure-storage:get-state');
    expect(IPC_CHANNELS.SUPPORT_BUNDLE_GET_STATE).toBe('support-bundle:get-state');
    expect(IPC_CHANNELS.UPDATE_CHECK).toBe('update:check');
  });
});
