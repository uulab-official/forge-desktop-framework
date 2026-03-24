"""Thumbnail extraction action — uses ffmpeg to grab a single frame."""

import os
import subprocess
import tempfile
from typing import Any

from forge_worker import register
from forge_worker import log


@register("thumbnail")
def handle_thumbnail(payload: dict[str, Any]) -> dict[str, Any]:
    file_path = payload.get("path", "")
    timestamp = payload.get("timestamp", "00:00:05")
    output_dir = payload.get("output_dir", "")

    if not file_path or not os.path.isfile(file_path):
        raise ValueError(f"File not found: {file_path}")

    # Determine output path
    if not output_dir:
        output_dir = tempfile.gettempdir()

    base_name = os.path.splitext(os.path.basename(file_path))[0]
    safe_ts = timestamp.replace(":", "-")
    output_path = os.path.join(output_dir, f"{base_name}_thumb_{safe_ts}.jpg")

    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-y",              # Overwrite output without asking
                "-i", file_path,
                "-ss", timestamp,
                "-vframes", "1",
                output_path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            log(f"ffmpeg stderr: {result.stderr}")
            return {
                "success": False,
                "error": f"ffmpeg failed (exit code {result.returncode})",
                "hint": result.stderr.strip().split("\n")[-1] if result.stderr else None,
            }

        if not os.path.isfile(output_path):
            return {
                "success": False,
                "error": "ffmpeg ran but no output file was created",
            }

        return {
            "success": True,
            "thumbnail_path": output_path,
        }

    except FileNotFoundError:
        log("ffmpeg not found")
        return {
            "success": False,
            "error": "ffmpeg not found",
            "hint": "Install ffmpeg: brew install ffmpeg (macOS) or download from ffmpeg.org",
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "ffmpeg timed out after 30 seconds",
        }
