"""Audio REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from nisha.api.middleware.auth import verify_api_key
from nisha.api.schemas.audio import (
    AudioEventResponse,
    AudioPacket,
)
from nisha.dependencies import get_audio_service
from nisha.domain.models.enums import AudioEventType, AudioPriority

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/ingest", response_model=AudioEventResponse, status_code=status.HTTP_201_CREATED)
async def ingest_audio(
    packet: AudioPacket,
    _token: str = Depends(verify_api_key),
    audio_svc=Depends(get_audio_service),
):
    """Ingest an audio detection packet from an agent or master."""
    # decode audio data if present (it comes as base64 in AudioPacket schema)
    audio_bytes = None
    if packet.audio_data:
        import base64
        try:
            audio_bytes = base64.b64decode(packet.audio_data)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 audio data")

    event = await audio_svc.process_audio_packet(
        agent_id=packet.agent_id,
        timestamp=packet.timestamp,
        priority=packet.priority,
        detection_data=packet.detection.model_dump(),
        audio_data=audio_bytes,
        audio_format=packet.audio_format,
        sample_rate=packet.sample_rate,
        duration_ms=packet.duration_ms,
        metadata=packet.metadata,
    )

    return AudioEventResponse(
        event_id=event.event_id,
        agent_id=event.agent_id,
        timestamp=event.timestamp,
        priority=event.priority,
        event_type=event.detection.type,
        class_name=event.detection.class_name,
        confidence=event.detection.confidence,
        transcription=event.transcription,
        language=event.language,
        location_zone=event.location_zone,
        confirmed=event.confirmed,
        created_at=event.created_at,
    )


@router.get("/events", response_model=list[AudioEventResponse])
async def list_audio_events(
    agent_id: str | None = None,
    priority: AudioPriority | None = None,
    event_type: AudioEventType | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _token: str = Depends(verify_api_key),
    audio_svc=Depends(get_audio_service),
):
    """List audio events with filters."""
    events = await audio_svc.list_events(
        agent_id=agent_id,
        priority=priority,
        event_type=event_type,
        offset=offset,
        limit=limit,
    )
    return [
        AudioEventResponse(
            event_id=e.event_id,
            agent_id=e.agent_id,
            timestamp=e.timestamp,
            priority=e.priority,
            event_type=e.detection.type,
            class_name=e.detection.class_name,
            confidence=e.detection.confidence,
            transcription=e.transcription,
            language=e.language,
            location_zone=e.location_zone,
            confirmed=e.confirmed,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.get("/events/{event_id}", response_model=AudioEventResponse)
async def get_audio_event(
    event_id: str,
    _token: str = Depends(verify_api_key),
    audio_svc=Depends(get_audio_service),
):
    """Get a specific audio event."""
    event = await audio_svc.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Audio event {event_id} not found")

    return AudioEventResponse(
        event_id=event.event_id,
        agent_id=event.agent_id,
        timestamp=event.timestamp,
        priority=event.priority,
        event_type=event.detection.type,
        class_name=event.detection.class_name,
        confidence=event.detection.confidence,
        transcription=event.transcription,
        language=event.language,
        location_zone=event.location_zone,
        confirmed=event.confirmed,
        created_at=event.created_at,
    )





@router.post("/events/{event_id}/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_audio_event(
    event_id: str,
    confirmed: bool = True,
    _token: str = Depends(verify_api_key),
    audio_svc=Depends(get_audio_service),
):
    """Confirm or reject an audio event detection."""
    success = await audio_svc.confirm_event(event_id, confirmed)
    if not success:
        raise HTTPException(status_code=404, detail=f"Audio event {event_id} not found")
