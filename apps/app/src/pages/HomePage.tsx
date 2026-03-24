import { useState, useRef, useEffect } from 'react';
import { getAPI } from '../shared/lib/ipc';

interface LogEntry {
  id: number;
  time: string;
  action: string;
  status: 'pending' | 'success' | 'error';
  duration?: number;
  response?: string;
}

let logId = 0;

export function HomePage() {
  const [input, setInput] = useState('Hello from Forge!');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const executeAction = async (action: string, payload: Record<string, unknown>) => {
    const id = ++logId;
    const time = new Date().toLocaleTimeString('en', { hour12: false, fractionalSecondDigits: 1 });

    setLogs((prev) => [...prev, { id, time, action, status: 'pending' }]);
    setLoading(true);

    const start = performance.now();
    try {
      const api = getAPI();
      const res = await api.worker.execute({ action, payload });
      const duration = Math.round(performance.now() - start);

      setLogs((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, status: 'success', duration, response: JSON.stringify(res.data, null, 2) }
            : l,
        ),
      );
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setLogs((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, status: 'error', duration, response: String(err) }
            : l,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-8 pb-0">
        <h1 className="text-2xl font-bold tracking-tight">Worker Console</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Execute Python worker actions and inspect responses
        </p>
      </div>

      {/* Action Bar */}
      <div className="p-8 pb-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">
            Payload message
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') executeAction('echo', { message: input, timestamp: Date.now() });
            }}
            className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 dark:focus:border-violet-400 transition-shadow"
            placeholder="Enter a message..."
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => executeAction('health_check', {})}
            disabled={loading}
            className="h-9 px-4 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-all"
          >
            Health Check
          </button>
          <button
            onClick={() => executeAction('echo', { message: input, timestamp: Date.now() })}
            disabled={loading}
            className="h-9 px-4 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-40 transition-all"
          >
            Echo
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No requests yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Click a button above to execute a worker action
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <LogItem key={log.id} log={log} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const statusDot =
    log.status === 'success'
      ? 'bg-emerald-500'
      : log.status === 'error'
      ? 'bg-red-500'
      : 'bg-amber-500 animate-pulse';

  return (
    <div className="animate-slide-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono w-20 flex-shrink-0">
            {log.time}
          </span>
          <span className="text-xs font-semibold font-mono text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded">
            {log.action}
          </span>
          <span className="flex-1" />
          {log.duration !== undefined && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {log.duration}ms
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && log.response && (
        <div className="mx-px border-x border-b border-zinc-200 dark:border-zinc-800 rounded-b-lg bg-zinc-950 px-4 py-3 overflow-x-auto">
          <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
            {log.response}
          </pre>
        </div>
      )}
    </div>
  );
}
