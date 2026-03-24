"""Filter and sort sales records."""

from typing import Any

from core.dispatcher import register


@register("filter_data")
def handle_filter_data(payload: dict[str, Any]) -> dict[str, Any]:
    records = list(payload.get("records", []))
    category = payload.get("category")
    min_amount = payload.get("min_amount")
    max_amount = payload.get("max_amount")
    sort_by = payload.get("sort_by")
    sort_desc = payload.get("sort_desc", False)

    # Apply filters
    if category:
        records = [r for r in records if r["category"] == category]
    if min_amount is not None:
        records = [r for r in records if r["amount"] >= min_amount]
    if max_amount is not None:
        records = [r for r in records if r["amount"] <= max_amount]

    # Sort
    if sort_by and records:
        records.sort(key=lambda r: r.get(sort_by, 0), reverse=bool(sort_desc))

    return {
        "records": records,
        "total": len(records),
    }
