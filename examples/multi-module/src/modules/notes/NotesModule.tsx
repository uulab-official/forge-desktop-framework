import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'forge-multi-module:notes';

export function NotesModule() {
  const [text, setText] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setText(saved);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    localStorage.setItem(STORAGE_KEY, value);
  }, []);

  const charCount = text.length;
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Notes</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Quick scratchpad. Auto-saved to local storage.
        </p>
      </div>

      <textarea
        className="flex-1 w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        placeholder="Start typing your notes..."
        value={text}
        onChange={handleChange}
      />

      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{charCount} character{charCount !== 1 ? 's' : ''}</span>
        <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
