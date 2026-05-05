"""Handoff protocol service.

Implements the full handoff workflow from PRD Section 6.2:
T+0:   Agent detects signal degradation
T+2s:  Agent broadcasts HANDOFF_PROBE to nearby masters
T+5s:  Masters respond with HANDOFF_OFFER
T+8s:  Agent selects best offer
T+10s: Agent sends HANDOFF_REQUEST to selected master
T+12s: Selected master accepts, notifies Server
T+15s: Old master transfers buffered data
T+20s: Server updates routing tables
T+25s: Agent confirms switch, resumes normal operation

Failure modes:
- No master responds → Agent goes OFFLINE, buffers locally
- Handoff fails mid-way → Revert to old master, mark DEGRADED
- Server unreachable → Masters coordinate locally, sync when possible
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from nisha.domain.events.agent_events import (
    AgentHandoffCompleted,
    AgentHandoffInitiated,
    AgentStateChanged,
)
from nisha.domain.models.enums import AgentStatus
from nisha.domain.models.handoff import Handoff, HandoffOffer, HandoffStatus
from nisha.domain.models.master import MeshRoute
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus
from nisha.domain.ports.master_repository import MasterRepository
from nisha.domain.services.lifecycle import validate_transition
from nisha.domain.services.mesh import HANDOFF_IMPROVEMENT_MARGIN, HANDOFF_SIGNAL_THRESHOLD


class HandoffError(Exception):
    """Raised when handoff fails at any stage."""

    def __init__(self, handoff_id: str, stage: str, reason: str) -> None:
        self.handoff_id = handoff_id
        self.stage = stage
        self.reason = reason
        super().__init__(f"Handoff {handoff_id} failed at {stage}: {reason}")


class HandoffService:
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

    async def initiate_handoff(
        self,
        agent_id: str,
        current_signal: int,
        trigger_reason: str = "signal_degradation",
    ) -> Handoff:
        """Start a handoff for an agent experiencing signal degradation."""
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        if not agent.master_id:
            raise ValueError(f"Agent {agent_id} has no assigned master")
        if agent.status not in (AgentStatus.ACTIVE, AgentStatus.DEGRADED):
            raise ValueError(f"Agent {agent_id} in state {agent.status} — cannot handoff")

        handoff = Handoff(
            handoff_id=str(uuid.uuid4()),
            agent_id=agent_id,
            from_master_id=agent.master_id,
            trigger_reason=trigger_reason,
            current_signal=current_signal,
        )

        # Cache handoff state for tracking
        await self._cache.set_json(
            f"handoff:{handoff.handoff_id}",
            {
                "agent_id": agent_id,
                "from_master": agent.master_id,
                "status": HandoffStatus.PROBING,
                "started_at": handoff.started_at.isoformat(),
            },
            ttl_seconds=120,  # Handoff must complete within 2 minutes
        )

        # Probe: Collect offers from available masters
        offers = await self._probe_masters(agent_id, agent.master_id, current_signal)
        handoff.offers = offers

        if not offers:
            handoff.status = HandoffStatus.FAILED
            handoff.error = "No master responded to handoff probe"
            handoff.completed_at = datetime.now(timezone.utc)
            await self._record_handoff(handoff)

            # Mark agent OFFLINE since no master is available
            validate_transition(agent.status, AgentStatus.OFFLINE)
            agent.status = AgentStatus.OFFLINE
            await self._agents.update(agent)
            await self._cache.set_json(
                f"agent:{agent_id}:status",
                {"status": AgentStatus.OFFLINE, "master_id": agent.master_id},
                ttl_seconds=120,
            )

            return handoff

        handoff.status = HandoffStatus.OFFERED

        # Select best offer
        best = max(offers, key=lambda o: (o.signal_strength, o.available_slots))
        handoff.to_master_id = best.master_id
        handoff.target_signal = best.signal_strength
        handoff.status = HandoffStatus.REQUESTED

        await self._events.publish(
            AgentHandoffInitiated(
                event_id=str(uuid.uuid4()),
                agent_id=agent_id,
                from_master=agent.master_id,
                to_master=best.master_id,
                reason=trigger_reason,
            )
        )

        # Execute the handoff
        try:
            await self._execute_handoff(handoff)
        except Exception as exc:
            await self._rollback_handoff(handoff, str(exc))
            raise

        return handoff

    async def _probe_masters(
        self,
        agent_id: str,
        current_master_id: str,
        current_signal: int,
    ) -> list[HandoffOffer]:
        """Probe all online masters for handoff availability."""
        all_masters = await self._masters.list_all(status="ONLINE")
        offers: list[HandoffOffer] = []

        for master in all_masters:
            if master.master_id == current_master_id:
                continue
            if not master.has_capacity:
                continue

            # In production, signal strength would come from mesh probe response.
            # Here we check cached mesh data for estimated signal.
            cached_signal = await self._cache.get(
                f"mesh:signal:{agent_id}:{master.master_id}"
            )
            estimated_signal = int(cached_signal) if cached_signal else -70

            # Only offer if significantly better than current
            if estimated_signal > current_signal + HANDOFF_IMPROVEMENT_MARGIN:
                offers.append(
                    HandoffOffer(
                        master_id=master.master_id,
                        signal_strength=estimated_signal,
                        available_slots=master.available_slots,
                    )
                )

        return offers

    async def _execute_handoff(self, handoff: Handoff) -> None:
        """Execute the handoff: transfer agent from old master to new master."""
        assert handoff.to_master_id is not None

        handoff.status = HandoffStatus.TRANSFERRING

        # Update cache to reflect in-progress handoff
        await self._cache.set_json(
            f"handoff:{handoff.handoff_id}",
            {
                "agent_id": handoff.agent_id,
                "from_master": handoff.from_master_id,
                "to_master": handoff.to_master_id,
                "status": HandoffStatus.TRANSFERRING,
            },
            ttl_seconds=120,
        )

        # 1. Decrement old master agent count
        await self._masters.increment_agent_count(handoff.from_master_id, -1)

        # 2. Increment new master agent count
        await self._masters.increment_agent_count(handoff.to_master_id, 1)

        # 3. Update agent's master assignment
        agent = await self._agents.get_by_id(handoff.agent_id)
        if not agent:
            raise HandoffError(handoff.handoff_id, "TRANSFER", "Agent disappeared during handoff")

        old_status = agent.status
        agent.master_id = handoff.to_master_id
        agent.status = AgentStatus.ACTIVE
        agent.updated_at = datetime.now(timezone.utc)
        await self._agents.update(agent)

        # 4. Update routing tables
        # Deactivate old route
        old_routes = await self._masters.get_mesh_routes(source_node=handoff.agent_id)
        for route in old_routes:
            if route.target_node == handoff.from_master_id:
                route.active = False
                await self._masters.upsert_mesh_route(route)

        # Create new route
        new_route = MeshRoute(
            source_node=handoff.agent_id,
            target_node=handoff.to_master_id,
            hop_count=1,
            signal_strength=handoff.target_signal or -50,
            active=True,
        )
        await self._masters.upsert_mesh_route(new_route)

        # 5. Update cache
        await self._cache.set_json(
            f"agent:{handoff.agent_id}:status",
            {"status": AgentStatus.ACTIVE, "master_id": handoff.to_master_id},
            ttl_seconds=120,
        )

        # 6. Record completion
        handoff.status = HandoffStatus.COMPLETED
        handoff.completed_at = datetime.now(timezone.utc)

        await self._cache.delete(f"handoff:{handoff.handoff_id}")

        await self._record_handoff(handoff)

        await self._events.publish(
            AgentHandoffCompleted(
                event_id=str(uuid.uuid4()),
                agent_id=handoff.agent_id,
                from_master=handoff.from_master_id,
                to_master=handoff.to_master_id,
            )
        )

    async def _rollback_handoff(self, handoff: Handoff, error: str) -> None:
        """Revert a failed handoff: restore agent to original master, mark DEGRADED."""
        handoff.status = HandoffStatus.ROLLED_BACK
        handoff.error = error
        handoff.completed_at = datetime.now(timezone.utc)

        # Try to restore agent counts
        if handoff.to_master_id:
            try:
                await self._masters.increment_agent_count(handoff.to_master_id, -1)
            except Exception:
                pass
            try:
                await self._masters.increment_agent_count(handoff.from_master_id, 1)
            except Exception:
                pass

        # Restore agent to original master, mark DEGRADED
        agent = await self._agents.get_by_id(handoff.agent_id)
        if agent:
            agent.master_id = handoff.from_master_id
            agent.status = AgentStatus.DEGRADED
            agent.updated_at = datetime.now(timezone.utc)
            await self._agents.update(agent)

            await self._cache.set_json(
                f"agent:{handoff.agent_id}:status",
                {"status": AgentStatus.DEGRADED, "master_id": handoff.from_master_id},
                ttl_seconds=120,
            )

        await self._cache.delete(f"handoff:{handoff.handoff_id}")
        await self._record_handoff(handoff)

    async def _record_handoff(self, handoff: Handoff) -> None:
        """Persist handoff to agent history."""
        await self._agents.record_event(
            handoff.agent_id,
            "handoff",
            {
                "handoff_id": handoff.handoff_id,
                "from_master": handoff.from_master_id,
                "to_master": handoff.to_master_id,
                "status": handoff.status,
                "trigger": handoff.trigger_reason,
                "current_signal": handoff.current_signal,
                "target_signal": handoff.target_signal,
                "duration_seconds": handoff.duration_seconds,
                "error": handoff.error,
                "offers_count": len(handoff.offers),
            },
        )

    async def get_active_handoff(self, agent_id: str) -> dict | None:
        """Check if there's an active handoff for an agent."""
        # Scan for active handoff in cache
        # In production, this would use a more efficient index
        cached = await self._cache.get_json(f"handoff:active:{agent_id}")
        return cached
