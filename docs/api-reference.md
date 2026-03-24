# API Reference

## Python: forge-worker-runtime

```bash
pip install -e packages/worker-runtime
```

### register(action_name)

Decorator to register a worker action.

```python
from forge_worker import register

@register("my_action")
def handle(payload: dict) -> dict | None:
    return {"result": "value"}
```

- `payload` — dict from the JSON request's `payload` field
- Return a dict (becomes `response.data`) or `None`
- Raise an exception to return an error response

### run_worker()

Starts the standard stdin/stdout loop. Call after importing all actions.

```python
import actions  # registers all @register'd handlers
from forge_worker import run_worker
run_worker()
```

### write_progress(current, total, message?)

Send a progress update mid-task.

```python
from forge_worker import register, write_progress

@register("batch")
def handle(payload):
    items = payload["items"]
    for i, item in enumerate(items):
        write_progress(i + 1, len(items), f"Processing {item}")
        process(item)
    return {"processed": len(items)}
```

### log(message)

Write to stderr (not stdout). Safe for debugging.

```python
from forge_worker import log
log("This goes to stderr and won't corrupt the JSON protocol")
```

---

## TypeScript: @forge/ipc-contract

### Types

```typescript
import type {
  WorkerRequest,    // { action: string, payload: Record<string, unknown>, jobId?: string }
  WorkerResponse,   // { success: boolean, data: Record<string, unknown> | null, error: string | null }
  WorkerProgress,   // { progress: { current: number, total: number, message?: string } }
  JobDefinition,    // { id, action, payload, status, progress?, createdAt, ... }
  JobStatus,        // 'pending' | 'running' | 'success' | 'failed' | 'canceled'
  ProjectMeta,      // { name, version, createdAt, updatedAt, settings }
  AppSettings,      // { outputDir, language, theme, workerTimeout, concurrency }
} from '@forge/ipc-contract';
```

### Constants

```typescript
import { IPC_CHANNELS } from '@forge/ipc-contract';

IPC_CHANNELS.WORKER_EXECUTE   // 'worker:execute'
IPC_CHANNELS.JOB_SUBMIT       // 'job:submit'
IPC_CHANNELS.JOB_UPDATE       // 'job:update'
IPC_CHANNELS.SETTINGS_GET     // 'settings:get'
IPC_CHANNELS.LOG_ENTRY        // 'log:entry'
IPC_CHANNELS.UPDATE_CHECK     // 'update:check'
// ... see source for full list
```

### Type Guards

```typescript
import { isWorkerResponse, isWorkerProgress, isWorkerReady } from '@forge/ipc-contract';

if (isWorkerResponse(msg)) { /* msg.success, msg.data, msg.error */ }
if (isWorkerProgress(msg)) { /* msg.progress.current, msg.progress.total */ }
if (isWorkerReady(msg))    { /* worker is ready to receive requests */ }
```

---

## TypeScript: @forge/worker-client

### createWorkerClient(options)

```typescript
import { createWorkerClient } from '@forge/worker-client';

const client = createWorkerClient({
  workerPath: '/path/to/main.py',   // or forge-worker executable
  pythonPath: 'python3',             // Python interpreter (dev mode)
  isDev: true,                       // dev: spawn python3, prod: spawn executable
  timeout: 300_000,                  // 5 min default
});

// Simple execution
const response = await client.execute({ action: 'health_check', payload: {} });

// With progress
const response = await client.executeWithProgress(
  { action: 'batch', payload: { items: [...] } },
  (progress) => console.log(`${progress.current}/${progress.total}`),
);

// Cancel running request
client.cancel();

// Cleanup
client.dispose();
```

---

## TypeScript: @forge/job-engine

### createJobEngine(workerClient, options?)

```typescript
import { createJobEngine } from '@forge/job-engine';

const engine = createJobEngine(workerClient, { concurrency: 1 });

// Submit a job
const jobId = engine.submit('process_file', { path: '/file.txt' });

// Listen for updates
const unsub = engine.onJobUpdate((job) => {
  console.log(job.id, job.status, job.progress);
});

// Get job info
const job = engine.getJob(jobId);
const allJobs = engine.getAllJobs();

// Cancel
engine.cancel(jobId);

// Cleanup
engine.dispose();
```

