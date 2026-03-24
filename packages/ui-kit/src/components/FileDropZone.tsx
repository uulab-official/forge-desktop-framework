import { useState, useCallback, type DragEvent, type ReactNode } from 'react';

export interface FileDropZoneProps {
  accept?: string[];
  onDrop: (files: File[]) => void;
  children?: ReactNode;
  className?: string;
}

export function FileDropZone({ accept, onDrop, children, className = '' }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (accept && accept.length > 0) {
        const filtered = files.filter((f) =>
          accept.some((ext) => f.name.toLowerCase().endsWith(ext.toLowerCase())),
        );
        onDrop(filtered);
      } else {
        onDrop(files);
      }
    },
    [accept, onDrop],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
      } ${className}`}
    >
      {children ?? (
        <p className="text-gray-500 dark:text-gray-400">
          Drop files here
        </p>
      )}
    </div>
  );
}
