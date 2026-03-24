# Video Tools Example

Demonstrates **external binary integration** (ffmpeg/ffprobe) and **resource-manager** usage in the Forge Desktop Framework.

## What This Shows

- Calling external CLI tools (ffmpeg, ffprobe) from a Python worker via `subprocess`
- Graceful degradation when binaries are not installed
- Using `resource-manager` to resolve binary paths in dev vs production
- File dialog integration via Electron's `dialog` module
- A tabbed UI for multiple video operations

## Prerequisites

Install ffmpeg for full functionality:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows — download from https://ffmpeg.org/download.html
```

The example works without ffmpeg installed — it falls back to basic `os.path` file info and returns helpful error messages.

## Running

```bash
pnpm dev
```

## External Binary Integration Pattern

The key pattern for integrating external binaries:

1. **Try the binary via subprocess** — wrap in try/except `FileNotFoundError`
2. **Fall back gracefully** — return partial results or a helpful error message
3. **Use resource-manager for path resolution** — so bundled binaries work in production

### Dev vs Production Binary Resolution

In development, the worker calls `ffmpeg` / `ffprobe` directly from the system PATH. In production (packaged app), you bundle the binaries and use `resource-manager` to resolve paths:

```python
# In your action handler, accept a binary path from the payload:
ffprobe_path = payload.get("ffprobe_path", "ffprobe")
subprocess.run([ffprobe_path, ...])
```

```typescript
// In electron/main.ts, resolve and pass the path:
const ffprobePath = isDev
  ? 'ffprobe'  // Use system PATH in dev
  : resourceManager.getBinaryPath('ffprobe');  // Bundled in prod

workerClient.execute({
  action: 'video_info',
  payload: { path: filePath, ffprobe_path: ffprobePath },
});
```

### Bundling ffmpeg for Distribution

When packaging your app with `electron-builder`, include ffmpeg in extra resources:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "vendor/ffmpeg/${os}/${arch}/",
        "to": "bin/",
        "filter": ["ffmpeg", "ffprobe", "ffmpeg.exe", "ffprobe.exe"]
      }
    ]
  }
}
```

Then `resource-manager` resolves `process.resourcesPath + '/bin/ffmpeg'` in production.

## Replacing the Transcribe Stub

The `transcribe` action is a stub. To add real transcription:

### Option A: OpenAI Whisper (Python)

```bash
pip install openai-whisper
```

Edit `python/worker/actions/transcribe.py`:

```python
import whisper

model = None

@register("transcribe")
def handle_transcribe(payload):
    global model
    if model is None:
        model = whisper.load_model("base")

    result = model.transcribe(payload["path"])
    return {
        "success": True,
        "text": result["text"],
        "segments": [
            {"start": s["start"], "end": s["end"], "text": s["text"]}
            for s in result.get("segments", [])
        ],
    }
```

### Option B: whisper.cpp (Faster, C++)

Build [whisper.cpp](https://github.com/ggerganov/whisper.cpp), then use the subprocess pattern from `thumbnail.py`:

```python
subprocess.run([whisper_cpp_path, "-m", model_path, "-f", audio_path, ...])
```

Bundle the binary using the same `extraResources` pattern as ffmpeg.

## Adding New Video Processing Actions

1. Create a new file in `python/worker/actions/`, e.g. `compress.py`
2. Use the `@register("compress")` decorator
3. Import it in `actions/__init__.py`
4. Call it from the renderer via `window.api.execute({ action: 'compress', payload: {...} })`

Example:

```python
# python/worker/actions/compress.py
from core.dispatcher import register

@register("compress")
def handle_compress(payload):
    input_path = payload["path"]
    output_path = payload["output"]
    crf = payload.get("crf", 23)

    subprocess.run([
        "ffmpeg", "-i", input_path,
        "-c:v", "libx264", "-crf", str(crf),
        output_path,
    ], check=True)

    return {"success": True, "output_path": output_path}
```

## Architecture

```
electron/main.ts          → Electron main process (IPC + dialog + worker-client)
electron/preload.ts        → Bridges renderer ↔ main (contextBridge)
src/App.tsx                → React UI with tabs
python/worker/main.py      → Worker entry point (stdin/stdout JSON protocol)
python/worker/actions/     → Action handlers (video_info, thumbnail, transcribe)
python/worker/core/        → Protocol + dispatcher (copied from framework)
```
