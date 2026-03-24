import { describe, it, expect } from 'vitest';
import { createPluginRegistry } from '../index.js';

describe('createPluginRegistry', () => {
  it('registers and retrieves plugins', () => {
    const registry = createPluginRegistry();
    registry.register({ id: 'test', name: 'Test', version: '1.0.0' });
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getById('test')?.name).toBe('Test');
  });

  it('prevents duplicate registration', () => {
    const registry = createPluginRegistry();
    registry.register({ id: 'test', name: 'Test', version: '1.0.0' });
    registry.register({ id: 'test', name: 'Test Dupe', version: '2.0.0' });
    expect(registry.getAll()).toHaveLength(1);
  });

  it('unregisters plugins', () => {
    const registry = createPluginRegistry();
    registry.register({ id: 'test', name: 'Test', version: '1.0.0' });
    registry.unregister('test');
    expect(registry.getAll()).toHaveLength(0);
  });

  it('collects routes from plugins', () => {
    const registry = createPluginRegistry();
    registry.register({
      id: 'p1', name: 'P1', version: '1.0.0',
      routes: [{ path: '/a', label: 'A' }],
    });
    registry.register({
      id: 'p2', name: 'P2', version: '1.0.0',
      routes: [{ path: '/b', label: 'B' }],
    });
    expect(registry.getRoutes()).toHaveLength(2);
  });

  it('collects worker actions', () => {
    const registry = createPluginRegistry();
    registry.register({
      id: 'p1', name: 'P1', version: '1.0.0',
      workerActions: ['action_a', 'action_b'],
    });
    const actions = registry.getWorkerActions();
    expect(actions).toHaveLength(2);
    expect(actions[0].action).toBe('action_a');
  });
});
