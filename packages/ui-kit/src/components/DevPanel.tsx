import { useState, useEffect, useRef, useCallback } from 'react';

export interface DevMessage {
  id: number;
  timestamp: number;
  direction: 'send' | 'receive';
  channel: string;
  data?: unknown;
}

export interface DevPanelProps {
  messages: DevMessage[];
  onClear?: () => void;
  shortcutKey?: string;
}

export function DevPanel({ messages, onClear, shortcutKey = 'KeyD' }: DevPanelProps) {
  const [visible, setVisible] = useState(false);
  const [filter, setFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === shortcutKey) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcutKey]);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, visible]);

  const filtered = filter
    ? messages.filter((m) => m.channel.includes(filter))
    : messages;

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-50 flex flex-col" style={{ height: '300px' }}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400">IPC Dev Panel</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter channels..."
            className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded"
          />
          <span className="text-xs text-gray-500">{filtered.length} messages</span>
        </div>
        <div className="flex items-center gap-2">
          {onClear && (
            <button
              onClick={onClear}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setVisible(false)}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5">
        {filtered.map((msg) => {
          const time = new Date(msg.timestamp).toLocaleTimeString('en', { hour12: false, fractionalSecondDigits: 3 });
          const arrow = msg.direction === 'send' ? '\u2192' : '\u2190';
          const color = msg.direction === 'send' ? 'text-blue-400' : 'text-green-400';
          return (
            <div key={msg.id} className="flex gap-2 leading-5">
              <span className="text-gray-600">{time}</span>
              <span className={color}>{arrow}</span>
              <span className="text-yellow-400">{msg.channel}</span>
              {msg.data !== undefined && (
                <span className="text-gray-400 truncate">
                  {JSON.stringify(msg.data)}
                </span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
