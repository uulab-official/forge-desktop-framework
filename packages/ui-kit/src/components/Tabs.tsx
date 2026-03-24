import type { ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({ tabs, activeId, onChange, variant = 'default' }: TabsProps) {
  const getTabClass = (tab: Tab) => {
    const isActive = tab.id === activeId;
    const base = 'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap';

    if (tab.disabled) {
      return `${base} text-gray-300 dark:text-gray-600 cursor-not-allowed`;
    }

    switch (variant) {
      case 'pills':
        return isActive
          ? `${base} bg-blue-600 text-white rounded-lg`
          : `${base} text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg`;

      case 'underline':
        return isActive
          ? `${base} text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400`
          : `${base} text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border-b-2 border-transparent`;

      default:
        return isActive
          ? `${base} bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg`
          : `${base} text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg`;
    }
  };

  const containerClass =
    variant === 'underline'
      ? 'flex items-center gap-0 border-b border-gray-200 dark:border-gray-700'
      : 'flex items-center gap-1';

  return (
    <div className={containerClass}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={getTabClass(tab)}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
