export interface AppSettings {
  outputDir: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  workerTimeout: number;
  concurrency: number;
  [key: string]: unknown;
}

export const DEFAULT_SETTINGS: AppSettings = {
  outputDir: '',
  language: 'en',
  theme: 'system',
  workerTimeout: 300000,
  concurrency: 1,
};
