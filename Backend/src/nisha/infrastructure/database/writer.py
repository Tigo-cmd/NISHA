"""Asynchronous high-throughput database writer for telemetry."""

import asyncio
import logging
from typing import Any, List, Type
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy import insert

logger = logging.getLogger(__name__)

class AsyncDatabaseWriter:
    """Buffers database inserts and flushes them in batches to reduce I/O overhead."""
    
    def __init__(self, session_factory: async_sessionmaker, batch_size: int = 100, flush_interval: float = 5.0):
        self.session_factory = session_factory
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._buffers: dict[Type, List[dict]] = {}
        self._lock = asyncio.Lock()
        self._flush_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the background flush task."""
        if self._flush_task:
            return
        self._flush_task = asyncio.create_task(self._periodic_flush())
        logger.info("AsyncDatabaseWriter started (batch_size=%d, interval=%.1fs)", 
                    self.batch_size, self.flush_interval)

    async def stop(self):
        """Stop the background task and flush remaining buffers."""
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
            self._flush_task = None
        
        await self.flush_all()
        logger.info("AsyncDatabaseWriter stopped")

    async def add_item(self, model_class: Type, data: dict):
        """Add a dictionary of data to be inserted into the specified model class."""
        async with self._lock:
            if model_class not in self._buffers:
                self._buffers[model_class] = []
            
            self._buffers[model_class].append(data)
            
            if len(self._buffers[model_class]) >= self.batch_size:
                # Flush this specific model buffer
                await self._flush_model(model_class)

    async def flush_all(self):
        """Flush all pending buffers."""
        async with self._lock:
            for model_class in list(self._buffers.keys()):
                await self._flush_model(model_class, locked=True)

    async def _flush_model(self, model_class: Type, locked: bool = False):
        """Flush a specific model buffer to the database."""
        if not locked:
            async with self._lock:
                return await self._flush_model(model_class, locked=True)

        data_to_insert = self._buffers.pop(model_class, [])
        if not data_to_insert:
            return

        try:
            async with self.session_factory() as session:
                await session.execute(insert(model_class), data_to_insert)
                await session.commit()
                logger.debug("Flushed %d items for %s", len(data_to_insert), model_class.__name__)
        except Exception as e:
            logger.error("Failed to flush items for %s: %s", model_class.__name__, e)
            # Optional: Implement retry logic or dead-letter queue
            # For now, we log the failure

    async def _periodic_flush(self):
        """Periodically flush all buffers regardless of size."""
        try:
            while True:
                await asyncio.sleep(self.flush_interval)
                await self.flush_all()
        except asyncio.CancelledError:
            pass
