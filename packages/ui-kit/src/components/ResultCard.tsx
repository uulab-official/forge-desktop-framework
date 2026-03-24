import type { ReactNode } from 'react';

export interface ResultCardProps {
  title: string;
  description?: string;
  thumbnail?: string;
  metadata?: string;
  actions?: ReactNode;
}

export function ResultCard({ title, description, thumbnail, metadata, actions }: ResultCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {thumbnail && (
        <div className="aspect-video bg-gray-100 dark:bg-gray-700">
          <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <h4 className="font-medium text-sm truncate">{title}</h4>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {description}
          </p>
        )}
        {metadata && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{metadata}</p>
        )}
        {actions && <div className="mt-3 flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
