"""Rule-based text classifier.

A lightweight stub that demonstrates the pattern without heavy ML dependencies.
Matches keywords to assign a category with a confidence score.
"""

from typing import Any
from forge_worker import register

CATEGORIES: dict[str, list[str]] = {
    "technology": [
        "computer", "software", "code", "programming", "ai",
        "data", "algorithm",
    ],
    "sports": [
        "game", "team", "player", "score", "win",
        "match", "championship",
    ],
    "business": [
        "market", "company", "revenue", "profit", "investment",
        "stock",
    ],
}


@register("classify")
def handle_classify(payload: dict[str, Any]) -> dict[str, Any]:
    text = payload.get("text", "")
    words = set(
        w.strip(".,!?;:\"'()").lower()
        for w in text.split()
    )

    best_category = "general"
    best_count = 0
    best_matched: list[str] = []

    for category, keywords in CATEGORIES.items():
        matched = [kw for kw in keywords if kw in words]
        if len(matched) > best_count:
            best_count = len(matched)
            best_category = category
            best_matched = matched

    if best_count == 0:
        confidence = 0.25
    else:
        total_keywords = len(CATEGORIES.get(best_category, []))
        confidence = min(best_count / max(total_keywords, 1), 1.0)

    return {
        "category": best_category,
        "confidence": round(confidence, 3),
        "matched_keywords": sorted(best_matched),
    }
