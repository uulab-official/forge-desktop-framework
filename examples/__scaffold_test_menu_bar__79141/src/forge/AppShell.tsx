import { useEffect, useState, type ReactNode } from 'react';
import { LogConsole, type LogItem } from '@forge/ui-kit';
import { FeatureStudio } from './FeatureStudio';


const APP_NAME = "Scaffold Test Menu Bar 79141";
const TEMPLATE_NAME = "Minimal";
const MAX_LOGS = 200;

export interface ForgeAppShellProps {
  children: ReactNode;
}

export function ForgeAppShell({ children }: ForgeAppShellProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);

  useEffect(() => {
    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    const push = (level: LogItem['level'], source: string, message: string) => {
      setLogs((prev) => {
        const next = [...prev, { timestamp: Date.now(), level, source, message }];
        return next.slice(-MAX_LOGS);
      });
    };

    push('info', 'forge', `${APP_NAME} booted (${TEMPLATE_NAME} template)`);

    console.log = (...args) => {
      push('info', 'renderer', formatArgs(args));
      original.log(...args);
    };

    console.info = (...args) => {
      push('info', 'renderer', formatArgs(args));
      original.info(...args);
    };

    console.warn = (...args) => {
      push('warn', 'renderer', formatArgs(args));
      original.warn(...args);
    };

    console.error = (...args) => {
      push('error', 'renderer', formatArgs(args));
      original.error(...args);
    };

    const handleError = (event: ErrorEvent) => {
      push('error', 'window', event.message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      push('error', 'promise', formatArgs([event.reason]));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.log = original.log;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950/5">
      {children}

      <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
        {open && (
          <div className="w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Forge Runtime</p>
                <h2 className="text-sm font-semibold text-white">{APP_NAME}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Close
              </button>
            </div>
            <FeatureStudio />
            <LogConsole logs={logs} maxHeight={240} />
          </div>
        )}

        <button
          onClick={() => setOpen((value) => !value)}
          className="rounded-full border border-slate-800 bg-slate-950 px-4 py-3 text-left shadow-xl transition hover:border-slate-600"
        >
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Forge</p>
              <p className="text-sm font-medium text-white">Logs {logs.length > 0 ? `(${logs.length})` : ''}</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function formatArgs(args: unknown[]): string {
  return args
    .map((value) => {
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(' ');
}
