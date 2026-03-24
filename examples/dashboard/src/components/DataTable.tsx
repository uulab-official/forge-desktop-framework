interface DataTableProps {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDesc?: boolean;
}

export function DataTable({ columns, rows, onSort, sortKey, sortDesc }: DataTableProps) {
  return (
    <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort?.(col.key)}
                className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDesc ? '\u25BC' : '\u25B2'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-400"
              >
                No data available
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                    {String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
