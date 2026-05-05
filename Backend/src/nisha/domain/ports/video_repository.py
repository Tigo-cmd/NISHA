"""Video repository port."""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from datetime import datetime

from nisha.domain.models.enums import BehaviorClass, VideoPriority
from nisha.domain.models.video import VideoEvent


class VideoRepository(ABC):
    @abstractmethod
    async def save_event(self, event: VideoEvent) -> VideoEvent: ...

    @abstractmethod
    async def get_event(self, event_id: str) -> VideoEvent | None: ...

    @abstractmethod
    async def list_events(
        self,
        agent_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        priority: VideoPriority | None = None,
        behavior: BehaviorClass | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[VideoEvent]: ...

    @abstractmethod
    async def update_event_status(self, event_id: str, confirmed: bool) -> bool: ...
