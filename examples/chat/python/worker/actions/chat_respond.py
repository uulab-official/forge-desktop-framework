"""Chat respond action -- generates a fun response to user messages."""

import time
import random
from typing import Any
from core.dispatcher import register


FUN_FACTS = [
    "Did you know? The average person types around 40 words per minute.",
    "Fun fact: The most common letter in English is 'e'.",
    "Trivia: The longest word without a vowel is 'rhythms'.",
    "Did you know? 'Set' has the most definitions of any English word.",
    "Fun fact: A pangram contains every letter of the alphabet at least once.",
]


@register("chat_respond")
def handle_chat_respond(payload: dict[str, Any]) -> dict[str, Any]:
    message = payload.get("message", "")

    parts: list[str] = []

    # Echo
    parts.append(f'You said: "{message}"')

    # Word count
    words = message.split()
    word_count = len(words)
    parts.append(f"That message has {word_count} word{'s' if word_count != 1 else ''} and {len(message)} character{'s' if len(message) != 1 else ''}.")

    # Reversed
    reversed_msg = message[::-1]
    parts.append(f"Reversed: \"{reversed_msg}\"")

    # Fun fact based on message length
    fact = FUN_FACTS[len(message) % len(FUN_FACTS)]
    parts.append(fact)

    # Unique word analysis
    unique_words = set(w.lower().strip(".,!?;:") for w in words)
    if word_count > 0:
        uniqueness = len(unique_words) / word_count * 100
        parts.append(f"Vocabulary uniqueness: {uniqueness:.0f}% ({len(unique_words)} unique out of {word_count} words).")

    response = " ".join(parts)

    return {
        "response": response,
        "timestamp": time.time(),
    }
