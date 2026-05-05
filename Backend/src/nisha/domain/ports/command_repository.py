"""Repository port for Command persistence.

Abstract interface -- infrastructure provides the implementation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from nisha.domain.models.command import Command


class CommandRepository(ABC):
    @abstractmethod
    async def get_by_id(self, cmd_id: str) -> Command | None: ...

    @abstractmethod
    async def create(self, command: Command) -> Command: ...

    @abstractmethod
    async def update(self, command: Command) -> Command: ...

    @abstractmethod
    async def get_pending_commands(self, agent_id: str) -> Sequence[Command]: ...
