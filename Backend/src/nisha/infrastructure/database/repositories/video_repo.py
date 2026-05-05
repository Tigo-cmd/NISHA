"""SQLAlchemy implementation of VideoRepository."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from nisha.domain.models.enums import BehaviorClass, VideoPriority
from nisha.domain.models.video import PoseKeypoints, VideoDetection, VideoEvent
from nisha.domain.ports.video_repository import VideoRepository
from nisha.infrastructure.database.models import VideoEventModel


class SqlVideoRepository(VideoRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, model: VideoEventModel) -> VideoEvent:
        kp_data = model.keypoints or {}
        return VideoEvent(
            event_id=model.id,
            agent_id=model.agent_id,
            timestamp=model.timestamp,
            priority=VideoPriority(model.priority),
            detection=VideoDetection(
                behavior=BehaviorClass(model.behavior),
                confidence=float(model.confidence),
                model_version=model.model_version or "",
                keypoints=PoseKeypoints(
                    keypoints=kp_data.get("keypoints", []),
                    bbox=kp_data.get("bbox", []),
                    person_confidence=kp_data.get("person_confidence", 0.0),
                ),
            ),
            frame_index=model.frame_index or 0,
            location_zone=model.location_zone,
            confirmed=model.confirmed,
            metadata=model.metadata_ or {},
            created_at=model.created_at,
        )

    def _to_model(self, domain: VideoEvent) -> VideoEventModel:
        kp = domain.detection.keypoints
        return VideoEventModel(
            id=domain.event_id,
            agent_id=domain.agent_id,
            timestamp=domain.timestamp,
            priority=domain.priority.value,
            behavior=domain.detection.behavior.value,
            confidence=domain.detection.confidence,
            model_version=domain.detection.model_version,
            keypoints={
                "keypoints": kp.keypoints,
                "bbox": kp.bbox,
                "person_confidence": kp.person_confidence,
            },
            frame_index=domain.frame_index,
            location_zone=domain.location_zone,
            confirmed=domain.confirmed,
            metadata_=domain.metadata,
        )

    async def save_event(self, event: VideoEvent) -> VideoEvent:
        model = self._to_model(event)
        self.session.add(model)
        await self.session.flush()
        return self._to_domain(model)

    async def get_event(self, event_id: str) -> VideoEvent | None:
        stmt = select(VideoEventModel).where(VideoEventModel.id == event_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model else None

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
        stmt = (
            select(VideoEventModel)
            .order_by(VideoEventModel.timestamp.desc())
            .limit(limit)
            .offset(offset)
        )
        if agent_id:
            stmt = stmt.where(VideoEventModel.agent_id == agent_id)
        if start_time:
            stmt = stmt.where(VideoEventModel.timestamp >= start_time)
        if end_time:
            stmt = stmt.where(VideoEventModel.timestamp <= end_time)
        if priority:
            stmt = stmt.where(VideoEventModel.priority == priority.value)
        if behavior:
            stmt = stmt.where(VideoEventModel.behavior == behavior.value)

        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def update_event_status(self, event_id: str, confirmed: bool) -> bool:
        stmt = (
            update(VideoEventModel)
            .where(VideoEventModel.id == event_id)
            .values(confirmed=confirmed)
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0
