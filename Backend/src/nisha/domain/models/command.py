"""Command domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class Command:
    cmd_id: str
    agent_id: str
    command_type: str  # CommandType enum value
    priority: str = "MEDIUM"  # CommandPriority enum value
    status: str = "PENDING"  # CommandStatus enum value
    params: dict[str, Any] = field(default_factory=dict)
    requires_ack: bool = True
    max_retries: int = 3
    retry_count: int = 0
    issued_by: str | None = None
    issued_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    dispatched_at: datetime | None = None
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: str | None = None

    @property
    def is_terminal(self) -> bool:
        return self.status in ("COMPLETED", "FAILED", "EXPIRED")

    @property
    def can_retry(self) -> bool:
        return self.status == "FAILED" and self.retry_count < self.max_retries
