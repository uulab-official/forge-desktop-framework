export type ScaffoldFeature = 'settings' | 'updater' | 'jobs' | 'plugins' | 'diagnostics' | 'notifications';
export type ScaffoldPreset = 'launch-ready';

export interface FeatureDefinition {
  id: ScaffoldFeature;
  label: string;
  description: string;
  minimalOnly: boolean;
}

export interface PresetDefinition {
  id: ScaffoldPreset;
  label: string;
  description: string;
  features: ScaffoldFeature[];
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    id: 'settings',
    label: 'Settings',
    description: 'Persist desktop preferences and expose a settings panel in the runtime shell',
    minimalOnly: true,
  },
  {
    id: 'updater',
    label: 'Updater',
    description: 'Wire packaged builds to Forge updater IPC with runtime update controls',
    minimalOnly: true,
  },
  {
    id: 'jobs',
    label: 'Jobs',
    description: 'Enable queued background jobs with live progress in the runtime shell',
    minimalOnly: true,
  },
  {
    id: 'plugins',
    label: 'Plugins',
    description: 'Seed a plugin registry and sample plugin inventory for feature-oriented apps',
    minimalOnly: true,
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    description: 'Add an in-app diagnostics panel with environment summary and support bundle export',
    minimalOnly: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Enable native desktop notifications with a starter control surface in the runtime shell',
    minimalOnly: true,
  },
];

export const PRESET_DEFINITIONS: PresetDefinition[] = [
  {
    id: 'launch-ready',
    label: 'Launch Ready',
    description: 'Bundle settings, updater, jobs, plugins, diagnostics, and notifications for a production starter',
    features: ['settings', 'updater', 'jobs', 'plugins', 'diagnostics', 'notifications'],
  },
];

export function getFeatureDefinition(id: string): FeatureDefinition | undefined {
  return FEATURE_DEFINITIONS.find((feature) => feature.id === id);
}

export function getPresetDefinition(id: string): PresetDefinition | undefined {
  return PRESET_DEFINITIONS.find((preset) => preset.id === id);
}

export function normalizeFeatures(features: string[] | undefined): ScaffoldFeature[] {
  const normalized = new Set<ScaffoldFeature>();

  for (const value of features ?? []) {
    const feature = getFeatureDefinition(value);
    if (!feature) {
      throw new Error(`Unknown feature pack: ${value}`);
    }
    normalized.add(feature.id);
  }

  return Array.from(normalized);
}

export function normalizeFeatureSelection(
  features: string[] | undefined,
  presets: string[] | undefined,
): ScaffoldFeature[] {
  const normalized = new Set<ScaffoldFeature>(normalizeFeatures(features));

  for (const value of presets ?? []) {
    const preset = getPresetDefinition(value);
    if (!preset) {
      throw new Error(`Unknown preset: ${value}`);
    }

    for (const feature of preset.features) {
      normalized.add(feature);
    }
  }

  return Array.from(normalized);
}
