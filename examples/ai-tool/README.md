# Forge AI Tool Example

Demonstrates local AI/ML integration patterns in a Forge desktop app using lightweight, stdlib-only Python implementations.

## Overview

This example ships three text analysis actions:

| Action | Description | Approach |
|---|---|---|
| **sentiment** | Detect positive / negative / neutral tone | Keyword matching against curated word lists |
| **summarize** | Extract key sentences from a paragraph | Word-frequency scoring (extractive) |
| **classify** | Categorize text into a topic | Rule-based keyword matching |

All three are implemented **without any external dependencies** so the example works out of the box with a standard Python 3.11+ installation.

## Running

```bash
pnpm install
pnpm --filter @forge-example/ai-tool dev
```

## Project Structure

```
examples/ai-tool/
├── electron/            # Electron main + preload
├── src/                 # React UI (Tailwind)
├── python/worker/
│   ├── core/            # protocol.py + dispatcher.py (copied from framework)
│   ├── actions/
│   │   ├── sentiment.py # Keyword-based sentiment analysis
│   │   ├── summarize.py # Extractive summarizer
│   │   └── classify.py  # Rule-based classifier
│   ├── main.py          # Worker entry point
│   └── requirements.txt # Empty (stdlib only)
└── package.json
```

## Replacing Stubs with Real ML

The stub implementations are intentionally simple so the framework has no heavy dependencies. When you are ready to use real models, swap in a library like Hugging Face Transformers.

### Example: Real Sentiment Analysis

Replace the keyword matcher in `actions/sentiment.py`:

```python
from transformers import pipeline
from core.dispatcher import register

classifier = pipeline("sentiment-analysis")

@register("sentiment")
def handle_sentiment(payload):
    text = payload.get("text", "")
    result = classifier(text)[0]
    return {
        "label": result["label"].lower(),
        "score": round(result["score"], 3),
        "positive_count": 0,
        "negative_count": 0,
        "details": {
            "positive_words_found": [],
            "negative_words_found": [],
        },
    }
```

Then uncomment the relevant lines in `requirements.txt` and install:

```bash
pip install -r python/worker/requirements.txt
```

### Why Stubs?

- **Zero setup friction** — no model downloads, no GPU drivers, no `pip install` step.
- **Fast startup** — the worker is ready in milliseconds instead of loading multi-GB model weights.
- **Same interface** — the IPC contract and UI remain identical whether you use stubs or real models, so swapping is a one-file change.
