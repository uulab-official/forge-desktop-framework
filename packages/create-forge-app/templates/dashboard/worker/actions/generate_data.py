"""Generate random sales data."""

import random
from datetime import datetime, timedelta
from typing import Any

from forge_worker import register

CATEGORIES = ["Electronics", "Clothing", "Food", "Books", "Sports"]


@register("generate_data")
def handle_generate_data(payload: dict[str, Any]) -> dict[str, Any]:
    count = payload.get("count", 100)
    base_date = datetime(2025, 1, 1)
    records = []

    for i in range(1, count + 1):
        day_offset = random.randint(0, 364)
        record_date = base_date + timedelta(days=day_offset)
        records.append({
            "id": i,
            "date": record_date.strftime("%Y-%m-%d"),
            "category": random.choice(CATEGORIES),
            "amount": round(random.uniform(10, 500), 2),
            "quantity": random.randint(1, 10),
        })

    return {
        "records": records,
        "generated_at": datetime.now().isoformat(),
    }
