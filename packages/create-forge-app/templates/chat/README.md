# Forge Chat Example

A real-time chat UI demonstrating smooth message rendering, typing indicators, and IPC-based message flow using the Forge Desktop Framework.

## Features

- Chat bubble interface with user (blue/right) and assistant (gray/left) alignment
- Word-by-word streaming responses from the Python worker via IPC
- Typing indicator with animated bouncing dots
- Auto-resizing textarea with Shift+Enter for newlines
- Smooth auto-scroll to newest messages
- Avatar placeholders and timestamps on each message

## Architecture

```
React UI  -->  preload (chat:send)  -->  Electron main  -->  Python worker
   ^                                         |
   |         preload (chat:stream)  <--------|  (word-by-word streaming)
```

1. The user types a message and presses Enter.
2. The preload bridge invokes `chat:send` on the main process.
3. Main forwards the message to the Python worker via `worker:execute` with the `chat_respond` action.
4. The Python worker generates a response (echo, reversal, word count, fun fact).
5. Main splits the response into words and streams them back to the renderer via `chat:stream` events with a small delay between each word, simulating real-time generation.

## Python Worker Actions

- `chat_respond` -- Takes `{"message": "..."}`, returns `{"response": "...", "timestamp": ...}`. Generates an analysis of the input including echo, reversal, word count, vocabulary uniqueness, and a fun fact.

## Running

```bash
pnpm dev
```
