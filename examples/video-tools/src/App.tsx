import { useState } from 'react';

declare global {
  interface Window {
    api: {
      execute: (req: { action: string; payload: Record<string, unknown> }) => Promise<any>;
      openFile: () => Promise<string | null>;
    };
  }
}

type Tab = 'info' | 'thumbnail';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('info');

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        Forge Video Tools
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        External binary integration demo &mdash; ffmpeg / ffprobe
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'info'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Video Info
        </button>
        <button
          onClick={() => setActiveTab('thumbnail')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'thumbnail'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Thumbnail
        </button>
      </div>

      {activeTab === 'info' && <VideoInfoPanel />}
      {activeTab === 'thumbnail' && <ThumbnailPanel />}
    </div>
  );
}

function VideoInfoPanel() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePickFile = async () => {
    const path = await window.api.openFile();
    if (!path) return;
    setFilePath(path);
    setInfo(null);
    setError(null);
    setLoading(true);
    try {
      const res = await window.api.execute({
        action: 'video_info',
        payload: { path },
      });
      if (res.success) {
        setInfo(res.data);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <button
        onClick={handlePickFile}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Analyzing...' : 'Choose Video File'}
      </button>

      {filePath && (
        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
          {filePath}
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {info && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(info).map(([key, value]) => (
                <tr key={key} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {key}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white font-mono">
                    {String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ThumbnailPanel() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState('00:00:05');
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePickFile = async () => {
    const path = await window.api.openFile();
    if (path) {
      setFilePath(path);
      setResult(null);
      setError(null);
    }
  };

  const handleExtract = async () => {
    if (!filePath) return;
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await window.api.execute({
        action: 'thumbnail',
        payload: { path: filePath, timestamp },
      });
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-3">
        <button
          onClick={handlePickFile}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Choose Video File
        </button>
        <input
          type="text"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          placeholder="HH:MM:SS"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono w-32"
        />
        <button
          onClick={handleExtract}
          disabled={!filePath || loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Extracting...' : 'Extract'}
        </button>
      </div>

      {filePath && (
        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
          {filePath}
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          {result.success ? (
            <div className="space-y-2">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Thumbnail extracted successfully
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {result.thumbnail_path}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                {result.error}
              </p>
              {result.hint && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {result.hint}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
