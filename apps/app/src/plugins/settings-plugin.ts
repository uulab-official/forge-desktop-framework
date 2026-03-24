import { pluginRegistry } from './registry';

pluginRegistry.register({
  id: 'settings',
  name: 'Settings',
  version: '0.1.0',
  description: 'App configuration',
  routes: [{ path: '/settings', label: 'Settings' }],
});
