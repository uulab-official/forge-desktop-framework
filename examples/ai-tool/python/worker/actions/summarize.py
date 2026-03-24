"""Extractive text summarizer using word frequency scoring.

A lightweight stub that demonstrates the pattern without heavy ML dependencies.
Split text into sentences, score by word frequency (ignoring stop words),
and return the top-scoring sentences as the summary.
"""

from typing import Any
from core.dispatcher import register

STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "that", "this",
    "it", "its", "i", "me", "my", "we", "our", "you", "your", "he", "him",
    "his", "she", "her", "they", "them", "their", "what", "which", "who",
    "whom", "these", "those",
}

MAX_SUMMARY_SENTENCES = 3


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on period boundaries."""
    raw = text.replace("\n", " ").split(".")
    return [s.strip() for s in raw if s.strip()]


def _word_frequencies(sentences: list[str]) -> dict[str, int]:
    """Count word frequencies across all sentences, ignoring stop words."""
    freq: dict[str, int] = {}
    for sentence in sentences:
        for word in sentence.lower().split():
            cleaned = word.strip(".,!?;:\"'()")
            if cleaned and cleaned not in STOP_WORDS:
                freq[cleaned] = freq.get(cleaned, 0) + 1
    return freq


def _score_sentence(sentence: str, freq: dict[str, int]) -> float:
    """Score a sentence by summing the frequency of its non-stop words."""
    score = 0.0
    words = sentence.lower().split()
    for word in words:
        cleaned = word.strip(".,!?;:\"'()")
        if cleaned in freq:
            score += freq[cleaned]
    return score


@register("summarize")
def handle_summarize(payload: dict[str, Any]) -> dict[str, Any]:
    text = payload.get("text", "")
    sentences = _split_sentences(text)

    if len(sentences) <= MAX_SUMMARY_SENTENCES:
        return {
            "summary": ". ".join(sentences) + ("." if sentences else ""),
            "sentence_count": len(sentences),
            "summary_sentence_count": len(sentences),
        }

    freq = _word_frequencies(sentences)
    scored = [(s, _score_sentence(s, freq)) for s in sentences]
    scored.sort(key=lambda x: x[1], reverse=True)

    top = scored[:MAX_SUMMARY_SENTENCES]
    # Restore original order
    top_sentences = [s for s in sentences if s in {t[0] for t in top}]

    summary = ". ".join(top_sentences) + "."

    return {
        "summary": summary,
        "sentence_count": len(sentences),
        "summary_sentence_count": len(top_sentences),
    }
