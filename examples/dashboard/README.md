# Dashboard Example

A sales dashboard demonstrating complex IPC payloads, multiple sequential worker
calls, and custom SVG-based data visualization with no external chart libraries.

## What This Demonstrates

- **Complex IPC payloads** — The renderer sends and receives large structured
  objects (arrays of 100+ records, nested statistics) through the Forge IPC
  protocol without any special serialization.
- **Multiple worker actions** — Three distinct Python actions (`generate_data`,
  `analyze`, `filter_data`) are registered and dispatched through a single
  worker process, showing how to organize a multi-action worker.
- **Custom SVG charts** — The `BarChart` component renders a horizontal bar
  chart as pure SVG with no dependency on chart libraries (no Chart.js,
  Recharts, etc.). This keeps the bundle small and avoids native module issues
  in Electron.
- **Server-side filtering and sorting** — Instead of sorting in the renderer,
  the `filter_data` action handles filtering, sorting, and pagination in
  Python, demonstrating offloading work to the worker process.

## Project Structure

```
examples/dashboard/
├── electron/          # Electron main + preload
├── src/
│   ├── components/
│   │   ├── StatCard.tsx    # KPI stat card
│   │   ├── BarChart.tsx    # Pure SVG horizontal bar chart
│   │   └── DataTable.tsx   # Sortable data table
│   ├── App.tsx             # Dashboard layout
│   ├── main.tsx            # React entry
│   └── globals.css         # Tailwind import
├── python/worker/
│   ├── core/               # Protocol + dispatcher (from framework)
│   ├── actions/
│   │   ├── generate_data.py  # Random sales data generator
│   │   ├── analyze.py        # Statistics & category breakdown
│   │   └── filter_data.py    # Filter, sort, paginate
│   └── main.py              # Worker entry point
└── README.md
```

## Running

```bash
pnpm install
pnpm dev
```

Click **Generate Data** to create 100 random sales records, then **Analyze** to
compute statistics and render the bar chart. Use the category dropdown and
column headers to filter and sort via the Python worker.
