interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}

export function StatCard({ label, value, subtitle, color = 'text-blue-600' }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}
