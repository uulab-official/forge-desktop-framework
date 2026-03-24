"""Matrix multiplication action -- pure Python for CPU comparison."""

import random
import time
from typing import Any

from forge_worker import register


@register("matrix_multiply")
def handle(payload: dict[str, Any]) -> dict[str, Any]:
    size = payload.get("size", 64)

    # Generate random matrices
    a = [[random.random() for _ in range(size)] for _ in range(size)]
    b = [[random.random() for _ in range(size)] for _ in range(size)]

    # Pure Python matrix multiply (intentionally slow for comparison)
    start = time.time()
    result = [[0.0] * size for _ in range(size)]
    for i in range(size):
        for j in range(size):
            s = 0.0
            for k in range(size):
                s += a[i][k] * b[k][j]
            result[i][j] = s
    elapsed = (time.time() - start) * 1000

    # Return first few values as sample
    sample = result[0][:10] if size >= 10 else result[0]

    return {
        "time_ms": round(elapsed, 2),
        "result_sample": sample,
        "size": size,
    }
