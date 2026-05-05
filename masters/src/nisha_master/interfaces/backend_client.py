"""Backend Communication Layer.

Maintains a persistent WSS connection to the central Backend server.
Implements auto-reconnect with exponential backoff and HTTP fallback.
"""
import asyncio
import logging
import time
import json
from typing import Dict, Any

import aiohttp
import websockets
from websockets.exceptions import ConnectionClosed

from nisha_master.config import settings
from nisha_master.core.buffer import BufferManager

logger = logging.getLogger(__name__)


class BackendWebSocketClient:
    def __init__(self, stream_queue: asyncio.Queue, buffer_manager: BufferManager, agent_server=None):
        self.ws_url = settings.backend_ws_url
        self.http_url = settings.backend_http_url
        self.token = settings.backend_auth_token
        self.stream_queue = stream_queue
        self.buffer = buffer_manager
        self.agent_server = agent_server
        self.metrics_store = None # Will be set by main.py

        self.is_connected = False
        self._ws: websockets.WebSocketClientProtocol | None = None

    async def connect_and_run(self):
        """Main loop managing the persistent connection."""
        retry_delay = 1.0

        while True:
            try:
                # Format URL with the token as query parameter expected by Backend
                ws_url_with_auth = f"{self.ws_url}?token={self.token}-{settings.master_id}"
                logger.info(f"Connecting to Backend: {ws_url_with_auth}")

                async with websockets.connect(ws_url_with_auth) as ws:
                    logger.info("Connected to Backend successfully.")
                    self.is_connected = True
                    self._ws = ws
                    retry_delay = 1.0  # Reset backoff

                    # First, drain any buffered offline data
                    await self._drain_buffer()

                    # Then run the main send/recv loop
                    # asyncio.gather runs both coroutines concurrently
                    await asyncio.gather(
                        self._send_loop(),
                        self._recv_loop(),
                        self._heartbeat_loop()
                    )

            except (ConnectionRefusedError, ConnectionClosed, asyncio.TimeoutError) as e:
                self.is_connected = False
                logger.warning(f"Backend connection lost: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)

                # Exponential backoff (max 60 seconds)
                retry_delay = min(retry_delay * 2, 60.0)

            except Exception as e:
                self.is_connected = False
                logger.error(f"Unexpected Backend error: {e}")
                await asyncio.sleep(5)

    async def _drain_buffer(self):
        """Sends everything stored in the BufferManager while offline."""
        logger.info("Draining offline buffer to backend...")
        while True:
            batch = await self.buffer.retrieve_batch(batch_size=50)
            if not batch:
                break
            # In a real scenario, use multipart HTTP fallback here if the batch is huge
            # For now, send individually over WS
            for frame in batch:
                await self._send_frame(frame)
        logger.info("Buffer drain complete.")

    async def _send_loop(self):
        """Pulls from the live queue and sends to Backend."""
        while self.is_connected:
            try:
                # Wait for live data from ESP32s (Note: we changed this to receive raw bytes)
                raw_frame = await self.stream_queue.get()

                if not self.is_connected:
                    # TODO: Wrap it back in a dict if buffer expects it, 
                    # or update buffer to handle raw bytes.
                    await self.buffer.append({"payload": raw_frame})
                    self.stream_queue.task_done()
                    continue

                if self._ws:
                    await self._ws.send(raw_frame)
                
                self.stream_queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Send loop error: {e}")

    async def _recv_loop(self):
        """Listens for Commands from the Backend (e.g., config updates, reboots)."""
        if not self._ws:
            return

        async for message in self._ws:
            try:
                data = json.loads(message)
                logger.info(f"Received from Backend: {data}")
                
                # Check if it's a command for an agent
                if data.get("type") == "AGENT_COMMAND" and self.agent_server:
                    agent_id = data.get("agent_id")
                    command = data.get("command")
                    if agent_id and command:
                        await self.agent_server.send_command(agent_id, command)
                
            except json.JSONDecodeError:
                logger.warning(f"Received non-JSON message from Backend: {message}")
            except Exception as e:
                logger.error(f"Error in recv loop: {e}")

    async def _heartbeat_loop(self):
        """Sends periodic status updates to the Backend."""
        import json
        while self.is_connected:
            try:
                if self._ws:
                    agent_count = 0
                    if self.metrics_store:
                        agent_count = len(self.metrics_store.agent_stats)

                    heartbeat = {
                        "type": "MASTER_HEARTBEAT",
                        "master_id": settings.master_id,
                        "agent_count": agent_count,
                        "timestamp": time.time()
                    }
                    await self._ws.send(json.dumps(heartbeat))
                    logger.debug(f"Sent heartbeat: {settings.master_id}")
                
                await asyncio.sleep(10) # Send heartbeat every 10 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat loop error: {e}")
                await asyncio.sleep(5)

    async def http_fallback_upload(self, data_batch: bytes):
        """Used when WSS is down and the buffer is overflowing."""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {self.token}"}
                # Form data upload
                data = aiohttp.FormData()
                data.add_field('file', data_batch, filename='fallback_batch.bin')

                async with session.post(self.http_url, data=data, headers=headers) as response:
                    if response.status == 200:
                        logger.info("HTTP Fallback upload successful.")
                    else:
                        logger.warning(f"HTTP Fallback failed: {response.status}")
        except Exception as e:
            logger.error(f"HTTP Fallback error: {e}")
