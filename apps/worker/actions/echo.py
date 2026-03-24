"""Echo action — returns the payload as-is. Useful for testing IPC."""

from typing import Any

from forge_worker import register


@register("echo")
def handle_echo(payload: dict[str, Any]) -> dict[str, Any]:
    return {"echoed": payload}
