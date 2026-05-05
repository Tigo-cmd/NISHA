"""Video REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from nisha.api.middleware.auth import verify_api_key
from nisha.api.schemas.video import VideoEventResponse, VideoPacket
from nisha.dependencies import get_video_service
from nisha.domain.models.enums import BehaviorClass, VideoPriority

router = APIRouter(prefix="/video", tags=["video"])


@router.post("/ingest", response_model=VideoEventResponse, status_code=status.HTTP_201_CREATED)
async def ingest_video_detection(
    packet: VideoPacket,
    _token: str = Depends(verify_api_key),
    video_svc=Depends(get_video_service),
):
    event = await video_svc.process_video_detection(
        agent_id=packet.agent_id,
        timestamp=packet.timestamp,
        priority=packet.priority,
        detection_data=packet.detection.model_dump(),
        frame_index=packet.frame_index,
        metadata=packet.metadata,
    )

    return VideoEventResponse(
        event_id=event.event_id,
        agent_id=event.agent_id,
        timestamp=event.timestamp,
        priority=event.priority,
        behavior=event.detection.behavior,
        confidence=event.detection.confidence,
        frame_index=event.frame_index,
        location_zone=event.location_zone,
        confirmed=event.confirmed,
        created_at=event.created_at,
    )


@router.get("/events", response_model=list[VideoEventResponse])
async def list_video_events(
    agent_id: str | None = None,
    priority: VideoPriority | None = None,
    behavior: BehaviorClass | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _token: str = Depends(verify_api_key),
    video_svc=Depends(get_video_service),
):
    events = await video_svc.list_events(
        agent_id=agent_id,
        priority=priority,
        behavior=behavior,
        offset=offset,
        limit=limit,
    )
    return [
        VideoEventResponse(
            event_id=e.event_id,
            agent_id=e.agent_id,
            timestamp=e.timestamp,
            priority=e.priority,
            behavior=e.detection.behavior,
            confidence=e.detection.confidence,
            frame_index=e.frame_index,
            location_zone=e.location_zone,
            confirmed=e.confirmed,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.get("/events/{event_id}", response_model=VideoEventResponse)
async def get_video_event(
    event_id: str,
    _token: str = Depends(verify_api_key),
    video_svc=Depends(get_video_service),
):
    event = await video_svc.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Video event {event_id} not found")

    return VideoEventResponse(
        event_id=event.event_id,
        agent_id=event.agent_id,
        timestamp=event.timestamp,
        priority=event.priority,
        behavior=event.detection.behavior,
        confidence=event.detection.confidence,
        frame_index=event.frame_index,
        location_zone=event.location_zone,
        confirmed=event.confirmed,
        created_at=event.created_at,
    )





@router.post("/events/{event_id}/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_video_event(
    event_id: str,
    confirmed: bool = True,
    _token: str = Depends(verify_api_key),
    video_svc=Depends(get_video_service),
):
    success = await video_svc.confirm_event(event_id, confirmed)
    if not success:
        raise HTTPException(status_code=404, detail=f"Video event {event_id} not found")
