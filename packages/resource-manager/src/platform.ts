import { platform, arch } from 'node:os';

export type Platform = 'darwin' | 'win32' | 'linux';

export function getPlatform(): Platform {
  return platform() as Platform;
}

export function getArch(): string {
  return arch();
}

export function getExeSuffix(): string {
  return getPlatform() === 'win32' ? '.exe' : '';
}
