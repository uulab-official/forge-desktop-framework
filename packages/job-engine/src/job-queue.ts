import { randomUUID } from 'node:crypto';
import type { JobDefinition, WorkerRequest } from '@forge/ipc-contract';
import type { WorkerClient } from '@forge/worker-client';
import { createLogger } from '@forge/logger';

export interface JobEngine {
  submit(action: string, payload: Record<string, unknown>): string;
  cancel(jobId: string): void;
  getJob(jobId: string): JobDefinition | undefined;
  getAllJobs(): JobDefinition[];
  onJobUpdate(cb: (job: JobDefinition) => void): () => void;
  dispose(): void;
}

export interface JobEngineOptions {
  concurrency?: number;
}

export function createJobEngine(
  workerClient: WorkerClient,
  opts?: JobEngineOptions,
): JobEngine {
  const logger = createLogger('job-engine');
  const jobs = new Map<string, JobDefinition>();
  const queue: string[] = [];
  const listeners = new Set<(job: JobDefinition) => void>();
  let running = 0;
  const maxConcurrency = opts?.concurrency ?? 1;
  let disposed = false;

  function notify(job: JobDefinition): void {
    for (const cb of listeners) {
      cb({ ...job });
    }
  }

  function updateJob(jobId: string, updates: Partial<JobDefinition>): void {
    const job = jobs.get(jobId);
    if (!job) return;
    Object.assign(job, updates);
    notify(job);
  }

  async function processNext(): Promise<void> {
    if (disposed || running >= maxConcurrency || queue.length === 0) return;

    const jobId = queue.shift()!;
    const job = jobs.get(jobId);
    if (!job || job.status === 'canceled') {
      processNext();
      return;
    }

    running++;
    updateJob(jobId, { status: 'running', startedAt: Date.now() });
    logger.info('Job started', { jobId, action: job.action });

    const request: WorkerRequest = {
      action: job.action,
      payload: job.payload,
      jobId,
    };

    try {
      const response = await workerClient.executeWithProgress(request, (progress) => {
        updateJob(jobId, { progress });
      });

      if (response.success) {
        updateJob(jobId, {
          status: 'success',
          completedAt: Date.now(),
          result: response,
        });
        logger.info('Job completed', { jobId });
      } else {
        updateJob(jobId, {
          status: 'failed',
          completedAt: Date.now(),
          result: response,
          error: response.error ?? 'Unknown error',
        });
        logger.error('Job failed', { jobId, error: response.error });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateJob(jobId, {
        status: 'failed',
        completedAt: Date.now(),
        error: errorMsg,
      });
      logger.error('Job error', { jobId, error: errorMsg });
    } finally {
      running--;
      processNext();
    }
  }

  return {
    submit(action, payload) {
      const id = randomUUID();
      const job: JobDefinition = {
        id,
        action,
        payload,
        status: 'pending',
        createdAt: Date.now(),
      };
      jobs.set(id, job);
      queue.push(id);
      notify(job);
      logger.info('Job submitted', { jobId: id, action });
      processNext();
      return id;
    },

    cancel(jobId) {
      const job = jobs.get(jobId);
      if (!job) return;

      if (job.status === 'running') {
        workerClient.cancel();
      }

      if (job.status === 'pending' || job.status === 'running') {
        updateJob(jobId, { status: 'canceled', completedAt: Date.now() });
        logger.info('Job canceled', { jobId });
      }
    },

    getJob(jobId) {
      const job = jobs.get(jobId);
      return job ? { ...job } : undefined;
    },

    getAllJobs() {
      return Array.from(jobs.values()).map((j) => ({ ...j }));
    },

    onJobUpdate(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    dispose() {
      disposed = true;
      listeners.clear();
      workerClient.dispose();
    },
  };
}
