# File Processor Example

Demonstrates batch file processing using the Forge Desktop Framework's drag-and-drop, job queue, and progress tracking capabilities.

## Architecture

```
Renderer (React)          Main Process (Electron)         Python Worker
─────────────────         ─────────────────────────       ──────────────
FileDropZone              ipcMain handlers                process_file
  ↓ onDrop                  ↓                             batch_rename
job.submit() ──IPC──→ jobEngine.submit()
                            ↓
                       workerClient.execute() ──stdin──→ dispatch()
                            ↓                              ↓
job.onUpdate() ←─IPC─ jobEngine.onJobUpdate()  ←stdout── write_success()
  ↓
ProgressPanel
ResultsTable
```

## How It Works

1. **Drag & Drop**: Users drop files onto the `FileDropZone` component from `@forge/ui-kit`.
2. **Job Submission**: Each dropped file triggers a `job.submit("process_file", { path, name })` call via the IPC bridge.
3. **Job Engine**: The main process `jobEngine` queues each job and forwards it to the Python worker via `workerClient`.
4. **Python Worker**: The `process_file` action reads file stats (size, extension) and, for text files, computes line/word/character counts.
5. **Progress Tracking**: The `ProgressPanel` component shows active jobs with real-time status updates forwarded from the main process.
6. **Results Display**: Completed jobs are displayed in a results table showing file metadata and text statistics.

## Python Actions

### `process_file`

Analyzes a single file and returns:
- `size` — file size in bytes
- `extension` — file extension
- `is_text` — whether the file is a text file
- `line_count`, `word_count`, `char_count` — text statistics (text files only)

### `batch_rename`

Dry-run batch rename that generates new file names with a prefix and sequential numbering. Does **not** actually rename files on disk.

Input: `{ "files": [...paths], "prefix": "photo", "start_num": 1 }`
Output: `{ "renamed": [{ "original": "img.jpg", "new_name": "photo_0001.jpg" }], "dry_run": true }`

## Running

```bash
# From the repository root
pnpm install
pnpm --filter @forge-example/file-processor dev
```

## Key Patterns Demonstrated

- **FileDropZone + Job Engine integration**: Connecting UI drag-and-drop to the backend job queue
- **Per-file job tracking**: Each file becomes an independent job with its own lifecycle
- **ProgressPanel**: Real-time visualization of job status via IPC event forwarding
- **Python worker actions**: Stateless action handlers registered with the `@register` decorator
