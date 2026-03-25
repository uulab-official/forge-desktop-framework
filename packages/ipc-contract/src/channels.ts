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
  DEEP_LINK_GET_LAST: 'deep-link:get-last',
  DEEP_LINK_OPEN: 'deep-link:open',
  MENU_STATE_GET: 'menu:get-state',
  MENU_REBUILD: 'menu:rebuild',
  AUTO_LAUNCH_GET_STATUS: 'auto-launch:get-status',
  AUTO_LAUNCH_SET_ENABLED: 'auto-launch:set-enabled',
  GLOBAL_SHORTCUT_GET_STATUS: 'global-shortcut:get-status',
  GLOBAL_SHORTCUT_SET_ENABLED: 'global-shortcut:set-enabled',
  GLOBAL_SHORTCUT_TRIGGER: 'global-shortcut:trigger',
  FILE_ASSOCIATION_GET_STATE: 'file-association:get-state',
  FILE_ASSOCIATION_OPEN: 'file-association:open',
  FILE_DIALOGS_GET_STATE: 'file-dialogs:get-state',
  FILE_DIALOGS_OPEN: 'file-dialogs:open',
  FILE_DIALOGS_SAVE: 'file-dialogs:save',
  FILE_DIALOGS_REVEAL: 'file-dialogs:reveal',
  RECENT_FILES_GET_STATE: 'recent-files:get-state',
  RECENT_FILES_ADD: 'recent-files:add',
  RECENT_FILES_OPEN: 'recent-files:open',
  RECENT_FILES_CLEAR: 'recent-files:clear',

  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
