import { useState, useEffect, useCallback } from 'react';
import { getAPI } from '../shared/lib/ipc';

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: 'select' | 'number' | 'text';
  options?: { label: string; value: string }[];
}

const SETTINGS: SettingItem[] = [
  {
    key: 'theme',
    label: 'Appearance',
    description: 'Choose your preferred color scheme',
    type: 'select',
    options: [
      { label: 'System', value: 'system' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
  },
  {
    key: 'language',
    label: 'Language',
    description: 'Interface language',
    type: 'select',
    options: [
      { label: 'English', value: 'en' },
      { label: '한국어', value: 'ko' },
      { label: '日本語', value: 'ja' },
    ],
  },
  {
    key: 'workerTimeout',
    label: 'Worker Timeout',
    description: 'Maximum wait time for worker responses (milliseconds)',
    type: 'number',
  },
  {
    key: 'concurrency',
    label: 'Concurrency',
    description: 'Maximum number of concurrent worker processes',
    type: 'number',
  },
];

export function SettingsPage() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAPI().settings.get().then(setValues).catch(console.error);
  }, []);

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    getAPI().settings.set(key, value).catch(console.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Configure your app preferences
          </p>
        </div>
        {saved && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full font-medium animate-fade-in">
            Saved
          </span>
        )}
      </div>

      {/* Settings List */}
      <div className="space-y-1">
        {SETTINGS.map((setting, i) => (
          <div key={setting.key}>
            <div className="flex items-center justify-between py-4">
              <div className="flex-1 pr-8">
                <h3 className="text-sm font-medium">{setting.label}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {setting.description}
                </p>
              </div>
              <div className="flex-shrink-0 w-44">
                {setting.type === 'select' && (
                  <select
                    value={(values[setting.key] as string) ?? ''}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-shadow appearance-none cursor-pointer"
                  >
                    {setting.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
                {setting.type === 'number' && (
                  <input
                    type="number"
                    value={(values[setting.key] as number) ?? 0}
                    onChange={(e) => handleChange(setting.key, Number(e.target.value))}
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-shadow"
                  />
                )}
                {setting.type === 'text' && (
                  <input
                    type="text"
                    value={(values[setting.key] as string) ?? ''}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-shadow"
                  />
                )}
              </div>
            </div>
            {i < SETTINGS.length - 1 && (
              <div className="border-b border-zinc-100 dark:border-zinc-800" />
            )}
          </div>
        ))}
      </div>

      {/* About */}
      <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <div>
            <p className="text-sm font-semibold">Forge Desktop Framework</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">v0.1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
