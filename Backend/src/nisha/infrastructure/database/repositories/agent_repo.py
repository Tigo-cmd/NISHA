"""Agent repository implementation using SQLAlchemy."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from nisha.domain.models.agent import Agent, AgentMetrics
from nisha.domain.ports.agent_repository import AgentRepository
import logging
from nisha.infrastructure.database.models import AgentHistoryModel, AgentModel

logger = logging.getLogger(__name__)


def _model_to_domain(row: AgentModel) -> Agent:
    metrics_data = (row.metadata_ or {}).get("metrics", {})
    return Agent(
        agent_id=row.agent_id,
        short_id=row.short_id,
        status=row.status,
        master_id=row.master_id,
        capabilities=row.capabilities or {},
        config=row.config or {},
        location_zone=row.location_zone,
        gps_lat=float(row.gps_lat) if row.gps_lat is not None else None,
        gps_lng=float(row.gps_lng) if row.gps_lng is not None else None,
        firmware_version=row.firmware_version,
        last_heartbeat=row.last_heartbeat,
        metrics=AgentMetrics(**metrics_data) if metrics_data else AgentMetrics(),
        metadata=row.metadata_ or {},
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _domain_to_dict(agent: Agent) -> dict[str, Any]:
    meta = dict(agent.metadata)
    meta["metrics"] = {
        "battery_level": agent.metrics.battery_level,
        "signal_strength": agent.metrics.signal_strength,
        "temperature_c": agent.metrics.temperature_c,
        "free_heap_bytes": agent.metrics.free_heap_bytes,
        "cpu_usage_percent": agent.metrics.cpu_usage_percent,
    }
    return {
        "agent_id": agent.agent_id,
        "short_id": agent.short_id,
        "master_id": agent.master_id,
        "status": agent.status,
        "capabilities": agent.capabilities,
        "config": agent.config,
        "location_zone": agent.location_zone,
        "gps_lat": agent.gps_lat,
        "gps_lng": agent.gps_lng,
        "firmware_version": agent.firmware_version,
        "last_heartbeat": agent.last_heartbeat,
        "metadata": meta,
    }


class SqlAlchemyAgentRepository(AgentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, agent_id: str) -> Agent | None:
        result = await self._session.get(AgentModel, agent_id)
        return _model_to_domain(result) if result else None

    async def get_by_short_id(self, short_id: str) -> Agent | None:
        stmt = select(AgentModel).where(AgentModel.short_id == short_id)
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return _model_to_domain(row) if row else None

    async def list_all(
        self,
        *,
        status: str | None = None,
        master_id: str | None = None,
        location_zone: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Agent]:
        stmt = select(AgentModel)
        if status:
            stmt = stmt.where(AgentModel.status == status)
        if master_id:
            stmt = stmt.where(AgentModel.master_id == master_id)
        if location_zone:
            stmt = stmt.where(AgentModel.location_zone == location_zone)
        stmt = stmt.offset(offset).limit(limit).order_by(AgentModel.short_id)
        result = await self._session.execute(stmt)
        return [_model_to_domain(row) for row in result.scalars()]

    async def get_status_counts(self) -> dict[str, int]:
        stmt = select(AgentModel.status, func.count(AgentModel.agent_id)).group_by(AgentModel.status)
        result = await self._session.execute(stmt)
        return dict(result.all())

    async def count(
        self,
        *,
        status: str | None = None,
        master_id: str | None = None,
    ) -> int:
        stmt = select(func.count(AgentModel.agent_id))
        if status:
            stmt = stmt.where(AgentModel.status == status)
        if master_id:
            stmt = stmt.where(AgentModel.master_id == master_id)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def create(self, agent: Agent) -> Agent:
        data = _domain_to_dict(agent)
        model = AgentModel(**data)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return _model_to_domain(model)

    async def update(self, agent: Agent) -> Agent:
        model = await self._session.get(AgentModel, agent.agent_id)
        if not model:
            raise ValueError(f"Agent {agent.agent_id} not found")
        data = _domain_to_dict(agent)
        for key, value in data.items():
            if key == "metadata":
                setattr(model, "metadata_", value)
            else:
                setattr(model, key, value)
        model.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        await self._session.refresh(model)
        return _model_to_domain(model)

    async def delete(self, agent_id: str) -> bool:
        model = await self._session.get(AgentModel, agent_id)
        if not model:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def get_by_master(self, master_id: str) -> list[Agent]:
        return await self.list_all(master_id=master_id, limit=100)

    async def record_event(
        self,
        agent_id: str,
        event_type: str,
        data: dict[str, Any],
    ) -> None:
        event = AgentHistoryModel(
            agent_id=agent_id,
            event_type=event_type,
            data=data,
            server_received_at=datetime.now(timezone.utc),
        )
        self._session.add(event)
        await self._session.flush()

    async def get_history(
        self,
        agent_id: str,
        *,
        event_type: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        stmt = select(AgentHistoryModel).where(
            AgentHistoryModel.agent_id == agent_id
        )
        if event_type:
            stmt = stmt.where(AgentHistoryModel.event_type == event_type)
        stmt = stmt.order_by(AgentHistoryModel.timestamp.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [
            {
                "id": row.id,
                "agent_id": row.agent_id,
                "timestamp": row.timestamp.isoformat(),
                "event_type": row.event_type,
                "data": row.data,
            }
            for row in result.scalars()
        ]
    async def update_last_heartbeat(self, agent_id: str, master_id: str | None = None) -> bool:
        """Update last heartbeat and return True if status changed to ACTIVE."""
        model = await self._session.get(AgentModel, agent_id)
        now = datetime.now(timezone.utc)
        recovered = False
        
        if model:
            model.last_heartbeat = now
            if master_id:
                model.master_id = master_id
            
            # Auto-promote to ACTIVE if recovering from a disconnect
            from nisha.domain.models.enums import AgentStatus
            if model.status in (AgentStatus.OFFLINE.value, AgentStatus.DEGRADED.value):
                model.status = AgentStatus.ACTIVE.value
                recovered = True
                logger.info(f"Agent {agent_id} recovered to ACTIVE via heartbeat")
                
            model.updated_at = now
        else:
            # Auto-register agent if it doesn't exist
            from nisha.domain.models.enums import AgentStatus
            model = AgentModel(
                agent_id=agent_id,
                short_id=agent_id[-8:] if len(agent_id) > 8 else agent_id,
                status=AgentStatus.ACTIVE.value,
                master_id=master_id,
                last_heartbeat=now,
                created_at=now,
                updated_at=now,
                capabilities={"video": True, "audio": True, "gps": True},
                config={},
                location_zone="Unassigned",
                gps_lat=0.0,
                gps_lng=0.0,
                firmware_version="v1.0.0",
                metadata_={}
            )
            self._session.add(model)
            recovered = True
            
        return recovered
