"""Topology management application service.

Handles mesh topology, route management, neighbor discovery,
handoff evaluation, rebalancing, and route optimization.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from nisha.domain.models.enums import AgentStatus, MasterStatus
from nisha.domain.models.master import MeshRoute
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.master_repository import MasterRepository
from nisha.domain.services.mesh import evaluate_handoff, select_best_route, HandoffCandidate

logger = logging.getLogger(__name__)


class TopologyService:
    def __init__(
        self,
        agent_repo: AgentRepository,
        master_repo: MasterRepository,
        cache: Cache | None = None,
    ) -> None:
        self._agents = agent_repo
        self._masters = master_repo
        self._cache = cache

    async def get_topology(self) -> dict[str, Any]:
        masters = await self._masters.list_all()
        routes = await self._masters.get_mesh_routes()

        nodes = []
        for m in masters:
            agents = await self._agents.get_by_master(m.master_id)
            nodes.append({
                "node_id": m.master_id,
                "type": "MASTER",
                "status": m.status,
                "agent_count": m.current_agent_count,
                "max_agents": m.max_agents,
                "load_percent": m.load_percentage,
                "location_zone": m.location_zone,
                "agents": [
                    {
                        "agent_id": a.agent_id,
                        "short_id": a.short_id,
                        "status": a.status,
                        "last_heartbeat": a.last_heartbeat.isoformat() if a.last_heartbeat else None,
                    }
                    for a in agents
                ],
            })

        edges = [
            {
                "source": r.source_node,
                "target": r.target_node,
                "next_hop": r.next_hop,
                "hops": r.hop_count,
                "signal": r.signal_strength,
                "active": r.active,
                "last_updated": r.last_updated.isoformat(),
            }
            for r in routes
        ]

        return {"nodes": nodes, "edges": edges}

    async def get_topology_summary(self) -> dict[str, Any]:
        """Lightweight topology summary for dashboards."""
        masters = await self._masters.list_all()
        routes = await self._masters.get_mesh_routes(active_only=True)

        total_agents = sum(m.current_agent_count for m in masters)
        total_capacity = sum(m.max_agents for m in masters)
        online_masters = [m for m in masters if m.status == MasterStatus.ONLINE]

        return {
            "masters": {
                "total": len(masters),
                "online": len(online_masters),
                "total_capacity": total_capacity,
                "used_capacity": total_agents,
                "utilization_percent": (total_agents / total_capacity * 100) if total_capacity else 0,
            },
            "routes": {
                "active": len(routes),
            },
            "hotspots": [
                {"master_id": m.master_id, "load_percent": m.load_percentage}
                for m in masters
                if m.load_percentage > 80
            ],
        }

    async def evaluate_agent_handoff(
        self,
        agent_id: str,
        current_signal: int,
    ) -> dict[str, Any]:
        agent = await self._agents.get_by_id(agent_id)
        if not agent or not agent.master_id:
            raise ValueError(f"Agent {agent_id} not found or has no master")

        masters = await self._masters.list_all(status=MasterStatus.ONLINE)

        # Pull signal estimates from cache if available
        candidates = []
        for m in masters:
            if self._cache:
                cached_signal = await self._cache.get(
                    f"mesh:signal:{agent_id}:{m.master_id}"
                )
                sig = int(cached_signal) if cached_signal else -60
            else:
                sig = -60
            candidates.append(HandoffCandidate(
                master_id=m.master_id,
                signal_strength=sig,
                has_capacity=m.has_capacity,
            ))

        decision = evaluate_handoff(agent_id, agent.master_id, current_signal, candidates)
        return {
            "should_handoff": decision.should_handoff,
            "current_master": decision.current_master,
            "target_master": decision.target_master,
            "reason": decision.reason,
            "current_signal": decision.current_signal,
            "target_signal": decision.target_signal,
        }

    async def rebalance_master(self, master_id: str) -> dict[str, Any]:
        """Redistribute agents from an overloaded master to others with capacity."""
        master = await self._masters.get_by_id(master_id)
        if not master:
            raise ValueError(f"Master {master_id} not found")

        if master.load_percentage <= 80:
            return {"moved": 0, "master_id": master_id, "reason": "Master load is acceptable"}

        agents = await self._agents.get_by_master(master_id)
        available_masters = await self._masters.list_all(status=MasterStatus.ONLINE)
        targets = [
            m for m in available_masters
            if m.master_id != master_id and m.has_capacity
        ]

        if not targets:
            return {"moved": 0, "master_id": master_id, "reason": "No available masters with capacity"}

        moved = 0
        moves: list[dict] = []

        for agent in agents:
            if master.load_percentage <= 80:
                break
            best_target = max(targets, key=lambda m: m.available_slots)
            if best_target.available_slots <= 0:
                break

            # Update agent assignment
            agent.master_id = best_target.master_id
            agent.updated_at = datetime.now(timezone.utc)
            await self._agents.update(agent)

            # Update counts
            await self._masters.increment_agent_count(master_id, -1)
            await self._masters.increment_agent_count(best_target.master_id, 1)
            master.current_agent_count -= 1
            best_target.current_agent_count += 1

            # Update route
            route = MeshRoute(
                source_node=agent.agent_id,
                target_node=best_target.master_id,
                hop_count=1,
                signal_strength=-50,
                active=True,
            )
            await self._masters.upsert_mesh_route(route)

            moves.append({
                "agent_id": agent.agent_id,
                "from_master": master_id,
                "to_master": best_target.master_id,
            })
            moved += 1

        logger.info("Rebalanced %d agents from master %s", moved, master_id)
        return {"moved": moved, "master_id": master_id, "moves": moves}

    async def optimize_routes(self) -> dict[str, Any]:
        """Optimize mesh routes by removing stale entries and selecting best paths."""
        all_routes = await self._masters.get_mesh_routes(active_only=False)
        now = datetime.now(timezone.utc)

        deactivated = 0
        for route in all_routes:
            if not route.active:
                continue
            age = (now - route.last_updated).total_seconds()
            if age > 300:  # Routes older than 5 min without update
                route.active = False
                await self._masters.upsert_mesh_route(route)
                deactivated += 1

        active_routes = await self._masters.get_mesh_routes(active_only=True)
        return {
            "active_routes": len(active_routes),
            "deactivated_stale": deactivated,
        }

    async def update_route(self, route: MeshRoute) -> None:
        await self._masters.upsert_mesh_route(route)

    async def report_neighbor(
        self,
        node_id: str,
        neighbor_id: str,
        signal_strength: int,
    ) -> None:
        """Record a mesh neighbor observation (used by agents and masters)."""
        if self._cache:
            await self._cache.set(
                f"mesh:signal:{node_id}:{neighbor_id}",
                str(signal_strength),
                ttl_seconds=120,
            )

        route = MeshRoute(
            source_node=node_id,
            target_node=neighbor_id,
            hop_count=1,
            signal_strength=signal_strength,
            active=True,
        )
        await self._masters.upsert_mesh_route(route)
