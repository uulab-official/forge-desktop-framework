"""Batch rename action — dry-run renaming of files with a prefix and numbering."""

import os
from typing import Any
from core.dispatcher import register
from core.protocol import log


@register("batch_rename")
def handle_batch_rename(payload: dict[str, Any]) -> dict[str, Any]:
    files = payload.get("files", [])
    prefix = payload.get("prefix", "file")
    start_num = payload.get("start_num", 1)

    if not isinstance(files, list) or len(files) == 0:
        raise ValueError("'files' must be a non-empty list of file paths")

    log(f"Batch rename (dry run): {len(files)} files, prefix='{prefix}', start={start_num}")

    renamed = []
    for i, file_path in enumerate(files):
        basename = os.path.basename(file_path)
        _, ext = os.path.splitext(basename)
        num = start_num + i
        new_name = f"{prefix}_{num:04d}{ext}"

        renamed.append({
            "original": basename,
            "new_name": new_name,
            "original_path": file_path,
        })

    return {"renamed": renamed, "dry_run": True}
