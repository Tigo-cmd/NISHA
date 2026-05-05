"""Agent domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class AgentMetrics:
    battery_level: int = 100
    signal_strength: int = -40
    temperature_c: float = 25.0
    free_heap_bytes: int = 65536
    cpu_usage_percent: int = 0


@dataclass
class AgentCapabilities:
    audio: bool = True
    video: bool = True
    motion_detection: bool = True
    mesh_relay: bool = True
    sensors: list[str] = field(default_factory=lambda: ["audio", "video"])


@dataclass
class Agent:
    agent_id: str  # MAC address format: A4CF12XXYYZZ
    short_id: str  # Human readable: A-001
    status: str = "NEW"
    master_id: str | None = None
    capabilities: dict[str, Any] = field(default_factory=dict)
    config: dict[str, Any] = field(default_factory=dict)
    location_zone: str | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None
    firmware_version: str | None = None
    hardware_type: str | None = None
    stream_url: str | None = None
    last_heartbeat: datetime | None = None
    metrics: AgentMetrics = field(default_factory=AgentMetrics)
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_connected(self) -> bool:
        return self.status in ("ACTIVE", "DEGRADED")

    @property
    def missed_heartbeats(self) -> int:
        if self.last_heartbeat is None:
            return 0
        elapsed = (datetime.now(timezone.utc) - self.last_heartbeat).total_seconds()
        return int(elapsed // 30)  # 30s heartbeat interval
