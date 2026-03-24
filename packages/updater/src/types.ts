export type UpdateStatusType =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateStatus {
  status: UpdateStatusType;
  version?: string;
  progress?: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  };
  error?: string;
  releaseNotes?: string;
}

export interface UpdaterOptions {
  autoDownload?: boolean;
  autoInstallOnAppQuit?: boolean;
  checkInterval?: number;
}
