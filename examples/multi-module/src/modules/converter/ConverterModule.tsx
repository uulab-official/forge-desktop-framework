import { useState, useCallback } from 'react';

interface ConversionResult {
  value: number;
  from: string;
  to: string;
  category: string;
}

const UNIT_CATEGORIES: Record<string, string[]> = {
  length: ['m', 'km', 'mi', 'ft'],
  weight: ['kg', 'lb', 'oz'],
  temperature: ['C', 'F', 'K'],
};

export function ConverterModule() {
  const [category, setCategory] = useState('length');
  const [fromUnit, setFromUnit] = useState('km');
  const [toUnit, setToUnit] = useState('mi');
  const [inputValue, setInputValue] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const units = UNIT_CATEGORIES[category] ?? [];

  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategory(newCategory);
    const newUnits = UNIT_CATEGORIES[newCategory] ?? [];
    setFromUnit(newUnits[0] ?? '');
    setToUnit(newUnits[1] ?? newUnits[0] ?? '');
    setResult(null);
    setError(null);
  }, []);

  const handleConvert = useCallback(async () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      setError('Please enter a valid number');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await window.api.execute({
        action: 'convert',
        payload: { value: numValue, from_unit: fromUnit, to_unit: toUnit },
      });

      if (response.success && response.data) {
        setResult(response.data as unknown as ConversionResult);
      } else {
        setError(response.error ?? 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute');
    } finally {
      setLoading(false);
    }
  }, [inputValue, fromUnit, toUnit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleConvert();
    },
    [handleConvert],
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Unit Converter</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Convert between units using the Python worker.
        </p>
      </div>

      <div className="flex gap-2">
        {Object.keys(UNIT_CATEGORIES).map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              category === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          className="w-32 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder="Value"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        <select
          value={fromUnit}
          onChange={e => setFromUnit(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {units.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        <span className="text-gray-400 font-medium">to</span>

        <select
          value={toUnit}
          onChange={e => setToUnit(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {units.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        <button
          onClick={handleConvert}
          disabled={loading || !inputValue.trim()}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : 'Convert'}
        </button>
      </div>

      {result && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="text-sm text-green-600 dark:text-green-400 mb-1 capitalize">
            {result.category}
          </div>
          <div className="text-lg font-mono font-semibold text-green-800 dark:text-green-200">
            {result.from} = {result.to}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <span className="text-sm text-red-600 dark:text-red-400">Error:</span>
          <span className="ml-2 text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}
    </div>
  );
}
