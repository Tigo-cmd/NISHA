"""Topology API schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class TopologyResponse(BaseModel):
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


class HandoffEvalRequest(BaseModel):
    agent_id: str
    current_signal: int


class HandoffEvalResponse(BaseModel):
    should_handoff: bool
    current_master: str
    target_master: str | None
    reason: str


class RebalanceResponse(BaseModel):
    moved: int
    master_id: str
    reason: str | None = None
