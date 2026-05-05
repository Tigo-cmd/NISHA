"""Local Buffering and Store-Forward Manager.

Manages a RAM ring buffer up to a configured limit.
When RAM is full, gracefully spills over to disk (SD card) in a FIFO manner.
"""
import asyncio
import os
import time
import logging
from typing import Any, Dict, List

from nisha_master.config import settings

logger = logging.getLogger(__name__)

class BufferManager:
    def __init__(self):
        self.ram_buffer: asyncio.Queue = asyncio.Queue()
        self.current_ram_bytes: int = 0
        self.ram_limit_bytes: int = settings.buffer_ram_limit_mb * 1024 * 1024

        self.disk_dir = settings.buffer_disk_dir
        os.makedirs(self.disk_dir, exist_ok=True)

        self.is_flushing_to_disk = False

    async def append(self, frame_data: Dict[str, Any]):
        """Called by the router when the Backend is offline."""

        # Calculate approximate size of payload
        payload_size = len(frame_data.get("payload", b""))

        if self.current_ram_bytes + payload_size < self.ram_limit_bytes:
            # Fit in RAM
            await self.ram_buffer.put(frame_data)
            self.current_ram_bytes += payload_size
        else:
            # RAM full, spill to disk
            if not self.is_flushing_to_disk:
                logger.warning(f"RAM Buffer Full ({settings.buffer_ram_limit_mb}MB). Spilling to SD card.")
                self.is_flushing_to_disk = True

            await self._write_to_disk(frame_data)

    async def _write_to_disk(self, frame_data: Dict[str, Any]):
        """Write binary payload and metadata to disk."""
        # In a real implementation, use a structured format like SQLite,
        # append-only binary logs, or structured JSON+Bin files.
        timestamp = frame_data.get('timestamp', time.time())
        agent_id = frame_data.get('agent_id', 'unknown')
        filepath = os.path.join(self.disk_dir, f"{timestamp}_{agent_id}.nisha")

        # Async disk I/O should ideally be run in a threadpool
        def write_file():
            with open(filepath, 'wb') as f:
                f.write(frame_data.get("payload", b""))

        await asyncio.to_thread(write_file)

    async def retrieve_batch(self, batch_size: int = 50) -> List[Dict[str, Any]]:
        """Called when Backend connects, draining RAM then Disk."""
        batch = []

        # First drain RAM
        while not self.ram_buffer.empty() and len(batch) < batch_size:
            frame = await self.ram_buffer.get()
            payload_size = len(frame.get("payload", b""))
            self.current_ram_bytes -= payload_size
            batch.append(frame)

        if self.current_ram_bytes < self.ram_limit_bytes * 0.8:
            self.is_flushing_to_disk = False # Recovered enough RAM

        # If RAM is empty but we need more for the batch, read from disk
        if len(batch) < batch_size:
            # (Disk retrieval logic would go here)
            pass

        return batch
