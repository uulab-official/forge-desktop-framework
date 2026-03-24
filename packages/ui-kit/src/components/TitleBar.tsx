import type { ReactNode } from 'react';

export interface TitleBarProps {
  title?: string;
  children?: ReactNode;
  draggable?: boolean;
  showTrafficLights?: boolean;
  actions?: ReactNode;
}

export function TitleBar({
  title,
  children,
  draggable = true,
  showTrafficLights = false,
  actions,
}: TitleBarProps) {
  return (
    <div
      className="flex items-center w-full h-[38px] min-h-[38px] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 select-none"
      style={draggable ? { WebkitAppRegion: 'drag' } as React.CSSProperties : undefined}
    >
      {showTrafficLights && <div className="w-[70px] shrink-0" />}

      <div className="flex-1 flex items-center justify-center min-w-0">
        {title && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {title}
          </span>
        )}
        {children}
      </div>

      {actions && (
        <div
          className="flex items-center gap-1 px-2 shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
