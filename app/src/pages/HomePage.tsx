import { useState } from 'react';
import { EmptyState } from '@forge/ui-kit';
import { getAPI } from '../shared/lib/ipc';

export function HomePage() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleHealthCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const api = getAPI();
      const response = await api.worker.execute({
        action: 'health_check',
        payload: {},
      });
      setResult(JSON.stringify(response, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEcho = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const api = getAPI();
      const response = await api.worker.execute({
        action: 'echo',
        payload: { message: 'Hello from Forge!', timestamp: Date.now() },
      });
      setResult(JSON.stringify(response, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Forge Desktop Framework</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Local-engine desktop app framework
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleHealthCheck}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Running...' : 'Health Check'}
        </button>
        <button
          onClick={handleEcho}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Running...' : 'Echo Test'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm font-mono">{error}</p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-gray-900 rounded-lg">
          <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      {!result && !error && !loading && (
        <EmptyState
          title="Ready to go"
          description="Click a button above to test the Python worker connection."
        />
      )}
    </div>
  );
}
