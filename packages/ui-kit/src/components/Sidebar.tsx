import type { ReactNode } from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface SidebarProps {
  title: string;
  items: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  footer?: ReactNode;
}

export function Sidebar({ title, items, activeId, onSelect, footer }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 font-semibold text-lg border-b border-gray-200 dark:border-gray-700">
        {title}
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
              activeId === item.id
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>
      {footer && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">{footer}</div>
      )}
    </div>
  );
}
