"""Pydantic schemas for Video API."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from nisha.domain.models.enums import BehaviorClass, VideoPriority


class PoseKeypointsSchema(BaseModel):
    keypoints: list[list[float]] = Field(default_factory=list)
    bbox: list[float] = Field(default_factory=list)
    person_confidence: float = 0.0


class VideoDetectionSchema(BaseModel):
    behavior: BehaviorClass
    confidence: float
    model_version: str = ""
    keypoints: PoseKeypointsSchema = Field(default_factory=PoseKeypointsSchema)


class VideoPacket(BaseModel):
    agent_id: str
    timestamp: datetime
    priority: VideoPriority
    detection: VideoDetectionSchema
    frame_index: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


class VideoEventResponse(BaseModel):
    event_id: str
    agent_id: str
    timestamp: datetime
    priority: VideoPriority
    behavior: BehaviorClass
    confidence: float
    frame_index: int
    location_zone: str | None = None
    confirmed: bool
    created_at: datetime
