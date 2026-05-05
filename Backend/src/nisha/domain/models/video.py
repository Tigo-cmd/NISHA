"""Video detection domain entities."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from nisha.domain.models.enums import BehaviorClass, VideoPriority


@dataclass
class PoseKeypoints:
    keypoints: list[list[float]] = field(default_factory=list)
    bbox: list[float] = field(default_factory=list)
    person_confidence: float = 0.0


@dataclass
class VideoDetection:
    behavior: BehaviorClass
    confidence: float
    model_version: str = ""
    keypoints: PoseKeypoints = field(default_factory=PoseKeypoints)


@dataclass
class VideoEvent:
    event_id: str
    agent_id: str
    timestamp: datetime
    priority: VideoPriority
    detection: VideoDetection
    frame_index: int = 0
    location_zone: str | None = None
    confirmed: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
