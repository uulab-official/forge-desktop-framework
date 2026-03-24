"""Action dispatcher -- routes action strings to handler functions."""

from typing import Any, Callable

ActionHandler = Callable[[dict[str, Any]], dict[str, Any] | None]

_registry: dict[str, ActionHandler] = {}


def register(action_name: str):
    """Decorator to register an action handler.

    Usage:
        @register("health_check")
        def handle_health_check(payload):
            return {"status": "ok"}
    """
    def decorator(fn: ActionHandler) -> ActionHandler:
        _registry[action_name] = fn
        return fn
    return decorator


def dispatch(action: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    """Dispatch an action to its registered handler."""
    handler = _registry.get(action)
    if handler is None:
        raise ValueError(f"Unknown action: {action}")
    return handler(payload)


def list_actions() -> list[str]:
    """List all registered action names."""
    return list(_registry.keys())
