"""Video detection domain events."""

from dataclasses import dataclass
from datetime import datetime

from nisha.domain.models.enums import BehaviorClass, VideoPriority


@dataclass(frozen=True)
class VideoEventDetected:
    event_id: str
    agent_id: str
    timestamp: datetime
    priority: VideoPriority
    behavior: BehaviorClass
    confidence: float
    location_zone: str | None = None
