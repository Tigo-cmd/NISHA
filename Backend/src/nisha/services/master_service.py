"""Master management application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from nisha.domain.events.agent_events import MasterStatusChanged
from nisha.domain.models.master import Master
from nisha.domain.models.enums import MasterStatus
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus
from nisha.domain.ports.master_repository import MasterRepository


class MasterService:
    def __init__(
        self,
        master_repo: MasterRepository,
        cache: Cache,
        event_bus: EventBus,
    ) -> None:
        self._masters = master_repo
        self._cache = cache
        self._events = event_bus

    async def register_master(
        self,
        master_id: str,
        name: str | None = None,
        ip_address: str | None = None,
        max_agents: int = 50,
        location_zone: str | None = None,
        gps_lat: float | None = None,
        gps_lng: float | None = None,
    ) -> Master:
        existing = await self._masters.get_by_id(master_id)
        if existing:
            raise ValueError(f"Master {master_id} already registered")

        master = Master(
            master_id=master_id,
            name=name,
            ip_address=ip_address,
            max_agents=max_agents,
            status=MasterStatus.ONLINE,
            location_zone=location_zone,
            gps_lat=gps_lat,
            gps_lng=gps_lng,
            last_seen=datetime.now(timezone.utc),
        )

        created = await self._masters.create(master)

        await self._cache.set_json(
            f"master:{master_id}:status",
            {"status": MasterStatus.ONLINE, "agent_count": 0},
            ttl_seconds=300,
        )

        return created

    async def get_master(self, master_id: str) -> Master | None:
        return await self._masters.get_by_id(master_id)

    async def list_masters(
        self,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Master]:
        return await self._masters.list_all(status=status, offset=offset, limit=limit)

    async def update_master_status(
        self,
        master_id: str,
        new_status: MasterStatus,
    ) -> Master:
        master = await self._masters.get_by_id(master_id)
        if not master:
            raise ValueError(f"Master {master_id} not found")

        old_status = master.status
        master.status = new_status.value
        master.last_seen = datetime.now(timezone.utc)
        updated = await self._masters.update(master)

        await self._cache.set_json(
            f"master:{master_id}:status",
            {"status": new_status.value, "agent_count": master.current_agent_count},
            ttl_seconds=300,
        )

        await self._events.publish(
            MasterStatusChanged(
                event_id=str(uuid.uuid4()),
                master_id=master_id,
                previous_status=old_status,
                new_status=new_status.value,
            )
        )

        return updated

    async def heartbeat(self, master_id: str, agent_count: int | None = None) -> Master:
        master = await self._masters.get_by_id(master_id)
        if not master:
            raise ValueError(f"Master {master_id} not found")

        master.last_seen = datetime.now(timezone.utc)
        if agent_count is not None:
            master.current_agent_count = agent_count
        return await self._masters.update(master)

    async def find_available_master(self, exclude: list[str] | None = None) -> Master | None:
        """Find the master with the most available capacity."""
        masters = await self._masters.list_all(status=MasterStatus.ONLINE)
        exclude_set = set(exclude or [])
        candidates = [m for m in masters if m.master_id not in exclude_set and m.has_capacity]
        if not candidates:
            return None
        return max(candidates, key=lambda m: m.available_slots)
