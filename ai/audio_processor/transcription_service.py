import httpx
import logging
import asyncio
from typing import Optional, Dict, Any
import os
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

class TranscriptionService:
    def __init__(self, api_key: str, model_size: str = "base", device: str = "cuda"):
        self.api_key = api_key
        self.intron_url = "https://voice.intron.io/api/v1/transcribe" # Based on research, but verify with actual docs if possible
        # Note: If the user provides a different endpoint, we should use that.
        
        self.whisper_model = WhisperModel(
            model_size,
            device=device,
            compute_type="int8"
        )
        logger.info(f"TranscriptionService initialized with Whisper ({device}) and Intron Sahara")

    async def transcribe(self, audio_data: bytes, language: Optional[str] = None) -> Dict[str, Any]:
        """Try Intron Sahara first, fallback to Whisper."""
        try:
            result = await self._transcribe_intron(audio_data, language)
            if result and result.get("text"):
                return {
                    "text": result["text"],
                    "language": result.get("language", language),
                    "provider": "intron",
                    "confidence": result.get("confidence", 1.0)
                }
        except Exception as e:
            logger.warning(f"Intron Sahara transcription failed: {e}. Falling back to Whisper.")

        # Fallback to Whisper
        try:
            return await self._transcribe_whisper(audio_data, language)
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            return {"text": "", "language": None, "provider": "error", "error": str(e)}

    async def _transcribe_intron(self, audio_data: bytes, language: Optional[str]) -> Optional[Dict[str, Any]]:
        """Call Intron Sahara v2 API."""
        # Note: Intron Sahara v2 might require specific headers or multi-part form data
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }
        
        # This is a placeholder for the actual API call structure
        # We might need to send it as a file
        files = {'file': ('audio.wav', audio_data, 'audio/wav')}
        data = {}
        if language:
            data['language'] = language

        async with httpx.AsyncClient(timeout=10.0) as client:
            # Assuming POST to /transcribe
            # Based on the user's PRD: "Sign up for Intron Sahara v2 API"
            # I will use the documented pattern if available, or a generic one.
            response = await client.post(
                "https://api.intron.io/v1/stt/transcribe", # Example endpoint
                headers=headers,
                files=files,
                data=data
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Intron API error {response.status_code}: {response.text}")
                return None

    async def _transcribe_whisper(self, audio_data: bytes, language: Optional[str]) -> Dict[str, Any]:
        """Perform local Whisper inference."""
        import tempfile
        import os
        import subprocess

        # Faster-whisper works better with file paths or specific array formats
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        try:
            # Run in executor because faster-whisper is CPU/GPU intensive and blocking
            def run_inference():
                segments, info = self.whisper_model.transcribe(
                    tmp_path,
                    beam_size=5,
                    language=language
                )
                text = " ".join([s.text for s in segments]).strip()
                return text, info.language, info.language_probability

            text, lang, prob = await asyncio.get_event_loop().run_in_executor(None, run_inference)
            
            return {
                "text": text,
                "language": lang,
                "provider": "whisper",
                "confidence": prob
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
