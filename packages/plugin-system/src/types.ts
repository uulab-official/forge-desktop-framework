import type { Logger } from '@forge/logger';

export interface PluginRoute {
  path: string;
  label: string;
  icon?: string;
}

export interface PluginMenuItem {
  label: string;
  accelerator?: string;
  action: string;
}

export interface PluginContext {
  executeAction: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
  submitJob: (action: string, payload: Record<string, unknown>) => string;
  logger: Logger;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;

  routes?: PluginRoute[];
  workerActions?: string[];
  menuItems?: PluginMenuItem[];

  onActivate?: (ctx: PluginContext) => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}
