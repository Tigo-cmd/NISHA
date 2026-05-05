"""Master failover and agent redistribution service.

Handles master failures per PRD:
- Detect master offline via missed heartbeats
- Redistribute agents from failed master to available masters
- Update routing tables
- Send alerts
- Handle recovery when master comes back online

Scaling triggers from PRD Section 11.3:
- Master CPU > 70% sustained 2 min → Add new master
- Master agent count > 45 → Rebalance agents
- Server connection pool > 80% → Scale horizontally
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from nisha.domain.events.agent_events import AgentStateChanged, MasterStatusChanged
from nisha.domain.models.enums import AgentStatus, MasterStatus
from nisha.domain.models.master import MeshRoute
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus
from nisha.domain.ports.master_repository import MasterRepository
from nisha.infrastructure.websocket.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

MASTER_HEARTBEAT_TIMEOUT = 60  # Seconds before master is considered offline
REBALANCE_THRESHOLD = 45  # Agent count per master triggering rebalance


class FailoverService:
    def __init__(
        self,
        agent_repo: AgentRepository,
        master_repo: MasterRepository,
        cache: Cache,
        event_bus: EventBus,
        connection_manager: ConnectionManager | None = None,
    ) -> None:
        self._agents = agent_repo
        self._masters = master_repo
        self._cache = cache
        self._events = event_bus
        self._ws = connection_manager

    async def check_masters(self) -> list[dict[str, Any]]:
        """Check all masters for health and trigger failover if needed."""
        now = datetime.now(timezone.utc)
        masters = await self._masters.list_all()
        issues: list[dict[str, Any]] = []

        for master in masters:
            if master.status == MasterStatus.MAINTENANCE:
                continue

            # Check heartbeat timeout
            if master.last_seen:
                elapsed = (now - master.last_seen).total_seconds()
                if elapsed > MASTER_HEARTBEAT_TIMEOUT and master.status == MasterStatus.ONLINE:
                    issue = await self._handle_master_offline(master.master_id)
                    issues.append(issue)

            # Check overload
            if master.current_agent_count >= REBALANCE_THRESHOLD and master.status == MasterStatus.ONLINE:
                issues.append({
                    "master_id": master.master_id,
                    "type": "overload",
                    "agent_count": master.current_agent_count,
                    "threshold": REBALANCE_THRESHOLD,
                })

        return issues

    async def _handle_master_offline(self, master_id: str) -> dict[str, Any]:
        """Handle a master going offline: redistribute its agents."""
        master = await self._masters.get_by_id(master_id)
        if not master:
            return {"master_id": master_id, "type": "not_found"}

        old_status = master.status
        master.status = MasterStatus.OFFLINE
        await self._masters.update(master)

        await self._events.publish(
            MasterStatusChanged(
                event_id=str(uuid.uuid4()),
                master_id=master_id,
                previous_status=old_status,
                new_status=MasterStatus.OFFLINE,
            )
        )

        # Get all agents under this master
        agents = await self._agents.get_by_master(master_id)
        if not agents:
            return {
                "master_id": master_id,
                "type": "offline",
                "agents_affected": 0,
                "agents_relocated": 0,
            }

        # Find available masters
        available = await self._masters.list_all(status=MasterStatus.ONLINE)
        targets = [m for m in available if m.master_id != master_id and m.has_capacity]

        relocated = 0
        orphaned = 0

        for agent in agents:
            if not targets:
                # No capacity anywhere -- mark agent OFFLINE
                agent.status = AgentStatus.OFFLINE
                agent.updated_at = datetime.now(timezone.utc)
                await self._agents.update(agent)
                orphaned += 1
                continue

            # Find master with most capacity
            best_target = max(targets, key=lambda m: m.available_slots)
            if best_target.available_slots <= 0:
                agent.status = AgentStatus.OFFLINE
                agent.updated_at = datetime.now(timezone.utc)
                await self._agents.update(agent)
                orphaned += 1
                continue

            # Relocate agent
            agent.master_id = best_target.master_id
            agent.status = AgentStatus.DEGRADED  # Mark degraded until confirmed
            agent.updated_at = datetime.now(timezone.utc)
            await self._agents.update(agent)

            await self._masters.increment_agent_count(best_target.master_id, 1)
            await self._masters.increment_agent_count(master_id, -1)
            best_target.current_agent_count += 1

            # Update route
            route = MeshRoute(
                source_node=agent.agent_id,
                target_node=best_target.master_id,
                hop_count=1,
                signal_strength=-60,
                active=True,
            )
            await self._masters.upsert_mesh_route(route)

            # Record event
            await self._agents.record_event(
                agent.agent_id,
                "failover",
                {
                    "from_master": master_id,
                    "to_master": best_target.master_id,
                    "reason": "master_offline",
                },
            )

            await self._events.publish(
                AgentStateChanged(
                    event_id=str(uuid.uuid4()),
                    agent_id=agent.agent_id,
                    previous_status=AgentStatus.ACTIVE,
                    new_status=AgentStatus.DEGRADED,
                    reason=f"failover_from_{master_id}",
                )
            )

            relocated += 1

        # Broadcast alert
        if self._ws:
            await self._ws.broadcast(
                {
                    "type": "MASTER_OFFLINE",
                    "master_id": master_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "payload": {
                        "agents_affected": len(agents),
                        "agents_relocated": relocated,
                        "agents_orphaned": orphaned,
                    },
                }
            )

        logger.warning(
            "Master %s went OFFLINE: %d agents affected, %d relocated, %d orphaned",
            master_id, len(agents), relocated, orphaned,
        )

        return {
            "master_id": master_id,
            "type": "offline",
            "agents_affected": len(agents),
            "agents_relocated": relocated,
            "agents_orphaned": orphaned,
        }

    async def handle_master_recovery(self, master_id: str) -> dict[str, Any]:
        """Handle a master coming back online after failover."""
        master = await self._masters.get_by_id(master_id)
        if not master:
            raise ValueError(f"Master {master_id} not found")

        if master.status != MasterStatus.OFFLINE:
            return {"master_id": master_id, "status": "already_online"}

        old_status = master.status
        master.status = MasterStatus.ONLINE
        master.last_seen = datetime.now(timezone.utc)
        await self._masters.update(master)

        await self._events.publish(
            MasterStatusChanged(
                event_id=str(uuid.uuid4()),
                master_id=master_id,
                previous_status=old_status,
                new_status=MasterStatus.ONLINE,
            )
        )

        if self._ws:
            await self._ws.broadcast(
                {
                    "type": "MASTER_ONLINE",
                    "master_id": master_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

        logger.info("Master %s recovered and is back ONLINE", master_id)

        return {
            "master_id": master_id,
            "status": "recovered",
            "available_slots": master.available_slots,
        }
