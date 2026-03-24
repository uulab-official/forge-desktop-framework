"""Video info action — extracts metadata using ffprobe, with os.path fallback."""

import json
import os
import subprocess
from typing import Any

from core.dispatcher import register
from core.protocol import log


@register("video_info")
def handle_video_info(payload: dict[str, Any]) -> dict[str, Any]:
    file_path = payload.get("path", "")

    if not file_path or not os.path.isfile(file_path):
        raise ValueError(f"File not found: {file_path}")

    # Try ffprobe first
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                file_path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            log(f"ffprobe exited with code {result.returncode}: {result.stderr}")
            raise RuntimeError("ffprobe failed")

        probe = json.loads(result.stdout)
        fmt = probe.get("format", {})
        streams = probe.get("streams", [])

        # Find video and audio streams
        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        info: dict[str, Any] = {
            "filename": os.path.basename(file_path),
            "format": fmt.get("format_long_name", fmt.get("format_name", "unknown")),
            "duration": _format_duration(float(fmt.get("duration", 0))),
            "size": _format_size(int(fmt.get("size", 0))),
        }

        if video_stream:
            width = video_stream.get("width", 0)
            height = video_stream.get("height", 0)
            info["resolution"] = f"{width}x{height}"
            info["video_codec"] = video_stream.get("codec_name", "unknown")

            # Parse FPS from r_frame_rate (e.g. "30/1" or "24000/1001")
            fps_str = video_stream.get("r_frame_rate", "0/1")
            try:
                num, den = fps_str.split("/")
                fps = round(int(num) / int(den), 2)
                info["fps"] = fps
            except (ValueError, ZeroDivisionError):
                info["fps"] = fps_str

        if audio_stream:
            info["audio_codec"] = audio_stream.get("codec_name", "unknown")

        return info

    except FileNotFoundError:
        # ffprobe not installed — fall back to basic file info
        log("ffprobe not found, falling back to basic file info")
        stat = os.stat(file_path)
        _, ext = os.path.splitext(file_path)
        return {
            "filename": os.path.basename(file_path),
            "extension": ext,
            "file_size": _format_size(stat.st_size),
            "note": "ffprobe not found - install ffmpeg for full metadata",
        }

    except Exception as e:
        log(f"Unexpected error in video_info: {e}")
        raise


def _format_duration(seconds: float) -> str:
    """Format seconds as HH:MM:SS."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def _format_size(size_bytes: int) -> str:
    """Format bytes as human-readable size."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"
