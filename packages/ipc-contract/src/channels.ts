export const IPC_CHANNELS = {
  // Worker
  WORKER_EXECUTE: 'worker:execute',
  WORKER_CANCEL: 'worker:cancel',
  WORKER_PROGRESS: 'worker:progress',

  // Jobs
  JOB_SUBMIT: 'job:submit',
  JOB_CANCEL: 'job:cancel',
  JOB_STATUS: 'job:status',
  JOB_LIST: 'job:list',
  JOB_UPDATE: 'job:update',

  // Project
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_SAVE: 'project:save',
  PROJECT_LIST: 'project:list',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Logs
  LOG_ENTRY: 'log:entry',
  DIAGNOSTICS_SUMMARY: 'diagnostics:summary',
  DIAGNOSTICS_EXPORT: 'diagnostics:export',
  NOTIFY_SHOW: 'notify:show',
  WINDOW_STATE_GET: 'window:get-state',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_RESET: 'window:reset',
  TRAY_STATUS_GET: 'tray:get-status',
  TRAY_TOGGLE_WINDOW: 'tray:toggle-window',

  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
