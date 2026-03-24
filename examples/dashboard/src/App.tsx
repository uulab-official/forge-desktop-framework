import { useState, useCallback } from 'react';
import { StatCard } from './components/StatCard';
import { BarChart } from './components/BarChart';
import { DataTable } from './components/DataTable';

declare global {
  interface Window {
    api: {
      execute: (request: { action: string; payload?: Record<string, unknown> }) => Promise<{
        success: boolean;
        data: Record<string, unknown> | null;
        error: string | null;
      }>;
    };
  }
}

interface SalesRecord {
  id: number;
  date: string;
  category: string;
  amount: number;
  quantity: number;
}

interface AnalysisResult {
  total_sales: number;
  avg_order: number;
  total_orders: number;
  by_category: { category: string; total: number; count: number; avg: number }[];
  top_category: string;
  histogram: { range: string; count: number }[];
}

const TABLE_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'date', label: 'Date' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount ($)' },
  { key: 'quantity', label: 'Qty' },
];

export function App() {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [displayRows, setDisplayRows] = useState<SalesRecord[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string>('id');
  const [sortDesc, setSortDesc] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const generateData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.execute({
        action: 'generate_data',
        payload: { count: 100 },
      });
      if (res.success && res.data) {
        const newRecords = res.data.records as SalesRecord[];
        setRecords(newRecords);
        setDisplayRows(newRecords);
        setAnalysis(null);
        setFilterCategory('');
        setSortKey('id');
        setSortDesc(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeData = useCallback(async () => {
    if (records.length === 0) return;
    setLoading(true);
    try {
      const res = await window.api.execute({
        action: 'analyze',
        payload: { records },
      });
      if (res.success && res.data) {
        setAnalysis(res.data as unknown as AnalysisResult);
      }
    } finally {
      setLoading(false);
    }
  }, [records]);

  const handleSort = useCallback(
    async (key: string) => {
      const desc = sortKey === key ? !sortDesc : false;
      setSortKey(key);
      setSortDesc(desc);

      const res = await window.api.execute({
        action: 'filter_data',
        payload: {
          records,
          category: filterCategory || undefined,
          sort_by: key,
          sort_desc: desc,
        },
      });
      if (res.success && res.data) {
        setDisplayRows(res.data.records as SalesRecord[]);
      }
    },
    [records, sortKey, sortDesc, filterCategory],
  );

  const handleFilter = useCallback(
    async (category: string) => {
      setFilterCategory(category);

      const res = await window.api.execute({
        action: 'filter_data',
        payload: {
          records,
          category: category || undefined,
          sort_by: sortKey,
          sort_desc: sortDesc,
        },
      });
      if (res.success && res.data) {
        setDisplayRows(res.data.records as SalesRecord[]);
      }
    },
    [records, sortKey, sortDesc],
  );

  const categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Sports'];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Sales Dashboard
        </h1>
        <div className="flex gap-3">
          <button
            onClick={generateData}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Working...' : 'Generate Data'}
          </button>
          <button
            onClick={analyzeData}
            disabled={loading || records.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            Analyze
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Sales"
          value={analysis ? `$${analysis.total_sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--'}
          subtitle={analysis ? `across ${analysis.total_orders} orders` : undefined}
          color="text-blue-600"
        />
        <StatCard
          label="Avg Order"
          value={analysis ? `$${analysis.avg_order.toFixed(2)}` : '--'}
          subtitle="per transaction"
          color="text-emerald-600"
        />
        <StatCard
          label="Total Orders"
          value={analysis ? analysis.total_orders.toLocaleString() : '--'}
          subtitle="generated records"
          color="text-purple-600"
        />
        <StatCard
          label="Top Category"
          value={analysis?.top_category ?? '--'}
          subtitle={
            analysis
              ? `$${analysis.by_category.find((c) => c.category === analysis.top_category)?.total.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'} total`
              : undefined
          }
          color="text-orange-600"
        />
      </div>

      {/* Bar Chart */}
      {analysis && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Sales by Category
          </h2>
          <BarChart
            data={analysis.by_category.map((c) => ({
              label: c.category,
              value: c.total,
            }))}
            height={260}
            color="#3b82f6"
          />
        </div>
      )}

      {/* Filter + Data Table */}
      {records.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Sales Records
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({displayRows.length} of {records.length})
              </span>
            </h2>
            <select
              value={filterCategory}
              onChange={(e) => handleFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <DataTable
            columns={TABLE_COLUMNS}
            rows={displayRows.map((r) => ({
              ...r,
              amount: `$${r.amount.toFixed(2)}`,
            }))}
            onSort={handleSort}
            sortKey={sortKey}
            sortDesc={sortDesc}
          />
        </div>
      )}

      {records.length === 0 && !loading && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Click "Generate Data" to start</p>
        </div>
      )}
    </div>
  );
}
