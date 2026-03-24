import { useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

export interface ToastContainerProps {
  toasts: ToastProps[];
  position?: 'top-right' | 'bottom-right' | 'bottom-center';
}

const borderColorMap: Record<ToastType, string> = {
  info: 'border-l-blue-500',
  success: 'border-l-green-500',
  warning: 'border-l-yellow-500',
  error: 'border-l-red-500',
};

const iconColorMap: Record<ToastType, string> = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
};

const iconPathMap: Record<ToastType, string> = {
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
  success: 'M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z',
  warning: 'M12 9v4m0 4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
  error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
};

function Toast({ id, type, message, duration = 5000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (duration <= 0) return;

    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 w-80 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 ${borderColorMap[type]} animate-[slideIn_200ms_ease-out]`}
    >
      <svg
        className={`w-5 h-5 shrink-0 mt-0.5 ${iconColorMap[type]}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPathMap[type]} />
      </svg>

      <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">{message}</p>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="2" x2="12" y2="12" />
          <line x1="12" y1="2" x2="2" y2="12" />
        </svg>
      </button>
    </div>
  );
}

const positionMap = {
  'top-right': 'top-4 right-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
} as const;

export function ToastContainer({ toasts, position = 'top-right' }: ToastContainerProps) {
  return (
    <div className={`fixed z-50 flex flex-col gap-2 ${positionMap[position]}`}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
