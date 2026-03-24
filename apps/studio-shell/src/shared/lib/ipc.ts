import type { ElectronAPI } from '../../../electron/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function getAPI(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error('electronAPI not available — are you running inside Electron?');
  }
  return window.electronAPI;
}
