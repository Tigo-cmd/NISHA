"""Handoff domain entity and protocol types."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any


class HandoffStatus(StrEnum):
    PROBING = "PROBING"
    OFFERED = "OFFERED"
    REQUESTED = "REQUESTED"
    TRANSFERRING = "TRANSFERRING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


@dataclass
class HandoffOffer:
    master_id: str
    signal_strength: int
    available_slots: int
    latency_ms: float | None = None


@dataclass
class Handoff:
    handoff_id: str
    agent_id: str
    from_master_id: str
    to_master_id: str | None = None
    status: HandoffStatus = HandoffStatus.PROBING
    trigger_reason: str = ""
    current_signal: int = -80
    target_signal: int | None = None
    offers: list[HandoffOffer] = field(default_factory=list)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def is_terminal(self) -> bool:
        return self.status in (HandoffStatus.COMPLETED, HandoffStatus.FAILED, HandoffStatus.ROLLED_BACK)

    @property
    def duration_seconds(self) -> float | None:
        if self.completed_at is None:
            return None
        return (self.completed_at - self.started_at).total_seconds()
