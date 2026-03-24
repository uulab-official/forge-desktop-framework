"""Calculate action — safely evaluates math expressions."""

import ast
from typing import Any
from core.dispatcher import register


def safe_eval(expr: str) -> float:
    """Evaluate a math expression safely using AST whitelisting."""
    tree = ast.parse(expr, mode='eval')
    for node in ast.walk(tree):
        if not isinstance(node, (
            ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
            ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod,
            ast.USub, ast.UAdd,
        )):
            raise ValueError(f"Unsupported operation: {type(node).__name__}")
    return float(eval(compile(tree, '<expr>', 'eval')))


@register("calculate")
def handle_calculate(payload: dict[str, Any]) -> dict[str, Any]:
    expression = payload.get("expression", "")
    if not expression:
        raise ValueError("No expression provided")

    result = safe_eval(expression)
    return {"expression": expression, "result": result}
