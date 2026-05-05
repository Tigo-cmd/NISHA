"""Audio domain events."""

from dataclasses import dataclass
from datetime import datetime

from nisha.domain.models.enums import AudioEventType, AudioPriority


@dataclass(frozen=True)
class AudioEventDetected:
    """Emitted when an audio event is detected and processed by the server."""
    event_id: str
    agent_id: str
    timestamp: datetime
    priority: AudioPriority
    class_name: AudioEventType
    confidence: float
    location_zone: str | None = None


@dataclass(frozen=True)
class AudioTranscriptionCompleted:
    """Emitted when a transcription for an audio event is completed."""
    event_id: str
    agent_id: str
    text: str
    language: str
    confidence: float
