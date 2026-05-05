"""Pydantic schemas for Audio API."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from nisha.domain.models.enums import AudioEventType, AudioLanguage, AudioPriority


class AudioFeaturesSchema(BaseModel):
    spectral_centroid: float | None = None
    zero_crossing_rate: float | None = None
    energy_db: float | None = None
    mfccs: list[float] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AudioDetectionSchema(BaseModel):
    type: str  # HARMFUL_SOUND, SPEECH_RECOGNITION, EMERGENCY_PATTERN
    class_name: AudioEventType
    confidence: float
    features: AudioFeaturesSchema = Field(default_factory=AudioFeaturesSchema)


class AudioPacket(BaseModel):
    agent_id: str
    timestamp: datetime
    priority: AudioPriority
    detection: AudioDetectionSchema
    audio_format: str | None = None
    sample_rate: int | None = 16000
    duration_ms: int | None = None
    audio_data: str | None = None  # Base64 encoded audio
    metadata: dict[str, Any] = Field(default_factory=dict)


class AudioEventResponse(BaseModel):
    event_id: str
    agent_id: str
    timestamp: datetime
    priority: AudioPriority
    event_type: str
    class_name: AudioEventType
    confidence: float
    transcription: str | None = None
    language: AudioLanguage | None = None
    location_zone: str | None = None
    confirmed: bool
    created_at: datetime


class AudioTranscriptionSchema(BaseModel):
    event_id: str
    text: str
    language: AudioLanguage
    confidence: float
    model_version: str
    processed_at: datetime
