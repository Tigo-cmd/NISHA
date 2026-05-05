"""Domain events emitted by state changes."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class DomainEvent:
    event_id: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class AgentRegistered(DomainEvent):
    agent_id: str = ""
    master_id: str = ""
    capabilities: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentStateChanged(DomainEvent):
    agent_id: str = ""
    previous_status: str = ""
    new_status: str = ""
    reason: str = ""


@dataclass(frozen=True)
class AgentHeartbeatReceived(DomainEvent):
    agent_id: str = ""
    master_id: str = ""
    metrics: dict[str, Any] = field(default_factory=dict)
    sequence: int = 0


@dataclass(frozen=True)
class AgentHandoffInitiated(DomainEvent):
    agent_id: str = ""
    from_master: str = ""
    to_master: str = ""
    reason: str = ""


@dataclass(frozen=True)
class AgentHandoffCompleted(DomainEvent):
    agent_id: str = ""
    from_master: str = ""
    to_master: str = ""


@dataclass(frozen=True)
class CommandDispatched(DomainEvent):
    cmd_id: str = ""
    agent_id: str = ""
    command_type: str = ""
    priority: str = ""


@dataclass(frozen=True)
class CommandCompleted(DomainEvent):
    cmd_id: str = ""
    agent_id: str = ""
    success: bool = True
    result: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MasterStatusChanged(DomainEvent):
    master_id: str = ""
    previous_status: str = ""
    new_status: str = ""


@dataclass(frozen=True)
class ConfigUpdated(DomainEvent):
    agent_id: str = ""
    config_version: str = ""
    changed_keys: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class AgentDeleted(DomainEvent):
    agent_id: str = ""
