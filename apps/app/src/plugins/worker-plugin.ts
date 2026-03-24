import { pluginRegistry } from './registry';

pluginRegistry.register({
  id: 'worker-console',
  name: 'Worker Console',
  version: '0.1.0',
  description: 'Execute and test Python worker actions',
  routes: [{ path: '/worker', label: 'Worker' }],
  workerActions: ['health_check', 'echo'],
});
