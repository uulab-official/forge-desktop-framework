export type ScaffoldFeature = 'settings' | 'updater' | 'jobs' | 'plugins' | 'diagnostics' | 'notifications' | 'windowing' | 'tray' | 'deep-link' | 'menu-bar' | 'auto-launch' | 'global-shortcut' | 'file-association' | 'file-dialogs' | 'recent-files' | 'crash-recovery' | 'power-monitor' | 'idle-presence' | 'session-state' | 'downloads' | 'clipboard' | 'external-links' | 'system-info' | 'permissions' | 'network-status' | 'secure-storage';
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
  {
    id: 'windowing',
    label: 'Windowing',
    description: 'Persist window bounds, enforce single-instance focus, and expose starter window controls',
    minimalOnly: true,
  },
  {
    id: 'tray',
    label: 'Tray',
    description: 'Seed a system tray integration with show or hide controls and a starter context menu',
    minimalOnly: true,
  },
  {
    id: 'deep-link',
    label: 'Deep Link',
    description: 'Seed a protocol handler surface with starter capture and simulation controls',
    minimalOnly: true,
  },
  {
    id: 'menu-bar',
    label: 'Menu Bar',
    description: 'Seed an application menu with standard desktop commands and starter rebuild controls',
    minimalOnly: true,
  },
  {
    id: 'auto-launch',
    label: 'Auto Launch',
    description: 'Seed login-item controls so packaged apps can toggle start-on-login from the desktop shell',
    minimalOnly: true,
  },
  {
    id: 'global-shortcut',
    label: 'Global Shortcut',
    description: 'Seed a global shortcut registration with starter controls and a desktop visibility action',
    minimalOnly: true,
  },
  {
    id: 'file-association',
    label: 'File Association',
    description: 'Seed file-open handling, sample file associations, and starter file inspection controls',
    minimalOnly: true,
  },
  {
    id: 'file-dialogs',
    label: 'File Dialogs',
    description: 'Seed native open and save dialogs with reveal-in-folder controls for desktop file workflows',
    minimalOnly: true,
  },
  {
    id: 'recent-files',
    label: 'Recent Files',
    description: 'Seed a persistent recent-files registry with starter reopen and clear controls for document-based desktop apps',
    minimalOnly: true,
  },
  {
    id: 'crash-recovery',
    label: 'Crash Recovery',
    description: 'Seed crash and unresponsive incident tracking with starter relaunch and clear controls',
    minimalOnly: true,
  },
  {
    id: 'power-monitor',
    label: 'Power Monitor',
    description: 'Seed suspend, resume, lock, and power-source monitoring with starter runtime controls',
    minimalOnly: true,
  },
  {
    id: 'idle-presence',
    label: 'Idle Presence',
    description: 'Seed desktop attention and idle diagnostics with starter refresh and history controls',
    minimalOnly: true,
  },
  {
    id: 'session-state',
    label: 'Session State',
    description: 'Seed app lifecycle, focus, visibility, and foreground-background diagnostics with starter history controls',
    minimalOnly: true,
  },
  {
    id: 'downloads',
    label: 'Downloads',
    description: 'Seed starter download tracking with progress, history, and reveal-in-folder controls',
    minimalOnly: true,
  },
  {
    id: 'clipboard',
    label: 'Clipboard',
    description: 'Seed clipboard read, write, clear, and history controls for desktop workflows',
    minimalOnly: true,
  },
  {
    id: 'external-links',
    label: 'External Links',
    description: 'Seed shell.openExternal link launching with starter history and error tracking',
    minimalOnly: true,
  },
  {
    id: 'system-info',
    label: 'System Info',
    description: 'Seed runtime OS, memory, process, and path diagnostics with starter refresh controls',
    minimalOnly: true,
  },
  {
    id: 'permissions',
    label: 'Permissions',
    description: 'Seed camera, microphone, and screen permission diagnostics with starter request controls',
    minimalOnly: true,
  },
  {
    id: 'network-status',
    label: 'Network Status',
    description: 'Seed online and offline runtime diagnostics with starter refresh and history controls',
    minimalOnly: true,
  },
  {
    id: 'secure-storage',
    label: 'Secure Storage',
    description: 'Seed encrypted secret persistence with safeStorage diagnostics and starter save or load controls',
    minimalOnly: true,
  },
];

export const PRESET_DEFINITIONS: PresetDefinition[] = [
  {
    id: 'launch-ready',
    label: 'Launch Ready',
    description: 'Bundle settings, updater, jobs, plugins, diagnostics, notifications, windowing, and menu-bar for a production starter',
    features: ['settings', 'updater', 'jobs', 'plugins', 'diagnostics', 'notifications', 'windowing', 'menu-bar'],
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
