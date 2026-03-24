interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

export function BarChart({ data, height = 300, color = '#3b82f6' }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        No data
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barHeight = 32;
  const labelWidth = 100;
  const valueWidth = 80;
  const chartPadding = 16;
  const gap = 8;
  const svgHeight = Math.max(height, data.length * (barHeight + gap) + chartPadding * 2);
  const chartWidth = 600;
  const barAreaWidth = chartWidth - labelWidth - valueWidth - chartPadding * 2;

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${svgHeight}`}
      className="w-full"
      style={{ maxHeight: height, overflow: 'visible' }}
    >
      {data.map((item, i) => {
        const y = chartPadding + i * (barHeight + gap);
        const barWidth = (item.value / maxValue) * barAreaWidth;

        return (
          <g key={item.label}>
            {/* Label */}
            <text
              x={labelWidth - 8}
              y={y + barHeight / 2}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-gray-600 dark:fill-gray-300"
              fontSize={13}
              fontWeight={500}
            >
              {item.label}
            </text>

            {/* Background track */}
            <rect
              x={labelWidth}
              y={y}
              width={barAreaWidth}
              height={barHeight}
              rx={6}
              fill="currentColor"
              className="text-gray-100 dark:text-gray-700"
            />

            {/* Bar */}
            <rect
              x={labelWidth}
              y={y}
              width={Math.max(barWidth, 4)}
              height={barHeight}
              rx={6}
              fill={color}
              opacity={0.85}
            />

            {/* Value */}
            <text
              x={labelWidth + barAreaWidth + 8}
              y={y + barHeight / 2}
              dominantBaseline="central"
              className="fill-gray-700 dark:fill-gray-200"
              fontSize={13}
              fontWeight={600}
            >
              ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
