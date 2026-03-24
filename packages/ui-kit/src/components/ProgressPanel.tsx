export interface ProgressItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled';
  progress?: { current: number; total: number; message?: string };
}

export interface ProgressPanelProps {
  items: ProgressItem[];
  onCancel?: (id: string) => void;
}

const STATUS_COLORS = {
  pending: 'bg-gray-400',
  running: 'bg-blue-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
  canceled: 'bg-yellow-500',
};

export function ProgressPanel({ items, onCancel }: ProgressPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Tasks</h3>
      {items.map((item) => {
        const pct =
          item.progress && item.progress.total > 0
            ? Math.round((item.progress.current / item.progress.total) * 100)
            : 0;

        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status]}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.progress?.message && (
                  <span className="text-xs text-gray-500">{item.progress.message}</span>
                )}
                {item.status === 'running' && onCancel && (
                  <button
                    onClick={() => onCancel(item.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            {item.status === 'running' && item.progress && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
