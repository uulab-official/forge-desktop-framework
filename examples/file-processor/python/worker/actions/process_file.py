"""Process file action — returns file stats and text analysis."""

import os
from typing import Any
from core.dispatcher import register
from core.protocol import log


# Extensions commonly considered text files
TEXT_EXTENSIONS = {
    '.txt', '.md', '.py', '.js', '.ts', '.tsx', '.jsx', '.json',
    '.html', '.css', '.scss', '.xml', '.yaml', '.yml', '.toml',
    '.csv', '.tsv', '.log', '.sh', '.bash', '.zsh', '.fish',
    '.c', '.cpp', '.h', '.hpp', '.java', '.rs', '.go', '.rb',
    '.swift', '.kt', '.sql', '.r', '.m', '.cfg', '.ini', '.env',
    '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc',
}


def _is_text_file(file_path: str, extension: str) -> bool:
    """Heuristic check whether a file is a text file."""
    if extension.lower() in TEXT_EXTENSIONS:
        return True

    # Try reading a small chunk and checking for null bytes
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(8192)
            return b'\x00' not in chunk
    except (OSError, IOError):
        return False


@register("process_file")
def handle_process_file(payload: dict[str, Any]) -> dict[str, Any]:
    file_path = payload.get("path", "")
    if not file_path:
        raise ValueError("Missing 'path' in payload")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    log(f"Processing file: {file_path}")

    stat = os.stat(file_path)
    _, extension = os.path.splitext(file_path)
    is_text = _is_text_file(file_path, extension)

    result: dict[str, Any] = {
        "path": file_path,
        "size": stat.st_size,
        "extension": extension if extension else "(none)",
        "is_text": is_text,
    }

    if is_text:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            lines = content.splitlines()
            result["line_count"] = len(lines)
            result["word_count"] = sum(len(line.split()) for line in lines)
            result["char_count"] = len(content)
        except (OSError, IOError) as e:
            log(f"Could not read text content: {e}")
            result["is_text"] = False

    return result
