"""Master API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MasterRegisterRequest(BaseModel):
    master_id: str = Field(description="Master ID in M-001 format")
    name: str | None = None
    ip_address: str | None = None
    max_agents: int = Field(default=50, ge=1, le=100)
    location_zone: str | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None


class MasterResponse(BaseModel):
    master_id: str
    name: str | None
    ip_address: str | None
    max_agents: int
    current_agent_count: int
    status: str
    location_zone: str | None
    gps_lat: float | None
    gps_lng: float | None
    mesh_neighbors: list[str]
    last_seen: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MasterListResponse(BaseModel):
    items: list[MasterResponse]
