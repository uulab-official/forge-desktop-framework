"""Health check action — verifies the worker is running correctly."""

import sys
import platform
from typing import Any

from forge_worker import register


@register("health_check")
def handle_health_check(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "ok",
        "python_version": sys.version,
        "platform": platform.system(),
        "arch": platform.machine(),
    }
