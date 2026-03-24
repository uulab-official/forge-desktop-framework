import { useState, useCallback } from 'react';
import { useWebGPU } from './hooks/useWebGPU';
import { gpuMatrixMultiply, cpuMatrixMultiply } from './compute/matrix-multiply';
import { HeatmapCanvas } from './components/HeatmapCanvas';
import { StatCard } from './components/StatCard';

declare global {
  interface Window {
    api: {
      execute: (req: { action: string; payload: Record<string, unknown> }) => Promise<any>;
    };
  }
}

const MATRIX_SIZES = [64, 128, 256, 512];

export function App() {
  const { supported, device, error: gpuError, isReady } = useWebGPU();

  const [matrixSize, setMatrixSize] = useState(128);
  const [gpuTime, setGpuTime] = useState<number | null>(null);
  const [cpuTime, setCpuTime] = useState<number | null>(null);
  const [gpuSample, setGpuSample] = useState<number[]>([]);
  const [gpuLoading, setGpuLoading] = useState(false);
  const [cpuLoading, setCpuLoading] = useState(false);

  const speedup = gpuTime && cpuTime ? Math.round((cpuTime / gpuTime) * 10) / 10 : null;

  const runGpu = useCallback(async () => {
    if (!device) return;
    setGpuLoading(true);
    try {
      const result = await gpuMatrixMultiply(device, matrixSize);
      setGpuTime(result.timeMs);
      setGpuSample(result.resultSample);
    } catch (err) {
      console.error('GPU compute failed:', err);
    } finally {
      setGpuLoading(false);
    }
  }, [device, matrixSize]);

  const runCpu = useCallback(() => {
    setCpuLoading(true);
    // Use requestAnimationFrame to allow UI to update before blocking
    requestAnimationFrame(() => {
      try {
        const result = cpuMatrixMultiply(matrixSize);
        setCpuTime(result.timeMs);
        if (gpuSample.length === 0) {
          setGpuSample(result.resultSample);
        }
      } catch (err) {
        console.error('CPU compute failed:', err);
      } finally {
        setCpuLoading(false);
      }
    });
  }, [matrixSize, gpuSample.length]);

  if (!supported) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-100 dark:bg-red-900/30 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400">
            WebGPU Not Supported
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            WebGPU is not available
          </h1>
          <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-6 text-left text-sm text-gray-600 dark:text-gray-300 space-y-2">
            <p>To enable WebGPU in Electron, ensure the main process includes:</p>
            <pre className="mt-2 rounded bg-gray-200 dark:bg-gray-700 p-3 font-mono text-xs overflow-x-auto">
{`app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan');`}
            </pre>
            <p className="mt-3">Also verify that your system has a compatible GPU and up-to-date drivers.</p>
            {gpuError && (
              <p className="mt-3 text-red-600 dark:text-red-400">
                Error details: {gpuError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            WebGPU Matrix Multiply
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isReady
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isReady ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
            {isReady ? 'GPU Ready' : 'Initializing...'}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Matrix Size
          </label>
          <select
            value={matrixSize}
            onChange={(e) => setMatrixSize(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            {MATRIX_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} x {s}
              </option>
            ))}
          </select>

          <button
            onClick={runGpu}
            disabled={!isReady || gpuLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {gpuLoading ? 'Computing...' : 'Run GPU'}
          </button>

          <button
            onClick={runCpu}
            disabled={cpuLoading}
            className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {cpuLoading ? 'Computing...' : 'Run CPU'}
          </button>
        </div>

        {/* Results */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="GPU Time" value={gpuTime} unit="ms" />
          <StatCard label="CPU Time" value={cpuTime} unit="ms" />
          <StatCard
            label="Speedup"
            value={speedup !== null ? `${speedup}x` : null}
          />
        </div>

        {/* Sample Values */}
        {gpuSample.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Result Sample (first {gpuSample.length} values)
            </p>
            <div className="flex flex-wrap gap-2">
              {gpuSample.map((v, i) => (
                <span
                  key={i}
                  className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 font-mono text-xs text-gray-700 dark:text-gray-300"
                >
                  {v.toFixed(4)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Heatmap */}
        {gpuSample.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Result Heatmap (partial)
            </p>
            <HeatmapCanvas
              data={gpuSample}
              width={480}
              height={120}
              cellSize={12}
            />
          </div>
        )}
      </div>
    </div>
  );
}
