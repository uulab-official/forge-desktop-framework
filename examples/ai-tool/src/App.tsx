import { useState } from 'react';

declare global {
  interface Window {
    api: {
      execute: (req: { action: string; payload: Record<string, unknown> }) => Promise<any>;
    };
  }
}

type Action = 'sentiment' | 'summarize' | 'classify';

const ACTION_LABELS: Record<Action, string> = {
  sentiment: 'Sentiment Analysis',
  summarize: 'Text Summarization',
  classify: 'Text Classification',
};

const ACTION_DESCRIPTIONS: Record<Action, string> = {
  sentiment: 'Analyze the emotional tone of the text using keyword matching.',
  summarize: 'Extract the most important sentences using word frequency scoring.',
  classify: 'Categorize the text into predefined topics using keyword rules.',
};

export function App() {
  const [input, setInput] = useState('');
  const [action, setAction] = useState<Action>('sentiment');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await window.api.execute({
        action,
        payload: { text: input },
      });
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Forge AI Tool
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Local AI/ML integration patterns with lightweight Python implementations.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as Action)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {(Object.keys(ACTION_LABELS) as Action[]).map((key) => (
                <option key={key} value={key}>
                  {ACTION_LABELS[key]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {ACTION_DESCRIPTIONS[action]}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Input Text
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Enter text to analyze..."
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Results
            </h2>
            <ResultDisplay action={action} data={result} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultDisplay({ action, data }: { action: Action; data: any }) {
  if (action === 'sentiment') {
    const labelColor =
      data.label === 'positive'
        ? 'text-green-600 dark:text-green-400'
        : data.label === 'negative'
          ? 'text-red-600 dark:text-red-400'
          : 'text-gray-600 dark:text-gray-400';

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold capitalize ${labelColor}`}>
            {data.label}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            score: {(data.score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
          <span>Positive matches: <strong>{data.positive_count}</strong></span>
          <span>Negative matches: <strong>{data.negative_count}</strong></span>
        </div>
        {data.details && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {data.details.positive_words_found.length > 0 && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 mb-1">Positive words found:</p>
                <div className="flex flex-wrap gap-1">
                  {data.details.positive_words_found.map((w: string) => (
                    <span key={w} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.details.negative_words_found.length > 0 && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 mb-1">Negative words found:</p>
                <div className="flex flex-wrap gap-1">
                  {data.details.negative_words_found.map((w: string) => (
                    <span key={w} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (action === 'summarize') {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span>Condensed <strong>{data.sentence_count}</strong> sentences into <strong>{data.summary_sentence_count}</strong></span>
        </div>
        <blockquote className="pl-4 border-l-2 border-blue-400 text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
          {data.summary}
        </blockquote>
      </div>
    );
  }

  if (action === 'classify') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
            {data.category}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            confidence: {(data.confidence * 100).toFixed(0)}%
          </span>
        </div>
        {data.matched_keywords.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Matched keywords:</p>
            <div className="flex flex-wrap gap-1">
              {data.matched_keywords.map((w: string) => (
                <span key={w} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
}
