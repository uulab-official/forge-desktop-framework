"""Convert action — unit conversion for length, weight, and temperature."""

from typing import Any
from forge_worker import register

# Conversion factors to a base unit per category
# Length: base = meters
LENGTH_TO_BASE: dict[str, float] = {
    "m": 1.0,
    "km": 1000.0,
    "mi": 1609.344,
    "ft": 0.3048,
}

# Weight: base = kilograms
WEIGHT_TO_BASE: dict[str, float] = {
    "kg": 1.0,
    "lb": 0.45359237,
    "oz": 0.028349523125,
}

CATEGORY_TABLES: dict[str, dict[str, float]] = {
    "length": LENGTH_TO_BASE,
    "weight": WEIGHT_TO_BASE,
}


def find_category(unit: str) -> tuple[str, dict[str, float]] | None:
    """Find which category a unit belongs to."""
    for cat, table in CATEGORY_TABLES.items():
        if unit in table:
            return cat, table
    return None


def convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    """Convert between temperature units (C, F, K)."""
    # Normalize to Celsius first
    if from_unit == "C":
        celsius = value
    elif from_unit == "F":
        celsius = (value - 32) * 5 / 9
    elif from_unit == "K":
        celsius = value - 273.15
    else:
        raise ValueError(f"Unknown temperature unit: {from_unit}")

    # Convert from Celsius to target
    if to_unit == "C":
        return celsius
    elif to_unit == "F":
        return celsius * 9 / 5 + 32
    elif to_unit == "K":
        return celsius + 273.15
    else:
        raise ValueError(f"Unknown temperature unit: {to_unit}")


TEMP_UNITS = {"C", "F", "K"}


@register("convert")
def handle_convert(payload: dict[str, Any]) -> dict[str, Any]:
    value = payload.get("value")
    from_unit = payload.get("from_unit", "")
    to_unit = payload.get("to_unit", "")

    if value is None:
        raise ValueError("No value provided")
    value = float(value)

    # Temperature is a special case (not simple ratio)
    if from_unit in TEMP_UNITS and to_unit in TEMP_UNITS:
        result = convert_temperature(value, from_unit, to_unit)
        return {
            "value": result,
            "from": f"{value} {from_unit}",
            "to": f"{round(result, 3)} {to_unit}",
            "category": "temperature",
        }

    # Ratio-based conversions
    from_info = find_category(from_unit)
    to_info = find_category(to_unit)

    if from_info is None:
        raise ValueError(f"Unknown unit: {from_unit}")
    if to_info is None:
        raise ValueError(f"Unknown unit: {to_unit}")

    from_cat, from_table = from_info
    to_cat, to_table = to_info

    if from_cat != to_cat:
        raise ValueError(f"Cannot convert between {from_cat} and {to_cat}")

    # Convert: value -> base -> target
    base_value = value * from_table[from_unit]
    result = base_value / to_table[to_unit]

    return {
        "value": result,
        "from": f"{value} {from_unit}",
        "to": f"{round(result, 3)} {to_unit}",
        "category": from_cat,
    }
