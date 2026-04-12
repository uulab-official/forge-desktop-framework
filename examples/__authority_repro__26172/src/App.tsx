import { useState } from 'react';

declare global {
  interface Window {
    api: {
      execute: (req: { action: string; payload: Record<string, unknown> }) => Promise<any>;
    };
  }
}

export function App() {
  const [input, setInput] = useState('Hello, Forge!');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReverse = async () => {
    setLoading(true);
    try {
      const res = await window.api.execute({
        action: 'reverse',
        payload: { text: input },
      });
      if (res.success) {
        setResult(res.data.reversed);
      } else {
        setResult(`Error: ${res.error}`);
      }
    } catch (err) {
      setResult(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Forge Minimal Example
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Type text below and click Reverse. The Python worker will reverse it.
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Enter text..."
        />
        <button
          onClick={handleReverse}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Processing...' : 'Reverse'}
        </button>
        {result !== null && (
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Result:</p>
            <p className="text-lg font-mono text-gray-900 dark:text-white">{result}</p>
          </div>
        )}
      </div>
    </div>
  );
}
