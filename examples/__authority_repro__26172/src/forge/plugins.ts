import { createPluginRegistry } from '@forge/plugin-system';

export const forgePluginRegistry = createPluginRegistry();

forgePluginRegistry.register({
  id: 'workspace-overview',
  name: 'Workspace Overview',
  version: '1.0.0',
  description: 'Starter navigation and release surface for Authority Repro 26172.',
});

forgePluginRegistry.register({
  id: 'automation-lab',
  name: 'Automation Lab',
  version: '1.0.0',
  description: 'Reserved slot for background worker and job-oriented tools.',
});

forgePluginRegistry.register({
  id: 'inspector',
  name: 'Inspector',
  version: '1.0.0',
  description: 'Reserved slot for diagnostics, logs, and support workflows.',
});

export const forgeFeaturePlugins = forgePluginRegistry.getAll();
