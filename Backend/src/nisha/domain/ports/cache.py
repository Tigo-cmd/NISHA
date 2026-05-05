"""Cache port for real-time state."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class Cache(ABC):
    @abstractmethod
    async def get(self, key: str) -> Any | None: ...

    @abstractmethod
    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    async def exists(self, key: str) -> bool: ...

    @abstractmethod
    async def get_json(self, key: str) -> dict | None: ...

    @abstractmethod
    async def set_json(self, key: str, value: dict, ttl_seconds: int | None = None) -> None: ...

    @abstractmethod
    async def increment(self, key: str) -> int: ...

    @abstractmethod
    async def set_hash(self, key: str, mapping: dict[str, Any]) -> None: ...

    @abstractmethod
    async def get_hash(self, key: str) -> dict[str, Any]: ...
