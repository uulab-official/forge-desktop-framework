import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerMessage,
} from '@forge/ipc-contract';
import { isWorkerProgress, isWorkerReady, isWorkerResponse } from '@forge/ipc-contract';
import type { Logger } from '@forge/logger';
import { createLogger } from '@forge/logger';

export interface WorkerClientOptions {
  workerPath: string;
  pythonPath?: string;
  isDev?: boolean;
  timeout?: number;
  logger?: Logger;
}

export interface ProgressInfo {
  current: number;
  total: number;
  message?: string;
}

export interface WorkerClient {
  execute(request: WorkerRequest): Promise<WorkerResponse>;
  executeWithProgress(
    request: WorkerRequest,
    onProgress: (info: ProgressInfo) => void,
  ): Promise<WorkerResponse>;
  cancel(): void;
  isRunning(): boolean;
  dispose(): void;
}

export function createWorkerClient(opts: WorkerClientOptions): WorkerClient {
  const logger = opts.logger ?? createLogger('worker-client');
  const timeout = opts.timeout ?? 300_000;
  let currentProcess: ChildProcess | null = null;
  let disposed = false;

  function spawnWorker(): ChildProcess {
    const { workerPath, pythonPath = 'python3', isDev = false } = opts;

    let proc: ChildProcess;
    if (isDev) {
      logger.info('Spawning Python worker (dev)', { pythonPath, workerPath });
      proc = spawn(pythonPath, [workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });
    } else {
      logger.info('Spawning worker executable', { workerPath });
      proc = spawn(workerPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    }

    if (proc.stderr) {
      const stderrRl = createInterface({ input: proc.stderr });
      stderrRl.on('line', (line) => {
        logger.debug('[worker stderr]', line);
      });
    }

    return proc;
  }

  function runRequest(
    request: WorkerRequest,
    onProgress?: (info: ProgressInfo) => void,
  ): Promise<WorkerResponse> {
    if (disposed) {
      return Promise.reject(new Error('WorkerClient has been disposed'));
    }

    return new Promise<WorkerResponse>((resolve, reject) => {
      const proc = spawnWorker();
      currentProcess = proc;

      let settled = false;
      let readyReceived = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          logger.error('Worker timeout', { timeout });
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL');
          }, 5000);
          reject(new Error(`Worker timed out after ${timeout}ms`));
        }
      }, timeout);

      const cleanup = () => {
        clearTimeout(timer);
        currentProcess = null;
      };

      if (!proc.stdout || !proc.stdin) {
        cleanup();
        reject(new Error('Failed to open worker stdio'));
        return;
      }

      const rl = createInterface({ input: proc.stdout });

      rl.on('line', (line) => {
        if (settled) return;

        let msg: WorkerMessage;
        try {
          msg = JSON.parse(line) as WorkerMessage;
        } catch {
          logger.warn('Non-JSON output from worker', line);
          return;
        }

        if (isWorkerReady(msg)) {
          readyReceived = true;
          logger.info('Worker ready, sending request');
          proc.stdin!.write(JSON.stringify(request) + '\n');
          return;
        }

        if (isWorkerProgress(msg)) {
          onProgress?.(msg.progress);
          return;
        }

        if (isWorkerResponse(msg)) {
          settled = true;
          cleanup();
          resolve(msg);
          proc.kill('SIGTERM');
          return;
        }
      });

      proc.on('error', (err) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`Worker process error: ${err.message}`));
        }
      });

      proc.on('close', (code) => {
        if (!settled) {
          settled = true;
          cleanup();
          if (code !== 0) {
            reject(new Error(`Worker exited with code ${code}`));
          } else {
            reject(new Error('Worker exited without sending a response'));
          }
        }
      });

      // If worker doesn't need a ready signal, send request immediately after a short delay
      setTimeout(() => {
        if (!readyReceived && !settled && proc.stdin?.writable) {
          logger.info('Sending request (no ready signal)');
          proc.stdin.write(JSON.stringify(request) + '\n');
        }
      }, 500);
    });
  }

  return {
    execute(request) {
      return runRequest(request);
    },

    executeWithProgress(request, onProgress) {
      return runRequest(request, onProgress);
    },

    cancel() {
      if (currentProcess && !currentProcess.killed) {
        logger.info('Canceling worker process');
        currentProcess.kill('SIGTERM');
        setTimeout(() => {
          if (currentProcess && !currentProcess.killed) {
            currentProcess.kill('SIGKILL');
          }
        }, 5000);
      }
    },

    isRunning() {
      return currentProcess !== null && !currentProcess.killed;
    },

    dispose() {
      disposed = true;
      this.cancel();
    },
  };
}
