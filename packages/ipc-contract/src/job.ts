import type { WorkerResponse } from './worker.js';

export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

export interface JobDefinition {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: WorkerResponse;
  error?: string;
}
