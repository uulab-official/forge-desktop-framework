interface StatCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
}

export function StatCard({ label, value, unit }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
        {value !== null && value !== undefined ? (
          <>
            {value}
            {unit && (
              <span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">
                {unit}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">--</span>
        )}
      </p>
    </div>
  );
}
