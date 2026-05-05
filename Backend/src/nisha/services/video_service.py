"""Video application service."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from nisha.domain.events.video_events import VideoEventDetected
from nisha.domain.models.enums import BehaviorClass, EventType, VideoPriority
from nisha.domain.models.video import PoseKeypoints, VideoDetection, VideoEvent
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.event_bus import EventBus
from nisha.domain.ports.video_repository import VideoRepository


class VideoService:
    def __init__(
        self,
        video_repo: VideoRepository,
        agent_repo: AgentRepository,
        event_bus: EventBus,
    ) -> None:
        self._video = video_repo
        self._agents = agent_repo
        self._events = event_bus

    async def process_video_detection(
        self,
        agent_id: str,
        timestamp: datetime,
        priority: VideoPriority,
        detection_data: dict,
        frame_index: int = 0,
        metadata: dict | None = None,
    ) -> VideoEvent:
        agent = await self._agents.get_by_id(agent_id)
        location_zone = agent.location_zone if agent else None

        kp_data = detection_data.get("keypoints", {})
        keypoints = PoseKeypoints(
            keypoints=kp_data.get("keypoints", []),
            bbox=kp_data.get("bbox", []),
            person_confidence=kp_data.get("person_confidence", 0.0),
        )

        detection = VideoDetection(
            behavior=BehaviorClass(detection_data.get("behavior", "normal")),
            confidence=detection_data.get("confidence", 0.0),
            model_version=detection_data.get("model_version", ""),
            keypoints=keypoints,
        )

        event_id = str(uuid.uuid4())
        event = VideoEvent(
            event_id=event_id,
            agent_id=agent_id,
            timestamp=timestamp,
            priority=priority,
            detection=detection,
            frame_index=frame_index,
            location_zone=location_zone,
            metadata=metadata or {},
        )

        saved_event = await self._video.save_event(event)

        await self._agents.record_event(
            agent_id,
            EventType.ALERT,
            {
                "video_event_id": event_id,
                "behavior": detection.behavior.value,
                "priority": priority.value,
                "confidence": detection.confidence,
            },
        )

        await self._events.publish(
            VideoEventDetected(
                event_id=event_id,
                agent_id=agent_id,
                timestamp=timestamp,
                priority=priority,
                behavior=detection.behavior,
                confidence=detection.confidence,
                location_zone=location_zone,
            )
        )

        return saved_event

    async def get_event(self, event_id: str) -> VideoEvent | None:
        return await self._video.get_event(event_id)

    async def list_events(
        self,
        agent_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        priority: VideoPriority | None = None,
        behavior: BehaviorClass | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[VideoEvent]:
        return await self._video.list_events(
            agent_id=agent_id,
            start_time=start_time,
            end_time=end_time,
            priority=priority,
            behavior=behavior,
            limit=limit,
            offset=offset,
        )

    async def confirm_event(self, event_id: str, confirmed: bool = True) -> bool:
        return await self._video.update_event_status(event_id, confirmed)
