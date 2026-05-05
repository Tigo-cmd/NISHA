"""Master node domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class Master:
    master_id: str  # M-001 format
    name: str | None = None
    ip_address: str | None = None
    max_agents: int = 50
    current_agent_count: int = 0
    status: str = "ONLINE"
    location_zone: str | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None
    mesh_neighbors: list[str] = field(default_factory=list)
    last_seen: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def has_capacity(self) -> bool:
        return self.current_agent_count < self.max_agents

    @property
    def available_slots(self) -> int:
        return max(0, self.max_agents - self.current_agent_count)

    @property
    def load_percentage(self) -> float:
        if self.max_agents == 0:
            return 100.0
        return (self.current_agent_count / self.max_agents) * 100


@dataclass
class MeshRoute:
    source_node: str
    target_node: str
    next_hop: str | None = None
    hop_count: int = 1
    signal_strength: int = -40
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    active: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)
