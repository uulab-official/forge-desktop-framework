import { useRef, useEffect } from 'react';

interface HeatmapCanvasProps {
  data: number[];
  width: number;
  height: number;
  cellSize?: number;
}

function valueToColor(value: number, min: number, max: number): string {
  const range = max - min || 1;
  const t = Math.max(0, Math.min(1, (value - min) / range));

  // Blue -> Green -> Yellow -> Red gradient
  let r: number, g: number, b: number;
  if (t < 0.25) {
    const s = t / 0.25;
    r = 0;
    g = Math.round(s * 255);
    b = 255;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = Math.round((1 - s) * 255);
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    r = Math.round(s * 255);
    g = 255;
    b = 0;
  } else {
    const s = (t - 0.75) / 0.25;
    r = 255;
    g = Math.round((1 - s) * 255);
    b = 0;
  }

  return `rgb(${r},${g},${b})`;
}

export function HeatmapCanvas({
  data,
  width,
  height,
  cellSize = 6,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = Math.floor(canvas.width / cellSize);
    const rows = Math.floor(canvas.height / cellSize);
    const visibleCount = Math.min(data.length, cols * rows);

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < visibleCount; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < visibleCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      ctx.fillStyle = valueToColor(data[i], min, max);
      ctx.fillRect(col * cellSize, row * cellSize, cellSize - 1, cellSize - 1);
    }
  }, [data, cellSize]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg border border-gray-200 dark:border-gray-700"
    />
  );
}
