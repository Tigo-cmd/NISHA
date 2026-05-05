"""Event bus port for domain event publishing."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable, Coroutine
from typing import Any

from nisha.domain.events.agent_events import DomainEvent

EventHandler = Callable[[DomainEvent], Coroutine[Any, Any, None]]


class EventBus(ABC):
    @abstractmethod
    async def publish(self, event: DomainEvent) -> None: ...

    @abstractmethod
    def subscribe(self, event_type: type[DomainEvent], handler: EventHandler) -> None: ...
