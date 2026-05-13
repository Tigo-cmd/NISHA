import asyncio
import time
import logging
from typing import Dict, List, Optional
import collections
import io
import wave

logger = logging.getLogger(__name__)

class AudioBuffer:
    """Manages raw PCM chunks for a specific agent.
    
    Buffers audio until a VoicePattern is detected, then accumulates a segment
    for transcription.
    """
    def __init__(self, agent_id: str, sample_rate: int = 16000, segment_duration: float = 3.0):
        self.agent_id = agent_id
        self.sample_rate = sample_rate
        self.segment_duration = segment_duration
        self.chunk_size = int(sample_rate * segment_duration)
        
        # Buffer for the current segment being built
        self._current_buffer = bytearray()
        self._last_activity = time.time()
        
        # Rolling window for pre-speech context (e.g. 1 second)
        self._pre_roll = collections.deque(maxlen=10) # 10 chunks of ~100ms
        
        self.is_transcribing = False

    def add_chunk(self, chunk: bytes, has_speech: bool = False):
        """Add a raw PCM chunk to the buffer."""
        if has_speech:
            if not self.is_transcribing:
                # Start of speech! Prepend pre-roll
                self.is_transcribing = True
                for old_chunk in self._pre_roll:
                    self._current_buffer.extend(old_chunk)
                self._pre_roll.clear()
            
            self._current_buffer.extend(chunk)
            self._last_activity = time.time()
        else:
            if self.is_transcribing:
                # Still transcribing but current chunk is quiet
                # We keep going for a short 'tail' duration
                if time.time() - self._last_activity < 1.0: # 1s tail
                    self._current_buffer.extend(chunk)
                else:
                    # End of speech segment
                    self.is_transcribing = False
            else:
                # Not transcribing, just keep pre-roll
                self._pre_roll.append(chunk)

    def get_segment_to_transcribe(self) -> Optional[bytes]:
        """Returns the accumulated buffer if it's long enough or speech ended."""
        # If we have at least segment_duration of audio, or speech ended
        current_len_sec = len(self._current_buffer) / (self.sample_rate * 2) # 16-bit
        
        if current_len_sec >= self.segment_duration or (not self.is_transcribing and len(self._current_buffer) > 0):
            segment = bytes(self._current_buffer)
            self._current_buffer = bytearray()
            return self._wrap_wav(segment)
        
        return None

    def _wrap_wav(self, pcm_data: bytes) -> bytes:
        """Wrap raw PCM in a WAV header for the API."""
        with io.BytesIO() as wav_io:
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2) # 16-bit
                wav_file.setframerate(self.sample_rate)
                wav_file.writeframes(pcm_data)
            return wav_io.getvalue()
