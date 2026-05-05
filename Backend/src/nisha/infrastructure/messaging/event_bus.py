"""In-process event bus implementing the EventBus port."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from nisha.domain.events.agent_events import DomainEvent
from nisha.domain.ports.event_bus import EventBus, EventHandler

logger = logging.getLogger(__name__)


class InProcessEventBus(EventBus):
    """Simple async event bus for in-process domain event dispatch.

    For production at scale, swap this for Redis Pub/Sub or a message broker.
    """

    def __init__(self) -> None:
        self._handlers: dict[type[DomainEvent], list[EventHandler]] = defaultdict(list)

    async def publish(self, event: DomainEvent) -> None:
        event_type = type(event)
        handlers = self._handlers.get(event_type, [])
        for handler in handlers:
            try:
                await handler(event)
            except Exception:
                logger.exception(
                    "Event handler failed for %s: %s",
                    event_type.__name__,
                    handler.__name__,
                )

    def subscribe(self, event_type: type[DomainEvent], handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    async def publish_all(self, events: list[DomainEvent]) -> None:
        for event in events:
            await self.publish(event)
