import io
import os
import logging
import asyncio
import numpy as np
import soundfile as sf
from typing import Optional, Dict, Any, Tuple
from groq import Groq
from faster_whisper import WhisperModel
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class TranscriptionService:
    def __init__(self, api_key: Optional[str] = None, model_size: str = "base", device: str = "cuda"):
        # We prioritize Groq API key from environment
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.groq_client = Groq(api_key=self.groq_api_key) if self.groq_api_key else None
        
        # Local Whisper as robust fallback
        try:
            self.whisper_model = WhisperModel(
                model_size,
                device=device,
                compute_type="int8"
            )
            logger.info(f"Local Whisper fallback initialized ({device})")
        except Exception as e:
            logger.warning(f"Whisper initialization failed: {e}. Falling back to CPU or ignoring.")
            self.whisper_model = None

        if self.groq_client:
            logger.info("TranscriptionService: Groq (Primary) enabled")
        else:
            logger.warning("TranscriptionService: GROQ_API_KEY not found. Groq disabled.")

    def to_wav_bytes(self, audio: Tuple[int, np.ndarray]) -> bytes:
        """Helper: numpy audio tuple -> WAV bytes for Groq."""
        sample_rate, array = audio
        # FastRTC usually gives (1, samples) or (samples,)
        array = array.squeeze()
        
        # Ensure float32 for soundfile if it's not already
        if array.dtype != np.float32:
            if array.dtype == np.int16:
                array = array.astype(np.float32) / 32768.0
            else:
                array = array.astype(np.float32)
                
        buf = io.BytesIO()
        sf.write(buf, array, sample_rate, format="WAV")
        buf.seek(0)
        return buf.read()

    async def transcribe(self, audio_data: Any, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio. 
        Accepts: 
          - bytes (raw PCM16, 16kHz)
          - tuple (sample_rate, numpy_array)
        """
        # 1. Try Groq (Ultra Fast)
        if self.groq_client:
            try:
                if isinstance(audio_data, bytes):
                    # Convert raw bytes to tuple for the helper
                    samples = np.frombuffer(audio_data, dtype=np.int16)
                    wav_bytes = self.to_wav_bytes((16000, samples))
                else:
                    # Already a tuple (likely from FastRTC)
                    wav_bytes = self.to_wav_bytes(audio_data)

                def call_groq():
                    return self.groq_client.audio.transcriptions.create(
                        file=("audio.wav", wav_bytes),
                        model="whisper-large-v3-turbo",
                        response_format="text",
                        language=language
                    ).strip()

                text = await asyncio.get_event_loop().run_in_executor(None, call_groq)
                
                if text:
                    logger.info(f"[GROQ] Transcribed: {text[:50]}...")
                    return {
                        "text": text,
                        "language": language or "en",
                        "provider": "groq",
                        "confidence": 1.0
                    }
            except Exception as e:
                logger.error(f"Groq transcription failed: {e}")

        # 2. Fallback to Local Whisper
        if self.whisper_model:
            try:
                if not isinstance(audio_data, bytes):
                    # Convert tuple back to PCM16 bytes for internal whisper helper
                    _, array = audio_data
                    if array.dtype == np.float32:
                        pcm_bytes = (array * 32768.0).astype(np.int16).tobytes()
                    else:
                        pcm_bytes = array.astype(np.int16).tobytes()
                else:
                    pcm_bytes = audio_data
                
                return await self._transcribe_whisper(pcm_bytes, language)
            except Exception as e:
                logger.error(f"Whisper fallback failed: {e}")

        return {"text": "", "language": None, "provider": "error", "error": "Transcription failed"}

    async def _transcribe_whisper(self, audio_data: bytes, language: Optional[str]) -> Dict[str, Any]:
        """Internal local Whisper inference."""
        import tempfile
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        try:
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
