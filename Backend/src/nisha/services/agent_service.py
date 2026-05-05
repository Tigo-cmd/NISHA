"""Agent management application service.

Orchestrates agent lifecycle operations: registration, heartbeats, state changes.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from nisha.domain.events.agent_events import (
    AgentHeartbeatReceived,
    AgentRegistered,
    AgentStateChanged,
)
from nisha.domain.models.agent import Agent, AgentMetrics
from nisha.domain.models.enums import AgentStatus, EventType
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus
from nisha.domain.ports.master_repository import MasterRepository
from nisha.domain.services.health import evaluate_health
from nisha.domain.services.lifecycle import evaluate_heartbeat_status, validate_transition


class AgentService:
    def __init__(
        self,
        agent_repo: AgentRepository,
        master_repo: MasterRepository,
        cache: Cache,
        event_bus: EventBus,
    ) -> None:
        self._agents = agent_repo
        self._masters = master_repo
        self._cache = cache
        self._events = event_bus

    async def register_agent(
        self,
        agent_id: str,
        master_id: str | None = None,
        capabilities: dict[str, Any] | None = None,
        firmware_version: str | None = None,
        hardware_type: str | None = None,
        stream_url: str | None = None,
        location_zone: str | None = None,
        gps_lat: float | None = None,
        gps_lng: float | None = None,
    ) -> Agent:
        if master_id:
            master = await self._masters.get_by_id(master_id)
            if not master:
                raise ValueError(f"Master {master_id} not found")
            if not master.has_capacity:
                raise ValueError(f"Master {master_id} at capacity ({master.current_agent_count}/{master.max_agents})")

        existing = await self._agents.get_by_id(agent_id)
        if existing:
            # Upsert behavior: update the existing agent
            existing.master_id = master_id
            existing.capabilities = capabilities
            existing.status = AgentStatus.ACTIVE
            existing.last_heartbeat = datetime.now(timezone.utc)
            if firmware_version:
                existing.firmware_version = firmware_version
            if hardware_type:
                existing.hardware_type = hardware_type
            if stream_url:
                existing.stream_url = stream_url
            if location_zone:
                existing.location_zone = location_zone
            if gps_lat is not None:
                existing.gps_lat = gps_lat
            if gps_lng is not None:
                existing.gps_lng = gps_lng

            updated = await self._agents.update(existing)

            # Cache runtime state
            await self._cache.set_json(
                f"agent:{agent_id}:status",
                {"status": AgentStatus.ACTIVE, "master_id": master_id},
                ttl_seconds=120,
            )

            await self._agents.record_event(
                agent_id, EventType.REGISTRATION, {"master_id": master_id, "capabilities": capabilities, "note": "re-registration"}
            )
            return updated

        agent_count = await self._agents.count()
        short_id = f"A-{agent_count + 1:03d}"

        agent = Agent(
            agent_id=agent_id,
            short_id=short_id,
            status=AgentStatus.ACTIVE,
            master_id=master_id,
            capabilities=capabilities or {},
            firmware_version=firmware_version,
            hardware_type=hardware_type,
            stream_url=stream_url,
            location_zone=location_zone,
            gps_lat=gps_lat,
            gps_lng=gps_lng,
            last_heartbeat=datetime.now(timezone.utc),
        )

        created = await self._agents.create(agent)
        
        if master_id:
            await self._masters.increment_agent_count(master_id, 1)

        # Cache runtime state
        await self._cache.set_json(
            f"agent:{agent_id}:status",
            {"status": AgentStatus.ACTIVE, "master_id": master_id},
            ttl_seconds=120,
        )

        # Record event
        await self._agents.record_event(
            agent_id, EventType.REGISTRATION, {"master_id": master_id, "capabilities": capabilities}
        )

        await self._events.publish(
            AgentRegistered(
                event_id=str(uuid.uuid4()),
                agent_id=agent_id,
                master_id=master_id or "ORPHANED",
                capabilities=capabilities or {},
            )
        )

        return created

    async def process_heartbeat(
        self,
        agent_id: str,
        metrics: dict[str, Any],
        sequence: int = 0,
    ) -> dict[str, Any]:
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        now = datetime.now(timezone.utc)
        agent_metrics = AgentMetrics(
            battery_level=metrics.get("battery_level", 100),
            signal_strength=metrics.get("signal_strength", -40),
            temperature_c=metrics.get("temperature_c", 25.0),
            free_heap_bytes=metrics.get("free_heap_bytes", 65536),
            cpu_usage_percent=metrics.get("cpu_usage_percent", 0),
        )

        # Evaluate health
        health_report = evaluate_health(agent_id, agent_metrics)

        # Update agent state
        agent.last_heartbeat = now
        agent.metrics = agent_metrics
        new_status = evaluate_heartbeat_status(AgentStatus(agent.status), missed_count=0)
        old_status = agent.status

        if new_status.value != old_status:
            validate_transition(AgentStatus(old_status), new_status)
            agent.status = new_status.value
            await self._events.publish(
                AgentStateChanged(
                    event_id=str(uuid.uuid4()),
                    agent_id=agent_id,
                    previous_status=old_status,
                    new_status=new_status.value,
                    reason="heartbeat_recovery",
                )
            )

        await self._agents.update(agent)

        # Update cache
        await self._cache.set_json(
            f"agent:{agent_id}:status",
            {"status": agent.status, "master_id": agent.master_id, "last_heartbeat": now.isoformat()},
            ttl_seconds=120,
        )
        await self._cache.set(f"agent:{agent_id}:missed_heartbeats", "0", ttl_seconds=120)

        await self._events.publish(
            AgentHeartbeatReceived(
                event_id=str(uuid.uuid4()),
                agent_id=agent_id,
                master_id=agent.master_id or "",
                metrics=metrics,
                sequence=sequence,
            )
        )

        return {
            "agent_id": agent_id,
            "status": agent.status,
            "health": health_report.overall.value,
            "checks": [
                {"metric": c.metric, "level": c.level.value, "message": c.message}
                for c in health_report.checks
            ],
        }

    async def update_agent_status(
        self,
        agent_id: str,
        new_status: AgentStatus,
        reason: str = "",
    ) -> Agent:
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        old_status = agent.status
        validate_transition(AgentStatus(old_status), new_status)
        agent.status = new_status.value
        agent.updated_at = datetime.now(timezone.utc)

        updated = await self._agents.update(agent)

        await self._cache.set_json(
            f"agent:{agent_id}:status",
            {"status": new_status.value, "master_id": agent.master_id},
            ttl_seconds=120,
        )

        await self._agents.record_event(
            agent_id,
            EventType.STATE_CHANGE,
            {"from": old_status, "to": new_status.value, "reason": reason},
        )

        await self._events.publish(
            AgentStateChanged(
                event_id=str(uuid.uuid4()),
                agent_id=agent_id,
                previous_status=old_status,
                new_status=new_status.value,
                reason=reason,
            )
        )

        return updated

    async def get_agent(self, agent_id: str) -> Agent | None:
        return await self._agents.get_by_id(agent_id)

    async def get_agent_by_short_id(self, short_id: str) -> Agent | None:
        return await self._agents.get_by_short_id(short_id)

    async def get_agent_status_counts(self) -> dict[str, int]:
        return await self._agents.get_status_counts()

    async def list_agents(
        self,
        *,
        status: str | None = None,
        master_id: str | None = None,
        location_zone: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Agent], int]:
        agents = await self._agents.list_all(
            status=status, master_id=master_id, location_zone=location_zone,
            offset=offset, limit=limit,
        )
        total = await self._agents.count(status=status, master_id=master_id)
        return agents, total

    async def delete_agent(self, agent_id: str) -> bool:
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            return False
        if agent.master_id:
            await self._masters.increment_agent_count(agent.master_id, -1)
        await self._cache.delete(f"agent:{agent_id}:status")
        await self._cache.delete(f"agent:{agent_id}:missed_heartbeats")
        
        success = await self._agents.delete(agent_id)
        if success:
            from nisha.domain.events.agent_events import AgentDeleted
            await self._events.publish(AgentDeleted(agent_id=agent_id))
        return success

    async def get_agent_history(
        self,
        agent_id: str,
        *,
        event_type: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        return await self._agents.get_history(
            agent_id, event_type=event_type, offset=offset, limit=limit
        )

    async def update_agent_config(
        self,
        agent_id: str,
        config: dict[str, Any],
    ) -> Agent:
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        now = datetime.now(timezone.utc)
        agent.config = {**agent.config, **config}
        agent.updated_at = now
        agent.last_heartbeat = now

        # Recovery logic: if it was OFFLINE/DEGRADED, a successful config update (heartbeat) restores it
        from nisha.domain.services.lifecycle import evaluate_heartbeat_status
        new_status = evaluate_heartbeat_status(AgentStatus(agent.status), missed_count=0)

        if new_status.value != agent.status:
            old_status = agent.status
            agent.status = new_status.value
            await self._cache.delete(f"agent:{agent_id}:missed_heartbeats")
            await self._cache.set_json(
                f"agent:{agent_id}:status",
                {"status": new_status.value, "master_id": agent.master_id},
                ttl_seconds=120,
            )
            await self._agents.record_event(
                agent_id,
                "state_change",
                {
                    "from": old_status,
                    "to": new_status.value,
                    "reason": "heartbeat_recovered",
                },
            )

        return await self._agents.update(agent)
