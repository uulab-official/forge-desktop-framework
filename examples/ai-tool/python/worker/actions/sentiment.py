"""Keyword-based sentiment analysis.

A lightweight stub that demonstrates the pattern without heavy ML dependencies.
Replace with a real model (e.g. transformers pipeline) for production use.
"""

from typing import Any
from core.dispatcher import register

POSITIVE_WORDS = {
    "happy", "good", "great", "love", "excellent",
    "amazing", "wonderful", "best", "fantastic", "awesome",
}

NEGATIVE_WORDS = {
    "bad", "terrible", "awful", "hate", "worst",
    "horrible", "poor", "sad", "angry", "ugly",
}


@register("sentiment")
def handle_sentiment(payload: dict[str, Any]) -> dict[str, Any]:
    text = payload.get("text", "")
    words = text.lower().split()

    positive_found = [w for w in words if w.strip(".,!?;:\"'()") in POSITIVE_WORDS]
    negative_found = [w for w in words if w.strip(".,!?;:\"'()") in NEGATIVE_WORDS]

    pos_count = len(positive_found)
    neg_count = len(negative_found)
    total = pos_count + neg_count

    if total == 0:
        label = "neutral"
        score = 0.5
    elif pos_count > neg_count:
        label = "positive"
        score = pos_count / total
    elif neg_count > pos_count:
        label = "negative"
        score = neg_count / total
    else:
        label = "neutral"
        score = 0.5

    # Deduplicate found words for display
    positive_unique = sorted(set(w.strip(".,!?;:\"'()") for w in positive_found))
    negative_unique = sorted(set(w.strip(".,!?;:\"'()") for w in negative_found))

    return {
        "label": label,
        "score": round(score, 3),
        "positive_count": pos_count,
        "negative_count": neg_count,
        "details": {
            "positive_words_found": positive_unique,
            "negative_words_found": negative_unique,
        },
    }
