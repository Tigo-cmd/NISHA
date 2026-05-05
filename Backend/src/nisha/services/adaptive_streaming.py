"""Adaptive Streaming Controller to manage stream bandwidth."""

import asyncio
import logging
from typing import Any

import psutil

logger = logging.getLogger(__name__)

class AdaptiveStreamingController:
    """Monitors system load and throttles agent streams accordingly."""

    def __init__(self, cpu_threshold: float = 80.0, memory_threshold: float = 85.0):
        self.cpu_threshold = cpu_threshold
        self.memory_threshold = memory_threshold
        self.current_throttle_level = 1.0 # 1.0 = full speed, 0.1 = maximum throttle
        self._running = False

    async def start(self):
        """Start the monitoring loop."""
        self._running = True
        asyncio.create_task(self._monitor_loop())
        logger.info("AdaptiveStreamingController started (CPU limit=%.1f%%)", self.cpu_threshold)

    async def stop(self):
        """Stop the monitoring loop."""
        self._running = False

    async def _monitor_loop(self):
        while self._running:
            try:
                cpu_usage = psutil.cpu_percent(interval=1)
                mem_usage = psutil.virtual_memory().percent

                new_level = 1.0
                if cpu_usage > self.cpu_threshold or mem_usage > self.memory_threshold:
                    # Scale down linearly or step-wise
                    if cpu_usage > 95:
                        new_level = 0.1
                    elif cpu_usage > 90:
                        new_level = 0.3
                    else:
                        new_level = 0.5

                if new_level != self.current_throttle_level:
                    self.current_throttle_level = new_level
                    logger.info("Adaptive Streaming: Throttling level changed to %.2f (CPU=%.1f%%)",
                                new_level, cpu_usage)
                    # TODO: Broadcast throttle level to all connected Masters/Agents

            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")

            await asyncio.sleep(5)

    def get_throttle_config(self) -> dict[str, Any]:
        """Get the current throttle configuration for agents."""
        return {
            "fps_multiplier": self.current_throttle_level,
            "bitrate_multiplier": self.current_throttle_level,
            "drop_probability": 1.0 - self.current_throttle_level
        }