---

## TypeScript: @forge/logger

### createLogger(source)

```typescript
import { createLogger, onLogEntry, getLogHistory } from '@forge/logger';

const log = createLogger('my-module');
log.debug('verbose info', { extra: 'data' });
log.info('operation started');
log.warn('something unexpected');
log.error('failed', new Error('details'));

// Listen for all log entries
const unsub = onLogEntry((entry) => {
  // entry: { timestamp, level, source, message, data? }
});

// Get history
const recent = getLogHistory({ source: 'my-module', limit: 50 });
```

---

## TypeScript: @forge/plugin-system

### createPluginRegistry()

```typescript
import { createPluginRegistry } from '@forge/plugin-system';

const registry = createPluginRegistry();

registry.register({
  id: 'my-feature',
  name: 'My Feature',
  version: '1.0.0',
  routes: [{ path: '/my-feature', label: 'My Feature' }],
  workerActions: ['my_action'],
  onActivate: (ctx) => { ctx.logger.info('Plugin loaded'); },
});

registry.getAll();           // all plugins
registry.getById('my-feature');
registry.getRoutes();        // all routes from all plugins
registry.getWorkerActions(); // all worker actions
registry.activateAll(ctx);   // lifecycle
```

---

## TypeScript: @forge/error-handler

### createErrorMapper()

```typescript
import { createErrorMapper } from '@forge/error-handler';

const mapper = createErrorMapper();

const friendly = mapper.map('FileNotFoundError: /path/to/file');
// { message: "The specified file could not be found.",
//   suggestion: "Check that the file path is correct.",
//   original: "FileNotFoundError: /path/to/file" }

// Add custom mappings
mapper.addMapping({
  pattern: /CUDA out of memory/,
  message: 'GPU memory full.',
  suggestion: 'Try a smaller model or reduce batch size.',
});
```

### ForgeErrorBoundary

```tsx
import { ForgeErrorBoundary } from '@forge/error-handler';

<ForgeErrorBoundary>
  <App />
</ForgeErrorBoundary>

// Custom fallback
<ForgeErrorBoundary fallback={(error, reset) => (
  <div>
    <p>Error: {error.message}</p>
    <button onClick={reset}>Retry</button>
  </div>
)}>
  <App />
</ForgeErrorBoundary>
```

---

## TypeScript: @forge/ui-kit

18 components, all React + Tailwind, dark mode supported.

### Layout

```tsx
import { AppLayout, Sidebar, TitleBar, Tabs } from '@forge/ui-kit';

<AppLayout sidebar={<Sidebar ... />} bottomPanel={...}>
  <main>...</main>
</AppLayout>

<TitleBar title="My App" showTrafficLights actions={<button>X</button>} />

<Tabs
  tabs={[{ id: 'a', label: 'Tab A' }, { id: 'b', label: 'Tab B' }]}
  activeId="a"
  onChange={setTab}
  variant="underline"  // 'default' | 'pills' | 'underline'
/>
```

### Feedback

```tsx
import { Modal, Toast, ToastContainer, Badge, Tooltip } from '@forge/ui-kit';

<Modal open={isOpen} onClose={() => setOpen(false)} title="Confirm" size="md">
  <p>Are you sure?</p>
</Modal>

<Badge variant="success" size="sm">Online</Badge>
// variants: default, success, warning, error, info

<Tooltip content="Extra info" position="top">
  <button>Hover me</button>
</Tooltip>
```

### Data

```tsx
import { ProgressPanel, LogConsole, FileDropZone, ResultCard, EmptyState } from '@forge/ui-kit';

<ProgressPanel items={jobs} onCancel={cancelJob} />
<LogConsole logs={logEntries} maxHeight={200} />
<FileDropZone accept={['.mp4', '.mov']} onDrop={handleFiles} />
<EmptyState title="No results" action={{ label: "Create", onClick: create }} />
```

### Settings

```tsx
import { SettingsForm } from '@forge/ui-kit';

<SettingsForm
  fields={[
    { key: 'theme', label: 'Theme', type: 'select', options: [...] },
    { key: 'timeout', label: 'Timeout', type: 'number' },
  ]}
  values={settings}
  onChange={(key, value) => updateSetting(key, value)}
/>
```
