"""Heartbeat monitoring background service.

Runs as an async background task during app lifespan.
Monitors agent heartbeat timestamps and transitions agents through
DEGRADED → OFFLINE states per PRD Section 5.3:

MISSED HEARTBEAT 1: Mark DEGRADED, increment counter
MISSED HEARTBEAT 2: Mark DEGRADED, attempt direct ping
MISSED HEARTBEAT 3: Mark OFFLINE, remove from mesh routing, notify server

RECOVERY: Agent sends heartbeat after gap → mark ACTIVE, full state sync
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from nisha.domain.events.agent_events import AgentStateChanged
from nisha.domain.models.enums import AgentStatus
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus
from nisha.domain.services.lifecycle import evaluate_heartbeat_status
from nisha.infrastructure.websocket.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

# How often the monitor runs its check cycle
MONITOR_INTERVAL_SECONDS = 10

# Per PRD: 30s heartbeat interval, 90s timeout (3 missed)
HEARTBEAT_INTERVAL = 30
HEARTBEAT_TIMEOUT = 90
# Jitter grace period to prevent toggling
HEARTBEAT_GRACE_PERIOD = 15


class HeartbeatMonitor:
    def __init__(
        self,
        session_factory,
        cache: Cache,
        event_bus: EventBus,
        connection_manager: ConnectionManager | None = None,
        on_cycle_complete=None,
    ) -> None:
        self._session_factory = session_factory
        self._cache = cache
        self._events = event_bus
        self._ws = connection_manager
        self._on_cycle_complete = on_cycle_complete
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the heartbeat monitor as a background task."""
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info("Heartbeat monitor started (interval=%ds)", MONITOR_INTERVAL_SECONDS)

    async def stop(self) -> None:
        """Stop the heartbeat monitor gracefully."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Heartbeat monitor stopped")

    async def _monitor_loop(self) -> None:
        """Main monitor loop: checks all active/degraded agents for missed heartbeats."""
        while self._running:
            try:
                await self._check_agents()
                await self._broadcast_system_status()
                
                if self._on_cycle_complete:
                    await self._on_cycle_complete()
            except Exception:
                logger.exception("Heartbeat monitor check failed")
            await asyncio.sleep(MONITOR_INTERVAL_SECONDS)

    async def _check_agents(self) -> None:
        """Check all connected agents for missed heartbeats using a fresh session."""
        from nisha.infrastructure.database.repositories.agent_repo import SqlAlchemyAgentRepository
        from nisha.domain.models.enums import AgentStatus

        now = datetime.now(timezone.utc)

        async with self._session_factory() as session:
            agent_repo = SqlAlchemyAgentRepository(session)
            
            # Get all agents that should be sending heartbeats
            try:
                active_agents = await agent_repo.list_all(status=AgentStatus.ACTIVE, limit=500)
                degraded_agents = await agent_repo.list_all(status=AgentStatus.DEGRADED, limit=500)
                offline_agents = await agent_repo.list_all(status=AgentStatus.OFFLINE, limit=500)
            except Exception as e:
                logger.error(f"Error fetching agents in heartbeat monitor: {e}")
                return

            all_connected = active_agents + degraded_agents + offline_agents

            for agent in all_connected:
                if agent.last_heartbeat is None:
                    continue

                elapsed = (now - agent.last_heartbeat).total_seconds()
                
                if elapsed < HEARTBEAT_INTERVAL + HEARTBEAT_GRACE_PERIOD:
                    missed_count = 0
                else:
                    missed_count = int((elapsed - HEARTBEAT_GRACE_PERIOD) // HEARTBEAT_INTERVAL)

                if missed_count == 0 and agent.status == AgentStatus.ACTIVE.value:
                    continue

                new_status = evaluate_heartbeat_status(
                    AgentStatus(agent.status), missed_count
                )

                if new_status.value == agent.status:
                    continue

                # State has changed -- apply transition
                old_status = agent.status
                agent.status = new_status.value
                agent.updated_at = now

                try:
                    await agent_repo.update(agent)
                    await session.commit()
                except Exception as e:
                    logger.exception("Failed to update agent %s status: %s", agent.agent_id, e)
                    await session.rollback()
                    continue

                # Update cache
                await self._cache.set_json(
                    f"agent:{agent.agent_id}:status",
                    {"status": new_status.value, "master_id": agent.master_id},
                    ttl_seconds=120,
                )
                await self._cache.set(
                    f"agent:{agent.agent_id}:missed_heartbeats",
                    str(missed_count),
                    ttl_seconds=120,
                )

                # Record event
                reason = f"missed_{missed_count}_heartbeats"
                await agent_repo.record_event(
                    agent.agent_id,
                    "state_change",
                    {
                        "from": old_status,
                        "to": new_status.value,
                        "reason": reason,
                        "elapsed_seconds": elapsed,
                        "missed_count": missed_count,
                    },
                )

                # Publish domain event
                await self._events.publish(
                    AgentStateChanged(
                        event_id=str(uuid.uuid4()),
                        agent_id=agent.agent_id,
                        previous_status=old_status,
                        new_status=new_status.value,
                        reason=reason,
                    )
                )

                # Broadcast via WebSocket
                if self._ws:
                    await self._ws.broadcast(
                        {
                            "type": "AGENT_STATUS",
                            "agent_id": agent.agent_id,
                            "short_id": agent.short_id,
                            "timestamp": now.isoformat(),
                            "payload": {"status": new_status.value, "reason": reason},
                        },
                    )

                log_fn = logger.warning if new_status == AgentStatus.OFFLINE else logger.info
                log_fn(
                    "Agent %s (%s): %s → %s (missed %d heartbeats, %.0fs elapsed)",
                    agent.agent_id,
                    agent.short_id,
                    old_status,
                    new_status.value,
                    missed_count,
                    elapsed,
                )

    async def _broadcast_system_status(self) -> None:
        """Calculate and broadcast system-wide status to all subscribers."""
        if not self._ws:
            return

        from nisha.infrastructure.database.repositories.agent_repo import SqlAlchemyAgentRepository
        from nisha.infrastructure.database.repositories.master_repo import SqlAlchemyMasterRepository

        try:
            async with self._session_factory() as session:
                agent_repo = SqlAlchemyAgentRepository(session)
                master_repo = SqlAlchemyMasterRepository(session)
                
                status_counts = await agent_repo.get_status_counts()
                masters = await master_repo.list_all()
            
            active_count = status_counts.get("ACTIVE", 0)
            offline_count = status_counts.get("OFFLINE", 0)
            degraded_count = status_counts.get("DEGRADED", 0)
            agents_total = sum(status_counts.values())

            system_data = {
                "type": "SYSTEM_STATUS",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "status": "operational" if offline_count == 0 else "degraded",
                    "agents": {
                        "total": agents_total,
                        "active": active_count,
                        "offline": offline_count,
                        "degraded": degraded_count,
                    },
                    "masters": {
                        "total": len(masters),
                        "online": sum(1 for m in masters if m.status == "ONLINE"),
                    },
                    "websocket_connections": self._ws.active_connections
                }
            }
            await self._ws.broadcast(system_data)
        except Exception as e:
            logger.error(f"Failed to broadcast system status: {e}")
