"""Audio application service.

Handles ingestion, processing, and management of audio events.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from nisha.domain.events.audio_events import AudioEventDetected, AudioTranscriptionCompleted
from nisha.domain.models.audio import AudioDetection, AudioEvent, AudioFeatures, AudioTranscription
from nisha.domain.models.enums import AudioEventType, AudioLanguage, AudioPriority, EventType
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.audio_repository import AudioRepository
from nisha.domain.ports.event_bus import EventBus


class AudioService:
    def __init__(
        self,
        audio_repo: AudioRepository,
        agent_repo: AgentRepository,
        event_bus: EventBus,
    ) -> None:
        self._audio = audio_repo
        self._agents = agent_repo
        self._events = event_bus

    async def process_audio_packet(
        self,
        agent_id: str,
        timestamp: datetime,
        priority: AudioPriority,
        detection_data: dict,
        audio_data: bytes | None = None,
        audio_format: str | None = None,
        sample_rate: int = 16000,
        duration_ms: int | None = None,
        metadata: dict | None = None,
    ) -> AudioEvent:
        """Process an incoming audio packet from an agent or master."""
        agent = await self._agents.get_by_id(agent_id)
        location_zone = agent.location_zone if agent else None

        features_data = detection_data.get("features", {})
        features = AudioFeatures(
            spectral_centroid=features_data.get("spectral_centroid"),
            zero_crossing_rate=features_data.get("zero_crossing_rate"),
            energy_db=features_data.get("energy_db"),
            mfccs=features_data.get("mfccs", []),
            metadata=features_data.get("metadata", {}),
        )

        detection = AudioDetection(
            type=detection_data.get("type", "UNKNOWN"),
            class_name=AudioEventType(detection_data.get("class_name") or detection_data.get("class", "ambient")),
            confidence=detection_data.get("confidence", 0.0),
            features=features,
        )

        event_id = str(uuid.uuid4())
        event = AudioEvent(
            event_id=event_id,
            agent_id=agent_id,
            timestamp=timestamp,
            priority=priority,
            detection=detection,
            audio_format=audio_format,
            sample_rate=sample_rate,
            duration_ms=duration_ms,
            audio_data=audio_data,
            location_zone=location_zone,
            metadata=metadata or {},
        )

        saved_event = await self._audio.save_event(event)

        # Record event in agent history
        await self._agents.record_event(
            agent_id,
            EventType.ALERT,
            {
                "audio_event_id": event_id,
                "type": detection.class_name.value,
                "priority": priority.value,
                "confidence": detection.confidence,
            },
        )

        # Publish domain event
        await self._events.publish(
            AudioEventDetected(
                event_id=event_id,
                agent_id=agent_id,
                timestamp=timestamp,
                priority=priority,
                class_name=detection.class_name,
                confidence=detection.confidence,
                location_zone=location_zone,
            )
        )

        # Trigger automatic transcription for speech if confidence is high enough
        if detection.class_name == AudioEventType.SPEECH and detection.confidence > 0.7:
            # In a real system, this would be an async task
            pass

        return saved_event

    async def get_event(self, event_id: str) -> AudioEvent | None:
        return await self._audio.get_event(event_id)

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
        return await self._audio.list_events(
            agent_id=agent_id,
            start_time=start_time,
            end_time=end_time,
            priority=priority,
            event_type=event_type,
            limit=limit,
            offset=offset,
        )

    async def add_transcription(
        self,
        event_id: str,
        text: str,
        language: AudioLanguage,
        confidence: float,
        model_version: str,
    ) -> AudioTranscription:
        event = await self._audio.get_event(event_id)
        if not event:
            raise ValueError(f"Audio event {event_id} not found")

        transcription = AudioTranscription(
            event_id=event_id,
            text=text,
            language=language,
            confidence=confidence,
            model_version=model_version,
        )

        saved = await self._audio.save_transcription(transcription)

        # Update event with transcription
        # Note: In a more complex system, we might want a separate update_event method
        # For now, we expect the port to handle the link if needed, or we just provide
        # it via response fusion

        await self._events.publish(
            AudioTranscriptionCompleted(
                event_id=event_id,
                agent_id=event.agent_id,
                text=text,
                language=language.value,
                confidence=confidence,
            )
        )

        return saved

    async def confirm_event(self, event_id: str, confirmed: bool = True) -> bool:
        return await self._audio.update_event_status(event_id, confirmed)
