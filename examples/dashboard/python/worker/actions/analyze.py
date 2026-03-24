"""Analyze sales data — compute statistics, category breakdown, histogram."""

import statistics
from typing import Any

from core.dispatcher import register


@register("analyze")
def handle_analyze(payload: dict[str, Any]) -> dict[str, Any]:
    records = payload.get("records", [])
    if not records:
        return {
            "total_sales": 0,
            "avg_order": 0,
            "total_orders": 0,
            "by_category": [],
            "top_category": "",
            "histogram": [],
        }

    amounts = [r["amount"] for r in records]
    total_sales = sum(amounts)
    avg_order = statistics.mean(amounts)
    total_orders = len(records)

    # Category breakdown
    cat_map: dict[str, dict[str, float]] = {}
    for r in records:
        cat = r["category"]
        if cat not in cat_map:
            cat_map[cat] = {"total": 0.0, "count": 0}
        cat_map[cat]["total"] += r["amount"]
        cat_map[cat]["count"] += 1

    by_category = []
    for cat, info in sorted(cat_map.items()):
        by_category.append({
            "category": cat,
            "total": round(info["total"], 2),
            "count": int(info["count"]),
            "avg": round(info["total"] / info["count"], 2),
        })

    top_category = max(by_category, key=lambda c: c["total"])["category"] if by_category else ""

    # Histogram (amount ranges)
    bins = [(0, 100), (100, 200), (200, 300), (300, 400), (400, 500)]
    histogram = []
    for low, high in bins:
        count = sum(1 for a in amounts if low <= a < high)
        histogram.append({"range": f"{low}-{high}", "count": count})
    # Catch any amounts >= 500
    over = sum(1 for a in amounts if a >= 500)
    if over > 0:
        histogram.append({"range": "500+", "count": over})

    return {
        "total_sales": round(total_sales, 2),
        "avg_order": round(avg_order, 2),
        "total_orders": total_orders,
        "by_category": by_category,
        "top_category": top_category,
        "histogram": histogram,
    }
