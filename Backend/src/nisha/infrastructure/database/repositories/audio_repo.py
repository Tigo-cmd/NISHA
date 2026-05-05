"""SQLAlchemy implementation of AudioRepository."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from nisha.domain.models.audio import AudioDetection, AudioEvent, AudioFeatures, AudioTranscription
from nisha.domain.models.enums import AudioEventType, AudioLanguage, AudioPriority
from nisha.domain.ports.audio_repository import AudioRepository
from nisha.infrastructure.database.models import AudioEventModel, AudioTranscriptionModel


class SqlAudioRepository(AudioRepository):
    """PostgreSQL implementation of AudioRepository."""

    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, model: AudioEventModel) -> AudioEvent:
        # Graceful priority mapping for legacy data
        priority_val = model.priority
        priority_map = {"CRITICAL": "1", "HIGH": "2", "MEDIUM": "3", "LOW": "4", "EVENT": "2"}
        priority_val = priority_map.get(priority_val, priority_val)
        if priority_val not in ["1", "2", "3", "4"]:
            priority_val = "4"  # Fallback to LOW

        # Graceful class mapping for legacy data
        class_val = model.class_name
        class_map = {"AmbientNoise": "ambient", "VoicePattern": "speech"}
        class_val = class_map.get(class_val, class_val)
        try:
            audio_type = AudioEventType(class_val)
        except ValueError:
            audio_type = AudioEventType.AMBIENT

        return AudioEvent(
            event_id=model.id,
            agent_id=model.agent_id,
            timestamp=model.timestamp,
            priority=AudioPriority(priority_val),
            detection=AudioDetection(
                type=model.event_type,
                class_name=audio_type,
                confidence=float(model.confidence),
                features=AudioFeatures(**model.features) if model.features else AudioFeatures(),
            ),
            audio_format=model.audio_format,
            sample_rate=model.sample_rate,
            duration_ms=model.duration_ms,
            # audio_data is not stored in DB directly for performance, usually in S3/Files
            transcription=model.transcription,
            language=AudioLanguage(model.language) if model.language else None,
            location_zone=model.location_zone,
            confirmed=model.confirmed,
            metadata=model.metadata_ or {},
            created_at=model.created_at,
        )

    def _to_model(self, domain: AudioEvent) -> AudioEventModel:
        return AudioEventModel(
            id=domain.event_id,
            agent_id=domain.agent_id,
            timestamp=domain.timestamp,
            priority=domain.priority.value,
            event_type=domain.detection.type,
            class_name=domain.detection.class_name.value,
            confidence=domain.detection.confidence,
            features=vars(domain.detection.features) if domain.detection.features else None,
            audio_format=domain.audio_format,
            sample_rate=domain.sample_rate,
            duration_ms=domain.duration_ms,
            transcription=domain.transcription,
            language=domain.language.value if domain.language else None,
            location_zone=domain.location_zone,
            confirmed=domain.confirmed,
            metadata_=domain.metadata,
        )

    async def save_event(self, event: AudioEvent) -> AudioEvent:
        model = self._to_model(event)
        self.session.add(model)
        await self.session.flush()
        return self._to_domain(model)

    async def get_event(self, event_id: str) -> AudioEvent | None:
        stmt = select(AudioEventModel).where(AudioEventModel.id == event_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model else None

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
        stmt = (
            select(AudioEventModel)
            .order_by(AudioEventModel.timestamp.desc())
            .limit(limit)
            .offset(offset)
        )
        if agent_id:
            stmt = stmt.where(AudioEventModel.agent_id == agent_id)
        if start_time:
            stmt = stmt.where(AudioEventModel.timestamp >= start_time)
        if end_time:
            stmt = stmt.where(AudioEventModel.timestamp <= end_time)
        if priority:
            stmt = stmt.where(AudioEventModel.priority == priority.value)
        if event_type:
            stmt = stmt.where(AudioEventModel.class_name == event_type.value)

        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def save_transcription(self, transcription: AudioTranscription) -> AudioTranscription:
        model = AudioTranscriptionModel(
            event_id=transcription.event_id,
            text=transcription.text,
            language=transcription.language.value,
            confidence=transcription.confidence,
            model_version=transcription.model_version,
            processed_at=transcription.processed_at,
        )
        self.session.add(model)
        await self.session.flush()
        return transcription

    async def get_transcription(self, event_id: str) -> AudioTranscription | None:
        stmt = select(AudioTranscriptionModel).where(AudioTranscriptionModel.event_id == event_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return AudioTranscription(
            event_id=model.event_id,
            text=model.text,
            language=AudioLanguage(model.language),
            confidence=float(model.confidence),
            model_version=model.model_version,
            processed_at=model.processed_at,
        )

    async def update_event_status(self, event_id: str, confirmed: bool) -> bool:
        stmt = (
            update(AudioEventModel)
            .where(AudioEventModel.id == event_id)
            .values(confirmed=confirmed)
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0
