import asyncio
import aiohttp
import struct
import time
import json
import logging

logger = logging.getLogger(__name__)

# NISHA Protocol Constants
# Header: magic(2s), ver(B), type(B), prio(B), res(B), seq(I), ts(Q), payload_len(I), meta_len(H)
FRAME_HEADER_FORMAT = "!2sBBBB I Q I H"
HEADER_SIZE = 24

STREAM_TYPE_VIDEO = 0x02
STREAM_TYPE_AUDIO = 0x03
PRIORITY_HIGH = 0x01
PRIORITY_LOW = 0x00

class HardwareIngestionWorker:
    """Worker responsible for ingesting streams from hardware agents (ESP32-CAM, etc.)
    and relaying them to the backend via the standard NISHA protocol.
    """
    def __init__(self, stream_queue: asyncio.Queue, telemetry_queue: asyncio.Queue):
        self.stream_queue = stream_queue
        self.telemetry_queue = telemetry_queue
        self._tasks = []
        self._running = False
        self._sequence_map = {}

    async def start(self, hardware_agents: list[dict]):
        self._running = True
        for agent in hardware_agents:
            await self.add_agent(agent)

    async def add_agent(self, agent_config: dict):
        """Dynamically add and start a hardware agent worker."""
        agent_id = agent_config.get("id")
        if not agent_id or not self._running:
            return
            
        # Don't start duplicate tasks for the same ID
        if agent_id in self._sequence_map and any(not t.done() for t in self._tasks if getattr(t, 'agent_id', None) == agent_id):
            logger.info(f"Worker already running for agent: {agent_id}")
            return

        if agent_config.get("type") == "VIDEO":
            logger.info(f"Starting Video Ingestion Worker for hardware agent: {agent_id} at {agent_config.get('url')}")
            task = asyncio.create_task(self._consume_mjpeg(agent_config))
            # Tag the task for tracking
            setattr(task, 'agent_id', agent_id)
            self._tasks.append(task)
        elif agent_config.get("type") == "AUDIO":
            logger.info(f"Audio hardware agent registered: {agent_id} (Awaiting implementation)")

    async def stop(self):
        self._running = False
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []

    async def _consume_mjpeg(self, agent_config: dict):
        agent_id = agent_config["id"]
        url = agent_config["url"]
        self._sequence_map[agent_id] = 0
        
        while self._running:
            try:
                # Use a long timeout for the stream
                timeout = aiohttp.ClientTimeout(total=None, connect=10, sock_read=60)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(url) as response:
                        if response.status != 200:
                            logger.error(f"Hardware agent {agent_id} stream returned {response.status}")
                            await asyncio.sleep(5)
                            continue
                        
                        logger.info(f"Connected to ESP32-CAM: {agent_id}")
                        
                        buffer = bytearray()
                        async for chunk in response.content.iter_any():
                            if not self._running:
                                break
                                
                            buffer.extend(chunk)
                            
                            # Process all JPEGs currently in the buffer
                            while True:
                                soi = buffer.find(b'\xff\xd8')
                                eoi = buffer.find(b'\xff\xd9')
                                
                                if soi != -1 and eoi != -1 and eoi > soi:
                                    # Found a complete JPEG frame
                                    jpg_data = buffer[soi:eoi+2]
                                    
                                    # Move buffer pointer forward
                                    del buffer[:eoi+2]
                                    
                                    # Encapsulate in NISHA Binary Frame
                                    await self._relay_frame(agent_id, STREAM_TYPE_VIDEO, jpg_data)
                                    
                                    # Update sequence
                                    self._sequence_map[agent_id] += 1
                                    
                                    # Basic rate limiting / yield to loop
                                    await asyncio.sleep(0.001) 
                                else:
                                    # If we have a lot of junk before SOI, clear it
                                    if soi > 0:
                                        del buffer[:soi]
                                    elif soi == -1 and len(buffer) > 10000:
                                        # Clear buffer if no SOI found in 10KB
                                        buffer.clear()
                                    break
                                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in MJPEG worker for {agent_id}: {e}")
                await asyncio.sleep(5)

    async def _relay_frame(self, agent_id: str, stream_type: int, payload: bytes):
        """Wraps raw data in NISHA header and puts into the master's stream queue."""
        timestamp = int(time.time() * 1000)
        sequence = self._sequence_map.get(agent_id, 0)
        
        # Inject standard telemetry metadata
        meta = {
            "agent_id": agent_id,
            "rssi": -42,  # Mocked for hardware agents
            "battery": 100,
            "is_hardware": True,
            "source": "master_relay"
        }
        meta_bytes = json.dumps(meta).encode('utf-8')
        
        # Header: magic(2s), ver(B), type(B), prio(B), res(B), seq(I), ts(Q), payload_len(I), meta_len(H)
        header = struct.pack(
            FRAME_HEADER_FORMAT,
            b"NI",           # magic
            0x01,            # version
            stream_type,     # stream_type
            PRIORITY_HIGH,   # priority
            0x00,            # reserved
            sequence,        # sequence
            timestamp,       # timestamp
            len(payload),    # payload_len
            len(meta_bytes)  # meta_len
        )
        
        full_frame = header + meta_bytes + payload
        
        # Non-blocking put into the master's internal stream queue
        try:
            self.stream_queue.put_nowait(full_frame)
        except asyncio.QueueFull:
            # Drop frames if backend relay is congested
            pass
