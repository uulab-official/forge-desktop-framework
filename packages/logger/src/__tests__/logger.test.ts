import { describe, it, expect } from 'vitest';
import { createLogger, getLogHistory, onLogEntry } from '../index.js';

describe('createLogger', () => {
  it('creates a logger with all levels', () => {
    const log = createLogger('test');
    expect(log.debug).toBeDefined();
    expect(log.info).toBeDefined();
    expect(log.warn).toBeDefined();
    expect(log.error).toBeDefined();
  });

  it('emits log entries', () => {
    const entries: any[] = [];
    const unsub = onLogEntry((e) => entries.push(e));
    const log = createLogger('test');
    log.info('hello');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[entries.length - 1].message).toBe('hello');
    expect(entries[entries.length - 1].source).toBe('test');
    expect(entries[entries.length - 1].level).toBe('info');
    unsub();
  });

  it('stores log history', () => {
    const log = createLogger('history-test');
    log.info('test message');
    const history = getLogHistory({ source: 'history-test' });
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].message).toBe('test message');
  });
});
