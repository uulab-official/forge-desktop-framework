import type { ReactNode } from 'react';

export interface AppLayoutProps {
  sidebar?: ReactNode;
  children: ReactNode;
  bottomPanel?: ReactNode;
}

export function AppLayout({ sidebar, children, bottomPanel }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {sidebar && (
        <aside className="flex-shrink-0 w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {sidebar}
        </aside>
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        {bottomPanel && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
            {bottomPanel}
          </div>
        )}
      </div>
    </div>
  );
}
