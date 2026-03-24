import { useState, useCallback } from 'react';

declare global {
  interface Window {
    api: {
      execute: (request: { action: string; payload: Record<string, unknown> }) => Promise<{
        success: boolean;
        data?: Record<string, unknown>;
        error?: string;
      }>;
    };
  }
}

interface HistoryEntry {
  expression: string;
  result: number;
}

export function CalculatorModule() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleCalculate = useCallback(async () => {
    if (!expression.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await window.api.execute({
        action: 'calculate',
        payload: { expression: expression.trim() },
      });

      if (response.success && response.data) {
        const res = response.data['result'] as number;
        setResult(String(res));
        setHistory(prev => [
          { expression: expression.trim(), result: res },
          ...prev.slice(0, 19),
        ]);
      } else {
        setError(response.error ?? 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute');
    } finally {
      setLoading(false);
    }
  }, [expression]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCalculate();
    },
    [handleCalculate],
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Calculator</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Math expression evaluator powered by the Python worker.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder="e.g. 2 + 3 * 4"
          value={expression}
          onChange={e => setExpression(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          onClick={handleCalculate}
          disabled={loading || !expression.trim()}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : '='}
        </button>
      </div>

      {result !== null && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <span className="text-sm text-green-600 dark:text-green-400">Result:</span>
          <span className="ml-2 text-lg font-mono font-semibold text-green-800 dark:text-green-200">
            {result}
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <span className="text-sm text-red-600 dark:text-red-400">Error:</span>
          <span className="ml-2 text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">History</h3>
          <div className="space-y-1">
            {history.map((entry, i) => (
              <div
                key={i}
                className="flex justify-between px-3 py-2 rounded text-sm bg-gray-100 dark:bg-gray-800 font-mono"
              >
                <span className="text-gray-600 dark:text-gray-300">{entry.expression}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  = {entry.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
