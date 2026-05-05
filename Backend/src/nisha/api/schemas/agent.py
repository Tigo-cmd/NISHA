"""Agent API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class AgentMetricsSchema(BaseModel):
    battery_level: int = Field(ge=0, le=100, default=100)
    signal_strength: int = Field(ge=-120, le=0, default=-40)
    temperature_c: float = Field(ge=-40, le=125, default=25.0)
    free_heap_bytes: int = Field(ge=0, default=65536)
    cpu_usage_percent: int = Field(ge=0, le=100, default=0)


class AgentRegisterRequest(BaseModel):
    agent_id: str = Field(description="MAC address of the agent")
    master_id: str = Field(description="ID of the master node")
    capabilities: dict[str, Any] = Field(default_factory=dict)
    firmware_version: str | None = None
    hardware_type: str | None = None
    stream_url: str | None = None
    location_zone: str | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None


class AgentUpdateRequest(BaseModel):
    config: dict[str, Any] | None = None
    location_zone: str | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None
    status: str | None = None
    status_reason: str | None = None


class HeartbeatRequest(BaseModel):
    agent_id: str
    timestamp: int
    sequence: int = 0
    status: str = "ACTIVE"
    metrics: AgentMetricsSchema = Field(default_factory=AgentMetricsSchema)


class AgentResponse(BaseModel):
    agent_id: str
    short_id: str
    status: str
    master_id: str | None
    capabilities: dict[str, Any]
    config: dict[str, Any]
    location_zone: str | None
    gps_lat: float | None
    gps_lng: float | None
    firmware_version: str | None
    hardware_type: str | None = None
    stream_url: str | None = None
    last_heartbeat: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[AgentResponse]


class HeartbeatResponse(BaseModel):
    agent_id: str
    status: str
    health: str
    checks: list[dict[str, Any]]


class AgentHistoryResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int
