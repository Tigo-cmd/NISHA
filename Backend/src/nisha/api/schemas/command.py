"""Command API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CommandRequest(BaseModel):
    command_type: str = Field(description="One of: REBOOT, UPDATE_CONFIG, START_RECORDING, STOP_RECORDING, CALIBRATE_SENSOR, REQUEST_STATUS")
    params: dict[str, Any] = Field(default_factory=dict)
    issued_by: str | None = None


class CommandAckRequest(BaseModel):
    success: bool = True
    result: dict[str, Any] | None = None
    error: str | None = None


class CommandResponse(BaseModel):
    cmd_id: str
    agent_id: str
    command_type: str
    priority: str
    status: str
    params: dict[str, Any]
    requires_ack: bool
    issued_by: str | None
    issued_at: datetime
    dispatched_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}
