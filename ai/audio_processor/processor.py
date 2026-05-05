"""Audio processing module for NISHA.

Handles classification of raw audio streams into behavior patterns:
- Speech/VoicePattern
- Scream/Distress (High intensity)
- AmbientNoise (Default)
"""

import numpy as np
import logging
import subprocess
import tempfile
import os

logger = logging.getLogger(__name__)

class AudioClassifier:
    """Classifies audio streams (PCM or AAC/M4A) into security-relevant categories."""
    
    def __init__(self, threshold: float = 0.6):
        self.threshold = threshold
        logger.info("AudioClassifier initialized (FFmpeg decoding enabled)")

    def _decode_audio(self, data: bytes) -> np.ndarray:
        """Decode potentially compressed audio to raw PCM using FFmpeg."""
        # Check for magic bytes of M4A/AAC (ftyp)
        is_compressed = b'ftyp' in data[:20] or b'ADIF' in data[:4] or b'\xff\xf1' in data[:2]
        
        if not is_compressed:
            # Assume raw 16-bit PCM (e.g. from hardware agents)
            return np.frombuffer(data, dtype=np.int16).astype(np.float32)

        # Handle compressed audio via FFmpeg
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as tmp:
                tmp.write(data)
                tmp_path = tmp.name
            
            # Use FFmpeg to convert to 16kHz mono PCM
            cmd = [
                "ffmpeg", "-y", "-i", tmp_path,
                "-f", "s16le", "-ac", "1", "-ar", "16000",
                "pipe:1"
            ]
            raw_pcm = subprocess.check_output(cmd, stderr=subprocess.DEVNULL)
            return np.frombuffer(raw_pcm, dtype=np.int16).astype(np.float32)
        except Exception as e:
            logger.error(f"FFmpeg decoding failed: {e}")
            # Fallback to direct buffer if it was a false positive
            return np.frombuffer(data, dtype=np.int16).astype(np.float32)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

    def process_audio(self, data: bytes) -> tuple[str, float, str | None]:
        """Process audio data and return (classification, confidence, transcription)."""
        try:
            samples = self._decode_audio(data)
            
            if len(samples) == 0:
                return "AmbientNoise", 1.0, None
                
            # Calculate RMS (Root Mean Square) for intensity/volume
            rms = np.sqrt(np.mean(samples**2))
            
            # Normalize RMS to a 0.0 - 1.0 range (approximate for 16-bit)
            # Adjust normalization for 16kHz vs previous assumption
            intensity = min(rms / 32768.0, 1.0)
            
            # Simulated Classification Logic
            # 1. High intensity -> Potential Scream/Alarm
            if intensity > 0.12: # Lowered threshold slightly for decoded audio
                return "Scream", 0.92, "High intensity sound detected: Possible DISTRESS"
            
            # 2. Medium intensity with specific variance -> Speech
            # Speech has high variance in amplitude
            variance = np.var(samples) / (rms**2 + 1)
            if 0.02 < intensity < 0.12 and variance > 0.4:
                return "VoicePattern", 0.88, "Voice activity detected in sector"
                
            # 3. Default -> Ambient
            return "AmbientNoise", 1.0, None
            
        except Exception as e:
            logger.error(f"Audio processing error: {e}")
            return "AmbientNoise", 0.0, None

def main():
    # Test script
    classifier = AudioClassifier()
    # Mock some "loud" data
    loud_data = np.random.randint(-20000, 20000, 1000, dtype=np.int16).tobytes()
    print(f"Loud data: {classifier.process_audio(loud_data)}")
    
    # Mock some "quiet" data
    quiet_data = np.random.randint(-100, 100, 1000, dtype=np.int16).tobytes()
    print(f"Quiet data: {classifier.process_audio(quiet_data)}")

if __name__ == "__main__":
    main()
