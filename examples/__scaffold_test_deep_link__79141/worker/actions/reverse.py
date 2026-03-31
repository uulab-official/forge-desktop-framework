"""Reverse action — reverses a string. The simplest possible action."""

from typing import Any
from forge_worker import register


@register("reverse")
def handle_reverse(payload: dict[str, Any]) -> dict[str, Any]:
    text = payload.get("text", "")
    return {"reversed": text[::-1]}
