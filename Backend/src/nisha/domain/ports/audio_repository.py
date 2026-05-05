"""Audio repository port."""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Sequence

from nisha.domain.models.audio import AudioEvent, AudioTranscription
from nisha.domain.models.enums import AudioEventType, AudioPriority


class AudioRepository(ABC):
    """Abstract port for audio data persistence."""

    @abstractmethod
    async def save_event(self, event: AudioEvent) -> AudioEvent:
        """Save a detected audio event."""
        pass

    @abstractmethod
    async def get_event(self, event_id: str) -> AudioEvent | None:
        """Retrieve an audio event by ID."""
        pass

    @abstractmethod
    async def list_events(
        self,
        agent_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        priority: AudioPriority | None = None,
        event_type: AudioEventType | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[AudioEvent]:
        """List audio events with filters."""
        pass

    @abstractmethod
    async def save_transcription(self, transcription: AudioTranscription) -> AudioTranscription:
        """Save a transcription result."""
        pass

    @abstractmethod
    async def get_transcription(self, event_id: str) -> AudioTranscription | None:
        """Get transcription for a specific event."""
        pass

    @abstractmethod
    async def update_event_status(self, event_id: str, confirmed: bool) -> bool:
        """Update the confirmation status of an event."""
        pass
