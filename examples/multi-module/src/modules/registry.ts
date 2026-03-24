import type { ComponentType } from 'react';

export interface ModuleDefinition {
  id: string;
  label: string;
  description?: string;
  component: ComponentType;
  workerActions?: string[];
}

const modules: ModuleDefinition[] = [];

export function registerModule(def: ModuleDefinition): void {
  if (modules.find(m => m.id === def.id)) return;
  modules.push(def);
}

export function getModules(): ModuleDefinition[] {
  return [...modules];
}

export function getModuleById(id: string): ModuleDefinition | undefined {
  return modules.find(m => m.id === id);
}
