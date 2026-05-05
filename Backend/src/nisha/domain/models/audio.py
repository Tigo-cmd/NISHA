"""Audio domain entities."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from nisha.domain.models.enums import AudioEventType, AudioLanguage, AudioPriority


@dataclass
class AudioFeatures:
    spectral_centroid: float | None = None
    zero_crossing_rate: float | None = None
    energy_db: float | None = None
    mfccs: list[float] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AudioDetection:
    type: str  # HARMFUL_SOUND, SPEECH_RECOGNITION, EMERGENCY_PATTERN
    class_name: AudioEventType
    confidence: float
    features: AudioFeatures = field(default_factory=AudioFeatures)


@dataclass
class AudioEvent:
    event_id: str
    agent_id: str
    timestamp: datetime
    priority: AudioPriority
    detection: AudioDetection
    audio_format: str | None = None
    sample_rate: int | None = 16000
    duration_ms: int | None = None
    audio_data: bytes | None = None  # Raw or compressed audio data
    transcription: str | None = None
    language: AudioLanguage | None = None
    location_zone: str | None = None
    confirmed: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class AudioTranscription:
    event_id: str
    text: str
    language: AudioLanguage
    confidence: float
    model_version: str
    processed_at: datetime = field(default_factory=lambda: datetime.now(UTC))
