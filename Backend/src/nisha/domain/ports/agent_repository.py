"""Repository port for Agent persistence.

Abstract interface -- infrastructure provides the implementation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from nisha.domain.models.agent import Agent


class AgentRepository(ABC):
    @abstractmethod
    async def get_by_id(self, agent_id: str) -> Agent | None: ...

    @abstractmethod
    async def get_by_short_id(self, short_id: str) -> Agent | None: ...

    @abstractmethod
    async def list_all(
        self,
        *,
        status: str | None = None,
        master_id: str | None = None,
        location_zone: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Agent]: ...

    @abstractmethod
    async def get_status_counts(self) -> dict[str, int]: ...

    @abstractmethod
    async def count(
        self,
        *,
        status: str | None = None,
        master_id: str | None = None,
    ) -> int: ...

    @abstractmethod
    async def create(self, agent: Agent) -> Agent: ...

    @abstractmethod
    async def update(self, agent: Agent) -> Agent: ...

    @abstractmethod
    async def delete(self, agent_id: str) -> bool: ...

    @abstractmethod
    async def get_by_master(self, master_id: str) -> list[Agent]: ...

    @abstractmethod
    async def record_event(
        self,
        agent_id: str,
        event_type: str,
        data: dict[str, Any],
    ) -> None: ...

    @abstractmethod
    async def get_history(
        self,
        agent_id: str,
        *,
        event_type: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def update_last_heartbeat(self, agent_id: str, master_id: str | None = None) -> None: ...
