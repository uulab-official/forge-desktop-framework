export interface SettingsField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle';
  options?: { label: string; value: string }[];
  description?: string;
}

export interface SettingsFormProps {
  fields: SettingsField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function SettingsForm({ fields, values, onChange }: SettingsFormProps) {
  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium mb-1">{field.label}</label>
          {field.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{field.description}</p>
          )}

          {field.type === 'text' && (
            <input
              type="text"
              value={(values[field.key] as string) ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              value={(values[field.key] as number) ?? 0}
              onChange={(e) => onChange(field.key, Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          )}

          {field.type === 'select' && (
            <select
              value={(values[field.key] as string) ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {field.type === 'toggle' && (
            <button
              onClick={() => onChange(field.key, !values[field.key])}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                values[field.key]
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  values[field.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
