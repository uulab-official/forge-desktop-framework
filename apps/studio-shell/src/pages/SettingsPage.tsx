import { useState, useEffect, useCallback } from 'react';
import { SettingsForm, type SettingsField } from '@forge/ui-kit';
import { getAPI } from '../shared/lib/ipc';

const SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'language',
    label: 'Language',
    type: 'select',
    options: [
      { label: 'English', value: 'en' },
      { label: '한국어', value: 'ko' },
      { label: '日本語', value: 'ja' },
    ],
  },
  {
    key: 'theme',
    label: 'Theme',
    type: 'select',
    options: [
      { label: 'System', value: 'system' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
  },
  {
    key: 'workerTimeout',
    label: 'Worker Timeout (ms)',
    type: 'number',
    description: 'Maximum time to wait for a worker response',
  },
  {
    key: 'concurrency',
    label: 'Concurrency',
    type: 'number',
    description: 'Number of concurrent worker processes',
  },
];

export function SettingsPage() {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    getAPI().settings.get().then(setValues).catch(console.error);
  }, []);

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    getAPI().settings.set(key, value).catch(console.error);
  }, []);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <SettingsForm fields={SETTINGS_FIELDS} values={values} onChange={handleChange} />
    </div>
  );
}
