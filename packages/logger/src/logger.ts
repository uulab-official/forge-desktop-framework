export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const history: LogEntry[] = [];
const MAX_HISTORY = 1000;
const listeners: Set<(entry: LogEntry) => void> = new Set();

let minLevel: LogLevel = 'debug';

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function onLogEntry(cb: (entry: LogEntry) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getLogHistory(filter?: {
  level?: LogLevel;
  source?: string;
  limit?: number;
}): LogEntry[] {
  let entries = history;
  if (filter?.level) {
    const threshold = LOG_LEVELS[filter.level];
    entries = entries.filter((e) => LOG_LEVELS[e.level] >= threshold);
  }
  if (filter?.source) {
    entries = entries.filter((e) => e.source === filter.source);
  }
  if (filter?.limit) {
    entries = entries.slice(-filter.limit);
  }
  return entries;
}

function emit(entry: LogEntry): void {
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[minLevel]) return;

  history.push(entry);
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  for (const cb of listeners) {
    cb(entry);
  }

  const prefix = `[${entry.source}]`;
  const args = entry.data !== undefined ? [prefix, entry.message, entry.data] : [prefix, entry.message];

  switch (entry.level) {
    case 'debug':
      console.debug(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
  }
}

export function createLogger(source: string): Logger {
  const log = (level: LogLevel, message: string, data?: unknown): void => {
    emit({ timestamp: Date.now(), level, source, message, data });
  };

  return {
    debug: (message, data) => log('debug', message, data),
    info: (message, data) => log('info', message, data),
    warn: (message, data) => log('warn', message, data),
    error: (message, data) => log('error', message, data),
  };
}
