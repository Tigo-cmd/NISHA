"""Repository port for Master persistence."""

from __future__ import annotations

from abc import ABC, abstractmethod

from nisha.domain.models.master import Master, MeshRoute


class MasterRepository(ABC):
    @abstractmethod
    async def get_by_id(self, master_id: str) -> Master | None: ...

    @abstractmethod
    async def list_all(
        self,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Master]: ...

    @abstractmethod
    async def create(self, master: Master) -> Master: ...

    @abstractmethod
    async def update(self, master: Master) -> Master: ...

    @abstractmethod
    async def delete(self, master_id: str) -> bool: ...

    @abstractmethod
    async def increment_agent_count(self, master_id: str, delta: int = 1) -> None: ...

    @abstractmethod
    async def get_mesh_routes(
        self,
        *,
        source_node: str | None = None,
        active_only: bool = True,
    ) -> list[MeshRoute]: ...

    @abstractmethod
    async def upsert_mesh_route(self, route: MeshRoute) -> None: ...
