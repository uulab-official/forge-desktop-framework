import { useRef, useEffect } from 'react';

export interface LogItem {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

export interface LogConsoleProps {
  logs: LogItem[];
  maxHeight?: number;
}

const LEVEL_COLORS = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

export function LogConsole({ logs, maxHeight = 200 }: LogConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div
      className="bg-gray-900 text-gray-300 font-mono text-xs p-3 overflow-y-auto"
      style={{ maxHeight }}
    >
      {logs.map((log, i) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        return (
          <div key={i} className="leading-5">
            <span className="text-gray-600">{time}</span>{' '}
            <span className={LEVEL_COLORS[log.level]}>[{log.level.toUpperCase()}]</span>{' '}
            <span className="text-gray-500">[{log.source}]</span> {log.message}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
