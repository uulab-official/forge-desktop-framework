import { useState, useEffect, useCallback } from 'react';
import { AppLayout, FileDropZone, ProgressPanel } from '@forge/ui-kit';
import type { ProgressItem } from '@forge/ui-kit';
import type { JobDefinition } from '@forge/ipc-contract';
import { getAPI } from './shared/lib/ipc';

interface FileResult {
  jobId: string;
  fileName: string;
  status: JobDefinition['status'];
  data?: Record<string, unknown>;
  error?: string;
}

export function App() {
  const [results, setResults] = useState<FileResult[]>([]);
  const [jobs, setJobs] = useState<Map<string, JobDefinition>>(new Map());

  // Listen for job updates from main process
  useEffect(() => {
    const api = getAPI();
    const unsubscribe = api.job.onUpdate((job) => {
      setJobs((prev) => {
        const next = new Map(prev);
        next.set(job.id, job);
        return next;
      });

      // Update results when job completes
      if (job.status === 'success' || job.status === 'failed') {
        setResults((prev) =>
          prev.map((r) =>
            r.jobId === job.id
              ? {
                  ...r,
                  status: job.status,
                  data: job.result?.data ?? undefined,
                  error: job.error ?? job.result?.error ?? undefined,
                }
              : r,
          ),
        );
      }
    });

    return unsubscribe;
  }, []);

  const handleDrop = useCallback(async (files: File[]) => {
    const api = getAPI();

    for (const file of files) {
      const job = await api.job.submit('process_file', {
        path: file.path,
        name: file.name,
      });

      const jobDef = job as JobDefinition;

      setResults((prev) => [
        ...prev,
        {
          jobId: jobDef.id,
          fileName: file.name,
          status: 'pending',
        },
      ]);

      setJobs((prev) => {
        const next = new Map(prev);
        next.set(jobDef.id, jobDef);
        return next;
      });
    }
  }, []);

  const handleCancel = useCallback((jobId: string) => {
    const api = getAPI();
    api.job.cancel(jobId);
  }, []);

  const handleClear = useCallback(() => {
    setResults([]);
    setJobs(new Map());
  }, []);

  // Build progress items from active jobs
  const progressItems: ProgressItem[] = Array.from(jobs.values())
    .filter((j) => j.status === 'pending' || j.status === 'running')
    .map((j) => ({
      id: j.id,
      label: (j.payload.name as string) ?? j.action,
      status: j.status,
      progress: j.progress,
    }));

  const completedResults = results.filter(
    (r) => r.status === 'success' || r.status === 'failed',
  );

  return (
    <AppLayout
      bottomPanel={
        <ProgressPanel items={progressItems} onCancel={handleCancel} />
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">File Processor</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Drop files to analyze them using the Python worker
            </p>
          </div>
          {results.length > 0 && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Drop Zone */}
        <FileDropZone onDrop={handleDrop}>
          <div className="py-4">
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
              Drop files here to process
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Each file will be submitted as a separate job
            </p>
          </div>
        </FileDropZone>

        {/* Results Table */}
        {completedResults.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">File</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Size</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {completedResults.map((r) => (
                  <ResultRow key={r.jobId} result={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-lg">No files processed yet</p>
            <p className="text-sm mt-1">
              Drag and drop files onto the zone above to get started
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ResultRow({ result }: { result: FileResult }) {
  const { fileName, status, data, error } = result;

  if (status === 'failed') {
    return (
      <tr>
        <td className="px-4 py-3 font-mono text-sm">{fileName}</td>
        <td className="px-4 py-3">
          <span className="text-red-500 font-medium">Failed</span>
        </td>
        <td className="px-4 py-3 text-gray-400" colSpan={3}>
          {error ?? 'Unknown error'}
        </td>
      </tr>
    );
  }

  const sizeBytes = (data?.size as number) ?? 0;
  const sizeLabel = formatFileSize(sizeBytes);
  const ext = (data?.extension as string) ?? '—';
  const isText = data?.is_text as boolean;

  const details: string[] = [];
  if (isText) {
    const lines = data?.line_count as number | undefined;
    const words = data?.word_count as number | undefined;
    const chars = data?.char_count as number | undefined;
    if (lines != null) details.push(`${lines.toLocaleString()} lines`);
    if (words != null) details.push(`${words.toLocaleString()} words`);
    if (chars != null) details.push(`${chars.toLocaleString()} chars`);
  } else {
    details.push('binary');
  }

  return (
    <tr>
      <td className="px-4 py-3 font-mono text-sm">{fileName}</td>
      <td className="px-4 py-3">
        <span className="text-green-500 font-medium">Done</span>
      </td>
      <td className="px-4 py-3 tabular-nums">{sizeLabel}</td>
      <td className="px-4 py-3 font-mono">{ext}</td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
        {details.join(' / ')}
      </td>
    </tr>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
