"""WebSocket connection manager for real-time communication."""

from __future__ import annotations

import json
import logging
import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set, Union
import base64
import numpy as np

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import async_sessionmaker
from .protocol import NISHAFrame
from nisha.infrastructure.database.models import VideoEventModel, AudioEventModel

logger = logging.getLogger(__name__)


@dataclass
class WebSocketClient:
    websocket: WebSocket
    client_id: str
    is_master: bool = False
    subscriptions: Set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_heartbeat: float = field(default_factory=time.time)
    bytes_received: int = 0
    agent_count: int = 0
    master_id: Optional[str] = None


class ConnectionManager:
    """Manages WebSocket connections for real-time communication.
    
    Supports:
    - Topic-based subscriptions (all, alerts, agent:{id}, master:{id})
    - Binary frame ingestion with priority queues
    - Adaptive streaming control
    """

    def __init__(self, session_factory: Optional[async_sessionmaker] = None) -> None:
        self._clients: Dict[str, WebSocketClient] = {}
        self._topic_subscribers: Dict[str, Set[str]] = {}  # topic -> client_ids
        self._session_factory = session_factory
        self._last_heartbeat_update: Dict[str, float] = {}  # Track last DB update per agent
        self._last_location_update: Dict[str, float] = {}   # Track last GPS update per agent
        self._agent_status_cache: Dict[str, str] = {}       # Local cache of agent statuses
        self._last_audio_level: Dict[str, int] = {}         # Track latest intensity level per agent
        
        # Priority queues for stream processing
        self.critical_queue = asyncio.Queue(maxsize=1000)
        self.event_queue = asyncio.Queue(maxsize=5000)
        self.continuous_queue = asyncio.Queue(maxsize=20000)
        self.background_queue = asyncio.Queue(maxsize=50000)
        
        # Workers will be started by main.py or similar
        self._workers: list[asyncio.Task] = []

    async def connect(self, websocket: WebSocket, client_id: str, is_master: bool = False) -> WebSocketClient:
        await websocket.accept()
        client = WebSocketClient(websocket=websocket, client_id=client_id, is_master=is_master)
        self._clients[client_id] = client
        self._subscribe_client(client_id, "all")
        if is_master:
            self._subscribe_client(client_id, f"master:{client_id}")
            
        logger.info("WebSocket %s connected: %s", "master" if is_master else "client", client_id)
        return client

    def set_master_id(self, client_id: str, master_id: str) -> None:
        client = self._clients.get(client_id)
        if client:
            client.master_id = master_id
            logger.info("Associated client %s with master_id %s", client_id, master_id)

    async def disconnect(self, client_id: str) -> None:
        client = self._clients.pop(client_id, None)
        if client:
            for topic in list(client.subscriptions):
                self._unsubscribe_client(client_id, topic)
            logger.info("WebSocket client disconnected: %s", client_id)

    async def _update_agent_heartbeat(self, agent_id: str, master_id: str | None) -> None:
        """Throttled heartbeat update with immediate bypass for recoveries."""
        now = time.time()
        last_update = self._last_heartbeat_update.get(agent_id, 0)
        current_cached_status = self._agent_status_cache.get(agent_id)
        
        # Bypass throttle if we don't know the status yet or if it was recently offline
        # This ensures recovery is immediate while steady-state is throttled
        is_steady_state = current_cached_status == "ACTIVE" and (now - last_update < 10)
        
        if is_steady_state:
            return

        try:
            from nisha.infrastructure.database.session import async_session_factory
            from nisha.infrastructure.database.repositories.agent_repo import SqlAlchemyAgentRepository
            
            async with async_session_factory() as session:
                repo = SqlAlchemyAgentRepository(session)
                # update_last_heartbeat returns True if status transitioned to ACTIVE
                recovered = await repo.update_last_heartbeat(agent_id, master_id)
                await session.commit()
                self._last_heartbeat_update[agent_id] = now
                self._agent_status_cache[agent_id] = "ACTIVE"
                
                # Immediate notification for recovery or first-time see
                if recovered or current_cached_status != "ACTIVE":
                    await self.broadcast({
                        "type": "AGENT_STATUS",
                        "agent_id": agent_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "payload": {"status": "ACTIVE", "reason": "heartbeat_recovery"}
                    })
        except Exception as e:
            logger.error(f"Heartbeat update failed for {agent_id}: {e}")

    async def dispatch_command_to_master(self, master_id: str, agent_id: str, command: dict) -> bool:
        """Finds a connected master and relays a command to one of its agents."""
        for client in self._clients.values():
            if client.is_master and client.master_id == master_id:
                try:
                    await client.websocket.send_json({
                        "type": "AGENT_COMMAND",
                        "agent_id": agent_id,
                        "command": command
                    })
                    logger.info("Relayed command %s to agent %s via master %s", 
                                command.get("type"), agent_id, master_id)
                    return True
                except Exception as e:
                    logger.error("Failed to relay command to master %s: %s", master_id, e)
        return False

    async def handle_binary_frame(self, client_id: str, data: bytes) -> None:
        """Process incoming binary data according to NISHA protocol."""
        client = self._clients.get(client_id)
        if not client:
            return

        client.bytes_received += len(data)
        
        try:
            frame = NISHAFrame.from_bytes(data)
            
            # Update agent heartbeat in DB (Throttled & Safe Session)
            agent_id = frame.metadata.get("agent_id")
            if agent_id:
                asyncio.create_task(self._update_agent_heartbeat(agent_id, client.master_id))

            # Route by priority
            if frame.priority == NISHAFrame.CRITICAL:
                await self.critical_queue.put(frame)
            elif frame.priority == NISHAFrame.EVENT:
                await self.event_queue.put(frame)
            elif frame.priority == NISHAFrame.CONTINUOUS:
                # Basic adaptive drop if queue is near full
                if self.continuous_queue.qsize() < self.continuous_queue.maxsize * 0.9:
                    await self.continuous_queue.put(frame)
                else:
                    logger.debug("Dropping continuous frame due to queue pressure")
            else: # BACKGROUND
                if self.background_queue.qsize() < self.background_queue.maxsize * 0.95:
                    await self.background_queue.put(frame)
                    
            # Real-time Telemetry Broadcast for Dashboard
            # type 0x04 = LOCATION, type 0x03 = AUDIO/TELEMETRY
            if frame.stream_type in [0x04, 0x03] or (frame.stream_type == 0x01 and frame.metadata.get("gps")):
                agent_id = frame.metadata.get("agent_id")
                master_id = client.master_id
                
                payload_data = {}
                audio_level = self._last_audio_level.get(agent_id)
                
                # If no level recorded yet, provide a low ambient baseline
                if audio_level is None:
                    audio_level = 30 + (int(time.time()) % 5)
                
                try:
                    # ONLY parse JSON for LITE or LOCATION frames. 
                    # AUDIO (0x03) is raw binary and should NOT be parsed as JSON.
                    if frame.stream_type != 0x03 and frame.payload:
                        payload_data = json.loads(frame.payload.decode('utf-8'))
                    else:
                        payload_data = {}
                except:
                    payload_data = {}

                telemetry = {
                    "type": "NODE_DATA",
                    "agent_id": agent_id,
                    "master_id": master_id,
                    "battery": payload_data.get("battery") if payload_data.get("battery") is not None else frame.metadata.get("battery", 100),
                    "signal_strength": payload_data.get("signal") if payload_data.get("signal") is not None else frame.metadata.get("signal", -50),
                    "audio_level": audio_level,
                    "timestamp": time.time()
                }
                
                # Only update GPS if we actually have a lock
                lat = payload_data.get("lat") or frame.metadata.get("gps", {}).get("lat")
                lng = payload_data.get("lng") or frame.metadata.get("gps", {}).get("lng")
                if lat is not None and lng is not None:
                    telemetry["gps_lat"] = lat
                    telemetry["gps_lng"] = lng
                    
                asyncio.create_task(self.broadcast(telemetry))
                    
        except Exception as e:
            logger.error("Failed to parse binary frame from %s: %s", client_id, e)

    def subscribe(self, client_id: str, topic: str) -> None:
        self._subscribe_client(client_id, topic)

    def unsubscribe(self, client_id: str, topic: str) -> None:
        self._unsubscribe_client(client_id, topic)

    async def send_to_client(self, client_id: str, message: dict[str, Any]) -> None:
        client = self._clients.get(client_id)
        if client:
            try:
                await client.websocket.send_json(message)
            except Exception:
                logger.warning("Failed to send to client %s, disconnecting", client_id)
                await self.disconnect(client_id)

    async def broadcast_to_topic(self, topic: str, message: dict[str, Any]) -> None:
        subscriber_ids = self._topic_subscribers.get(topic, set()).copy()
        for client_id in subscriber_ids:
            await self.send_to_client(client_id, message)

    async def _handle_video_clip(self, frame, agent_id, ai_processor, db_writer, name, correlation_engine, alert_generator):
        """Handle video clip processing and persistence in background."""
        try:
            behavior = "NonViolence"
            confidence = 1.0
            
            if ai_processor:
                # 1. AI Inference (pass metadata for raw_rgb handling)
                behavior, confidence = await ai_processor.process_video_frame(frame.payload, frame.metadata)
            
            # 2. Persistence
            if db_writer:
                import uuid
                logger.info(f"Ingesting VIDEO CLIP from {agent_id} ({len(frame.payload)} bytes)")
                
                # Convert raw RGB to JPEG for storage if needed
                video_data_for_storage = frame.payload
                if frame.metadata.get('format') == 'raw_rgb':
                    try:
                        import cv2
                        w = frame.metadata.get('width', 160)
                        h = frame.metadata.get('height', 120)
                        img = np.frombuffer(frame.payload[:w*h*3], np.uint8).reshape((h, w, 3))
                        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                        _, jpeg_data = cv2.imencode('.jpg', img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 70])
                        video_data_for_storage = jpeg_data.tobytes()
                    except Exception as e:
                        logger.warning(f"Failed to convert raw RGB to JPEG: {e}")
                
                await db_writer.add_item(VideoEventModel, {
                    "id": str(uuid.uuid4()),
                    "agent_id": agent_id,
                    "timestamp": datetime.now(timezone.utc),
                    "priority": "1" if name == "CRITICAL" else "2",
                    "behavior": behavior.lower() if behavior else "nonviolence",
                    "confidence": confidence,
                    "location_zone": frame.metadata.get("zone"),
                    "video_data": base64.b64encode(video_data_for_storage).decode('utf-8'),
                    "metadata": frame.metadata
                })

            # 3. Notify Frontend
            await self.broadcast({
                "type": "NEW_CLIP",
                "agent_id": agent_id,
                "media_type": "video",
                "behavior": behavior
            })

            # 4. Multi-agent Correlation (Only if not non-violence)
            if behavior and behavior != "NonViolence" and correlation_engine:
                lat = frame.metadata.get("gps", {}).get("lat")
                lng = frame.metadata.get("gps", {}).get("lng")
                
                correlated = correlation_engine.add_detection(
                    agent_id, behavior, confidence, lat, lng
                )
                
                if correlated and alert_generator:
                    await alert_generator.generate_from_correlation(correlated)
                elif alert_generator:
                    await alert_generator.generate_single_agent_alert(
                        agent_id, behavior, confidence, name
                    )
        except Exception as e:
            logger.error(f"Error handling video clip from {agent_id}: {e}")

    async def broadcast(self, message: dict[str, Any]) -> None:
        await self.broadcast_to_topic("all", message)

    def _subscribe_client(self, client_id: str, topic: str) -> None:
        client = self._clients.get(client_id)
        if client:
            client.subscriptions.add(topic)
            if topic not in self._topic_subscribers:
                self._topic_subscribers[topic] = set()
            self._topic_subscribers[topic].add(client_id)

    def _unsubscribe_client(self, client_id: str, topic: str) -> None:
        client = self._clients.get(client_id)
        if client:
            client.subscriptions.discard(topic)
        subscribers = self._topic_subscribers.get(topic)
        if subscribers:
            subscribers.discard(client_id)

    def start_workers(self, app_state: Any) -> None:
        """Start background workers for processing priority queues."""
        if self._workers:
            return
            
        self._workers = [
            asyncio.create_task(self._worker_loop("CRITICAL", self.critical_queue, app_state)),
            asyncio.create_task(self._worker_loop("EVENT", self.event_queue, app_state)),
            asyncio.create_task(self._worker_loop("CONTINUOUS", self.continuous_queue, app_state)),
            asyncio.create_task(self._worker_loop("BACKGROUND", self.background_queue, app_state)),
        ]
        logger.info("Started %d priority queue workers", len(self._workers))

    async def stop_workers(self) -> None:
        """Stop all background workers."""
        for task in self._workers:
            task.cancel()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
            self._workers = []
        logger.info("Stopped priority queue workers")

    async def _worker_loop(self, name: str, queue: asyncio.Queue, app_state: Any) -> None:
        """Main worker loop for a specific priority queue."""
        logger.info("Worker %s started", name)
        
        # Access services from app_state
        ai_processor = getattr(app_state, "ai_processor", None)
        correlation_engine = getattr(app_state, "correlation_engine", None)
        alert_generator = getattr(app_state, "alert_generator", None)
        db_writer = getattr(app_state, "db_writer", None)
        
        try:
            while True:
                frame: NISHAFrame = await queue.get()
                
                if frame.stream_type == NISHAFrame.VIDEO:
                    # Offload video processing and persistence to a background task
                    # This prevents slow AI inference from blocking the worker loop
                    agent_id = frame.metadata.get("agent_id", "unknown")
                    asyncio.create_task(self._handle_video_clip(frame, agent_id, ai_processor, db_writer, name, correlation_engine, alert_generator))
                    continue

                elif frame.stream_type == NISHAFrame.AUDIO:
                    agent_id = frame.metadata.get("agent_id", "unknown")
                    
                    # 1. Real Audio Classification via AI module
                    if ai_processor:
                        classification, confidence, transcription = await ai_processor.process_audio_frame(frame.payload, frame.metadata)
                        # Extract intensity for the dashboard pulse (scale to 0-100)
                        if frame.metadata.get('format') != 'aac':
                            try:
                                import numpy as np
                                samples = np.frombuffer(frame.payload, dtype=np.int16).astype(np.float32)
                                if len(samples) > 0:
                                    rms = np.sqrt(np.mean(samples**2))
                                    level = int(min(rms / 327.68, 100)) # Simple scale
                                    self._last_audio_level[agent_id] = level
                            except: pass
                    else:
                        classification, confidence, transcription = "AmbientNoise", 1.0, None
                    
                    # 2. Prepare audio data (WAV wrapping only for Raw PCM)
                    if frame.metadata.get('format') == 'aac':
                        encoded_audio = base64.b64encode(frame.payload).decode('utf-8')
                    else:
                        import struct
                        sample_rate = 16000
                        bits_per_sample = 16
                        channels = 1
                        byte_rate = sample_rate * channels * bits_per_sample // 8
                        block_align = channels * bits_per_sample // 8
                        data_size = len(frame.payload)
                        
                        wav_header = struct.pack(
                            '<4sI4s4sIHHIIHH4sI',
                            b'RIFF', 36 + data_size, b'WAVE', b'fmt ', 16, 1, channels,
                            sample_rate, byte_rate, block_align, bits_per_sample, b'data', data_size
                        )
                        wav_payload = wav_header + frame.payload
                        encoded_audio = base64.b64encode(wav_payload).decode('utf-8')
                    
                    # 3. Persistence - Only save to DB if it's a meaningful event (not ambient)
                    if db_writer and classification != "AmbientNoise":
                        import uuid
                        await db_writer.add_item(AudioEventModel, {
                            "id": str(uuid.uuid4()),
                            "agent_id": agent_id,
                            "timestamp": datetime.now(timezone.utc),
                            "priority": "1" if classification == "Scream" else "2",
                            "event_type": "AUDIO_TRANSMISSION",
                            "class_name": "ambient" if classification == "AmbientNoise" else "speech" if classification == "VoicePattern" else "shout",
                            "confidence": confidence,
                            "transcription": transcription,
                            "location_zone": frame.metadata.get("zone"),
                            "audio_data": encoded_audio
                        })
                    
                    # 4. Notify Frontend for Instant Update
                    asyncio.create_task(self.broadcast({
                        "type": "NEW_CLIP",
                        "agent_id": agent_id,
                        "media_type": "audio",
                        "classification": classification,
                        "audio_data": encoded_audio # Send immediate audio for pulse play
                    }))

                    # 3. Real-time Broadcast to Dashboard
                    if transcription:
                        alert = {
                            "type": "THRESHOLD_ALERT",
                            "alert_id": str(uuid.uuid4()),
                            "agent_id": agent_id,
                            "severity": "low",
                            "description": transcription,
                            "event_type": "AUDIO",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        asyncio.create_task(self.broadcast(alert))
                
                elif frame.stream_type == 0x04: # LOCATION
                    agent_id = frame.metadata.get("agent_id")
                    if agent_id and self._session_factory:
                        now = time.time()
                        last_loc_update = self._last_location_update.get(agent_id, 0)
                        if now - last_loc_update < 5:
                            continue

                        try:
                            loc_data = json.loads(frame.payload.decode('utf-8'))
                            lat = loc_data.get("lat")
                            lng = loc_data.get("lng")
                            if lat is not None and lng is not None:
                                from nisha.infrastructure.database.repositories.agent_repo import SqlAlchemyAgentRepository
                                async with self._session_factory() as session:
                                    repo = SqlAlchemyAgentRepository(session)
                                    agent = await repo.get_by_id(agent_id)
                                    if agent:
                                        agent.gps_lat = lat
                                        agent.gps_lng = lng
                                        await session.commit()
                                        self._last_location_update[agent_id] = now
                                        logger.info(f"Updated GPS for {agent_id}: {lat}, {lng}")
                        except Exception as e:
                            logger.error(f"Failed to update location for {agent_id}: {e}")
                
                queue.task_done()
        except asyncio.CancelledError:
            logger.info("Worker %s shutting down", name)
        except Exception as e:
            logger.error("Worker %s encountered error: %s", name, e)

    @property
    def active_connections(self) -> int:
        return len(self._clients)

    @property
    def client_ids(self) -> list[str]:
        return list(self._clients.keys())
