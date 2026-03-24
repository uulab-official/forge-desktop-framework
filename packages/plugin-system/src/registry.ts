import { createLogger } from '@forge/logger';
import type { PluginDefinition, PluginRoute, PluginMenuItem, PluginContext } from './types.js';

export interface PluginRegistry {
  register(plugin: PluginDefinition): void;
  unregister(id: string): void;
  getAll(): PluginDefinition[];
  getById(id: string): PluginDefinition | undefined;
  getRoutes(): Array<PluginRoute & { pluginId: string }>;
  getMenuItems(): Array<PluginMenuItem & { pluginId: string }>;
  getWorkerActions(): Array<{ pluginId: string; action: string }>;
  activateAll(ctx: PluginContext): Promise<void>;
  deactivateAll(): Promise<void>;
}

export function createPluginRegistry(): PluginRegistry {
  const logger = createLogger('plugin-system');
  const plugins = new Map<string, PluginDefinition>();

  return {
    register(plugin) {
      if (plugins.has(plugin.id)) {
        logger.warn(`Plugin "${plugin.id}" already registered, skipping`);
        return;
      }
      plugins.set(plugin.id, plugin);
      logger.info(`Plugin registered: ${plugin.name} v${plugin.version}`);
    },

    unregister(id) {
      const plugin = plugins.get(id);
      if (plugin) {
        plugins.delete(id);
        logger.info(`Plugin unregistered: ${plugin.name}`);
      }
    },

    getAll() {
      return Array.from(plugins.values());
    },

    getById(id) {
      return plugins.get(id);
    },

    getRoutes() {
      const routes: Array<PluginRoute & { pluginId: string }> = [];
      for (const [id, plugin] of plugins) {
        if (plugin.routes) {
          for (const route of plugin.routes) {
            routes.push({ ...route, pluginId: id });
          }
        }
      }
      return routes;
    },

    getMenuItems() {
      const items: Array<PluginMenuItem & { pluginId: string }> = [];
      for (const [id, plugin] of plugins) {
        if (plugin.menuItems) {
          for (const item of plugin.menuItems) {
            items.push({ ...item, pluginId: id });
          }
        }
      }
      return items;
    },

    getWorkerActions() {
      const actions: Array<{ pluginId: string; action: string }> = [];
      for (const [id, plugin] of plugins) {
        if (plugin.workerActions) {
          for (const action of plugin.workerActions) {
            actions.push({ pluginId: id, action });
          }
        }
      }
      return actions;
    },

    async activateAll(ctx) {
      for (const plugin of plugins.values()) {
        if (plugin.onActivate) {
          try {
            await plugin.onActivate(ctx);
            logger.info(`Plugin activated: ${plugin.name}`);
          } catch (err) {
            logger.error(`Failed to activate plugin: ${plugin.name}`, err);
          }
        }
      }
    },

    async deactivateAll() {
      for (const plugin of plugins.values()) {
        if (plugin.onDeactivate) {
          try {
            await plugin.onDeactivate();
            logger.info(`Plugin deactivated: ${plugin.name}`);
          } catch (err) {
            logger.error(`Failed to deactivate plugin: ${plugin.name}`, err);
          }
        }
      }
    },
  };
}
