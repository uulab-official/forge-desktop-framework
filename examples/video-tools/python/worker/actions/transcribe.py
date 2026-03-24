"""Transcription action — STUB.

This is a placeholder showing how to integrate a transcription engine
such as OpenAI Whisper or whisper.cpp into the Forge worker pattern.

To implement real transcription:

1. Install whisper:
   pip install openai-whisper

2. Replace the stub below with:

   import whisper

   model = None

   @register("transcribe")
   def handle_transcribe(payload):
       global model
       if model is None:
           model = whisper.load_model("base")  # or "small", "medium", "large"

       file_path = payload.get("path", "")
       language = payload.get("language")  # None = auto-detect

       result = model.transcribe(file_path, language=language)
       return {
           "success": True,
           "text": result["text"],
           "language": result.get("language"),
           "segments": [
               {
                   "start": seg["start"],
                   "end": seg["end"],
                   "text": seg["text"],
               }
               for seg in result.get("segments", [])
           ],
       }

3. For whisper.cpp (faster, C++ based):
   - Build whisper.cpp and place the binary in your resources
   - Use subprocess to call it, similar to the ffmpeg pattern in thumbnail.py
   - Use resource-manager to resolve the binary path
"""

from typing import Any

from core.dispatcher import register


@register("transcribe")
def handle_transcribe(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "success": False,
        "stub": True,
        "message": "Transcription is a stub. See README for integration guide.",
        "hint": "To add real transcription, install openai-whisper or use whisper.cpp",
    }
