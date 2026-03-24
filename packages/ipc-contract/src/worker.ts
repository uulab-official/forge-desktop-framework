export interface WorkerRequest {
  action: string;
  payload: Record<string, unknown>;
  jobId?: string;
}

export interface WorkerResponse {
  success: boolean;
  data: Record<string, unknown> | null;
  error: string | null;
}

export interface WorkerProgress {
  progress: {
    current: number;
    total: number;
    message?: string;
  };
  jobId?: string;
}

export interface WorkerReady {
  ready: true;
}

export type WorkerMessage = WorkerResponse | WorkerProgress | WorkerReady;

export function isWorkerProgress(msg: WorkerMessage): msg is WorkerProgress {
  return 'progress' in msg;
}

export function isWorkerReady(msg: WorkerMessage): msg is WorkerReady {
  return 'ready' in msg && msg.ready === true;
}

export function isWorkerResponse(msg: WorkerMessage): msg is WorkerResponse {
  return 'success' in msg;
}
