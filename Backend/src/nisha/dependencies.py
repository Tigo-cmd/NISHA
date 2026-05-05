"""FastAPI dependency injection wiring."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus
from nisha.infrastructure.cache.redis_cache import RedisCache
from nisha.infrastructure.database.repositories.agent_repo import SqlAlchemyAgentRepository
from nisha.infrastructure.database.repositories.command_repo import SqlAlchemyCommandRepository
from nisha.infrastructure.database.repositories.master_repo import SqlAlchemyMasterRepository
from nisha.infrastructure.database.session import get_session
from nisha.infrastructure.messaging.event_bus import InProcessEventBus
from nisha.infrastructure.database.repositories.audio_repo import SqlAudioRepository
from nisha.infrastructure.database.repositories.video_repo import SqlVideoRepository
from nisha.services.agent_service import AgentService
from nisha.services.audio_service import AudioService
from nisha.services.command_service import CommandService
from nisha.services.config_service import ConfigService
from nisha.services.handoff_service import HandoffService
from nisha.services.master_service import MasterService
from nisha.services.topology_service import TopologyService
from nisha.services.video_service import VideoService

# Singletons initialized at startup
_event_bus: InProcessEventBus | None = None
_cache: Cache | None = None


def init_singletons(event_bus: InProcessEventBus, cache: Cache) -> None:
    global _event_bus, _cache
    _event_bus = event_bus
    _cache = cache


def get_event_bus() -> EventBus:
    assert _event_bus is not None, "Event bus not initialized"
    return _event_bus


def get_cache() -> Cache:
    assert _cache is not None, "Cache not initialized"
    return _cache


async def get_agent_service(
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
    event_bus: EventBus = Depends(get_event_bus),
) -> AgentService:
    agent_repo = SqlAlchemyAgentRepository(session)
    master_repo = SqlAlchemyMasterRepository(session)
    return AgentService(agent_repo, master_repo, cache, event_bus)


async def get_master_service(
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
    event_bus: EventBus = Depends(get_event_bus),
) -> MasterService:
    master_repo = SqlAlchemyMasterRepository(session)
    return MasterService(master_repo, cache, event_bus)


async def get_command_service(
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
    event_bus: EventBus = Depends(get_event_bus),
) -> CommandService:
    cmd_repo = SqlAlchemyCommandRepository(session)
    agent_repo = SqlAlchemyAgentRepository(session)
    return CommandService(cmd_repo, agent_repo, cache, event_bus)


async def get_topology_service(
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
) -> TopologyService:
    agent_repo = SqlAlchemyAgentRepository(session)
    master_repo = SqlAlchemyMasterRepository(session)
    return TopologyService(agent_repo, master_repo, cache)


async def get_handoff_service(
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
    event_bus: EventBus = Depends(get_event_bus),
) -> HandoffService:
    agent_repo = SqlAlchemyAgentRepository(session)
    master_repo = SqlAlchemyMasterRepository(session)
    return HandoffService(agent_repo, master_repo, cache, event_bus)


async def get_config_service(
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
    event_bus: EventBus = Depends(get_event_bus),
) -> ConfigService:
    agent_repo = SqlAlchemyAgentRepository(session)
    return ConfigService(agent_repo, cache, event_bus)


async def get_audio_service(
    session: AsyncSession = Depends(get_session),
    event_bus: EventBus = Depends(get_event_bus),
) -> AudioService:
    audio_repo = SqlAudioRepository(session)
    agent_repo = SqlAlchemyAgentRepository(session)
    return AudioService(audio_repo, agent_repo, event_bus)


async def get_video_service(
    session: AsyncSession = Depends(get_session),
    event_bus: EventBus = Depends(get_event_bus),
) -> VideoService:
    video_repo = SqlVideoRepository(session)
    agent_repo = SqlAlchemyAgentRepository(session)
    return VideoService(video_repo, agent_repo, event_bus)
