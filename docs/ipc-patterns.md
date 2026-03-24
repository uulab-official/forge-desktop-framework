# IPC Communication Patterns

This document describes the IPC communication patterns available in forge-desktop-framework.

## Basic Request/Response

The simplest pattern. Renderer sends a request, waits for a response.

```
Renderer                    Main                     Python Worker
   │                         │                            │
   ├─invoke('worker:execute')→│                            │
   │                         ├──spawn + stdin JSON────────→│
   │                         │                            ├─process
   │                         │←────stdout JSON────────────┤
   │←───────response─────────┤                            │
```

### Renderer (React)
```typescript
const response = await window.electronAPI.worker.execute({
  action: 'health_check',
  payload: {},
});
```

### Electron Main
```typescript
ipcMain.handle('worker:execute', async (_event, request) => {
  return workerClient.execute(request);
});
```

### Python Worker
```python
@register("health_check")
def handle(payload):
    return {"status": "ok"}
```

---

## Progress Streaming

For long-running tasks, stream progress updates back to the renderer.

```
Renderer                    Main                     Python Worker
   │                         │                            │
   ├──invoke('job:submit')──→│                            │
   │                         ├──spawn + stdin JSON────────→│
   │                         │                            ├─processing...
   │                         │←──{"progress": {cur, tot}}─┤
   │←──send('job:update')────┤                            │
   │                         │←──{"progress": {cur, tot}}─┤
   │←──send('job:update')────┤                            │
   │                         │←──{"success": true, ...}───┤
   │←──send('job:update')────┤                            │
```

### Python Worker (with progress)
```python
@register("batch_process")
def handle(payload):
    files = payload["files"]
    for i, f in enumerate(files):
        write_progress(i + 1, len(files), f"Processing {f}")
        process_file(f)
    return {"processed": len(files)}
```

### Renderer (listening for updates)
```typescript
// Submit job
const jobId = await window.electronAPI.job.submit('batch_process', { files });

// Listen for updates
window.electronAPI.job.onUpdate((job) => {
  if (job.id === jobId) {
    setProgress(job.progress);
    if (job.status === 'success') setResult(job.result);
  }
});
```

---

## Event Forwarding (Main → Renderer)

Electron main can push events to renderer without a request.

```
Renderer                    Main
   │                         │
   │                         ├─ (something happens in main)
   │←─send('log:entry')─────┤
   │←─send('update:status')─┤
```

### Electron Main
```typescript
// Forward log entries
onLogEntry((entry) => {
  mainWindow?.webContents.send(IPC_CHANNELS.LOG_ENTRY, entry);
});
```

### Renderer
```typescript
window.electronAPI.log.onEntry((entry) => {
  addToLogConsole(entry);
});
```

---

## Dialog Pattern

Electron main can open native OS dialogs.

```
Renderer                    Main                       OS
   │                         │                          │
   ├─invoke('dialog:open')──→│                          │
   │                         ├──showOpenDialog()───────→│
   │                         │                          ├─user picks file
   │                         │←──────filePaths──────────┤
   │←──────response──────────┤                          │
```

### Electron Main
```typescript
ipcMain.handle('dialog:open-file', async (_event, filters) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: filters ?? [{ name: 'All', extensions: ['*'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});
```

---

## Real-time Bidirectional (WebSocket/DataChannel Pattern)

For chat, streaming, or live data.

```
Renderer                    Main                     Python Worker
   │                         │                            │
   ├─invoke('chat:send')────→│                            │
   │                         ├──stdin JSON───────────────→│
   │                         │                            ├─generating...
   │                         │←──stdout (token 1)─────────┤
   │←─send('chat:token')────┤                            │
   │                         │←──stdout (token 2)─────────┤
   │←─send('chat:token')────┤                            │
   │                         │←──stdout (done)────────────┤
   │←─send('chat:done')─────┤                            │
```

### Python Worker (streaming tokens)
```python
@register("chat_respond")
def handle(payload):
    message = payload["message"]
    for word in generate_response(message):
        write_progress(0, 0, word)  # Use progress as token stream
    return {"complete": True}
```

---

## Channel Constants

All IPC channels are defined in `packages/ipc-contract/src/channels.ts`:

```typescript
export const IPC_CHANNELS = {
  WORKER_EXECUTE: 'worker:execute',
  WORKER_CANCEL: 'worker:cancel',
  WORKER_PROGRESS: 'worker:progress',
  JOB_SUBMIT: 'job:submit',
  JOB_CANCEL: 'job:cancel',
  JOB_STATUS: 'job:status',
  JOB_LIST: 'job:list',
  JOB_UPDATE: 'job:update',
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_SAVE: 'project:save',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  LOG_ENTRY: 'log:entry',
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',
};
```

## Best Practices

1. **Always use typed channels** — import from `@forge/ipc-contract`
2. **Python stdout = protocol only** — all logging to stderr
3. **Use job engine for long tasks** — provides queue, progress, cancellation
4. **Keep payloads serializable** — JSON-compatible types only
5. **Handle errors in main process** — map to user-friendly messages via `@forge/error-handler`
6. **Dispose worker on quit** — prevent orphan Python processes
