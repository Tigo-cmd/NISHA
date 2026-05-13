import asyncio
import struct
import logging
import time
import base64
import json
import httpx
import sys
from pathlib import Path
from typing import Dict, Any

# Path hack to import AI modules from the parent project structure
project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from nisha_master.core.audio_buffer import AudioBuffer
try:
    from ai.audio_processor.processor import AudioClassifier
except ImportError:
    # Fallback if pathing fails in some environments
    AudioClassifier = None

import json
from websockets.asyncio.server import serve, ServerConnection

logger = logging.getLogger(__name__)

# The 24-byte binary frame header format:
# 2s: magic (NI)
# B: version
# B: stream_type
# B: priority
# B: reserved
# I: sequence
# Q: timestamp
# I: payload_len
# H: meta_len
FRAME_HEADER_FORMAT = "!2sBBBB I Q I H"
HEADER_SIZE = 24


class AgentWebSocketServer:
    def __init__(self, port: int, stream_queue: asyncio.Queue, telemetry_queue: asyncio.Queue, metrics_store, hw_worker=None):
        self.port = port
        self.stream_queue = stream_queue
        self.telemetry_queue = telemetry_queue
        self.metrics_store = metrics_store
        self.hw_worker = hw_worker
        self.active_agents: Dict[str, ServerConnection] = {}
        self.total_inbound_bytes = 0
        
        # Audio Transcription state
        self.audio_buffers: Dict[str, AudioBuffer] = {}
        self.audio_classifier = AudioClassifier() if AudioClassifier else None
        
        # Pull AI service URLs from centralized config
        from nisha_master.config import settings
        self.ai_service_url = f"http://{settings.backend_host}:8083/api/v1/transcribe"
        self.ai_stream_url = f"ws://{settings.backend_host}:8083/api/v1/stream"
        
        self.ai_connections: Dict[str, Any] = {} # Persistent streams
        self.ai_pending: set[str] = set() # Track connecting state
        self.http_client = httpx.AsyncClient(timeout=10.0)

    async def handle_client(self, websocket: ServerConnection):
        """Main handler for a connected agent."""
        agent_id = "UNKNOWN"
        agent_mode = "UNKNOWN"
        agent_type = "LEGACY"  # Default type
        print(f"[DEBUG] New connection received on port {self.port}")
        try:
            async for message in websocket:
                # 1. INITIAL HANDSHAKE (TEXT/JSON)
                if isinstance(message, str):
                    try:
                        # Try to parse as JSON handshake from mobile/modern clients
                        handshake = json.loads(message)
                        if handshake.get("type") == "HANDSHAKE":
                            agent_id = handshake.get("agent_id", "UNKNOWN")
                            agent_mode = handshake.get("mode", "AGENT")
                            agent_type = handshake.get("agent_type", "MOBILE" if agent_mode == "AGENT" else "LEGACY")
                            self.active_agents[agent_id] = websocket
                            print(f"[DEBUG] Handshake successful: {agent_id} (type: {agent_type}, mode: {agent_mode})")
                            
                            # Support for dynamic hardware stream registration
                            stream_url = handshake.get("stream_url")
                            if stream_url and self.hw_worker:
                                # Defensive check for dynamically added hardware agents
                                if hasattr(self.hw_worker, 'add_agent'):
                                    asyncio.create_task(self.hw_worker.add_agent({
                                        "id": agent_id,
                                        "url": stream_url,
                                        "type": "VIDEO",
                                        "agent_type": "HARDWARE" # Explicitly mark as hardware if relaying
                                    }))
                                else:
                                    logger.error(f"[ERROR] HardwareIngestionWorker missing 'add_agent' method. Type: {type(self.hw_worker)}")

                            # Initialize agent stats
                            if agent_id not in self.metrics_store.agent_stats:
                                self.metrics_store.agent_stats[agent_id] = {
                                    "agent_id": agent_id,
                                    "mode": agent_mode,
                                    "agent_type": agent_type,
                                    "device_info": handshake.get("device_info", {}),
                                    "stream_url": stream_url
                                }
                            else:
                                # Update existing stats
                                self.metrics_store.agent_stats[agent_id].update({
                                    "agent_type": agent_type,
                                    "mode": agent_mode
                                })
                            continue
                    except json.JSONDecodeError:
                        # Fallback to simple string ID for legacy clients
                        agent_id = message.strip()
                        agent_mode = "LEGACY"
                        self.active_agents[agent_id] = websocket
                        print(f"[DEBUG] Legacy handshake: {agent_id}")
                        if agent_id not in self.metrics_store.agent_stats:
                            self.metrics_store.agent_stats[agent_id] = {"agent_id": agent_id, "mode": "LEGACY"}
                        continue

                # 2. HEARTBEAT MESSAGE (TEXT/JSON)
                if isinstance(message, str):
                    try:
                        heartbeat = json.loads(message)
                        if heartbeat.get("type") == "HEARTBEAT":
                            agent_id = heartbeat.get("agent_id", agent_id)
                            if agent_id in self.metrics_store.agent_stats:
                                stats = self.metrics_store.agent_stats[agent_id]
                                stats["last_seen"] = time.time()
                                stats["battery"] = heartbeat.get("battery", 100)
                                stats["rssi"] = heartbeat.get("rssi", -65)
                            print(f"[DEBUG] Heartbeat from {agent_id}: battery={heartbeat.get('battery')}%, rssi={heartbeat.get('rssi')}")
                            continue
                    except json.JSONDecodeError:
                        pass

                # 3. BINARY FRAMES
                if not isinstance(message, (bytes, bytearray, memoryview)):
                    continue

                try:
                    view = memoryview(message)
                    if len(view) < HEADER_SIZE:
                        continue
                    
                    self.total_inbound_bytes += len(view)
                    header_data = struct.unpack(FRAME_HEADER_FORMAT, view[:HEADER_SIZE])
                    
                    stream_type = header_data[2]
                    payload_len = header_data[7]
                    meta_len = header_data[8]
                    
                    if agent_id not in self.metrics_store.agent_stats:
                        self.metrics_store.agent_stats[agent_id] = {"agent_id": agent_id, "mode": agent_mode}
                    
                    stats = self.metrics_store.agent_stats[agent_id]
                    stats["last_seen"] = time.time()
                    stats["rssi"] = header_data[3]
                    stats["battery"] = 100

                    if stream_type == 0x01: # LITE (Telemetry / Alert)
                        payload = bytes(view[HEADER_SIZE + meta_len : HEADER_SIZE + meta_len + payload_len])
                        try:
                            lite_data = json.loads(payload.decode('utf-8'))
                            stats.update(lite_data)
                            stats["stream_type"] = "LITE"
                            # Also relay telemetry to the master's telemetry queue for local dashboard
                            await self.telemetry_queue.put({"agent_id": agent_id, **lite_data})
                            print(f"[DEBUG] Received LITE from {agent_id}: {lite_data}")
                        except Exception as je:
                            print(f"[DEBUG] LITE JSON Error: {je}")

                    elif stream_type == 0x02: # VIDEO (10s/30s clip)
                        payload = bytes(view[HEADER_SIZE + meta_len : HEADER_SIZE + meta_len + payload_len])
                        
                        # Parse metadata to check if this is raw RGB pixel data
                        frame_meta = {}
                        if meta_len > 0:
                            try:
                                frame_meta = json.loads(bytes(view[HEADER_SIZE : HEADER_SIZE + meta_len]).decode('utf-8'))
                            except: pass
                        
                        if frame_meta.get('format') == 'raw_rgb':
                            # Hyper-Streaming: Broadcast frame directly to dashboard via WS
                            # This bypasses the need for an extra HTTP fetch
                            b64_frame = base64.b64encode(payload).decode('utf-8')
                            stats["latest_video"] = b64_frame
                            stats["_video_mime"] = "video/raw_rgb"
                            stats["video_width"] = frame_meta.get('width', 160)
                            stats["video_height"] = frame_meta.get('height', 120)
                            
                            from nisha_master.interfaces.dashboard import ws_manager
                            asyncio.create_task(ws_manager.broadcast({
                                "type": "VIDEO_FRAME",
                                "agent_id": agent_id,
                                "base64": b64_frame,
                                "width": stats["video_width"],
                                "height": stats["video_height"]
                            }))
                        else:
                            # Standard update for JPEGs - Broadcast full frame for zero-latency dashboard
                            b64_frame = base64.b64encode(payload).decode('utf-8')
                            stats["latest_video"] = b64_frame
                            stats["_video_mime"] = "image/jpeg"
                            
                            from nisha_master.interfaces.dashboard import ws_manager
                            asyncio.create_task(ws_manager.broadcast({
                                "type": "LIVE_FRAME",
                                "agent_id": agent_id,
                                "base64": b64_frame,
                                "mime": "image/jpeg"
                            }))
                        print(f"[DEBUG] Received VIDEO CLIP from {agent_id}: {len(payload)} bytes")
                    
                    elif stream_type == 0x03: # AUDIO
                        payload = bytes(view[HEADER_SIZE + meta_len : HEADER_SIZE + meta_len + payload_len])
                        
                        frame_meta = {}
                        if meta_len > 0:
                            try:
                                frame_meta = json.loads(bytes(view[HEADER_SIZE : HEADER_SIZE + meta_len]).decode('utf-8'))
                            except: pass
                        
                        # 1. Basic VAD and Local Dashboard Stats
                        has_speech = False
                        if self.audio_classifier and frame_meta.get('format') != 'aac':
                            classification, confidence, _ = self.audio_classifier.process_audio(payload)
                            has_speech = classification == "VoicePattern"
                            if has_speech:
                                stats["is_speaking"] = True
                                stats["speech_confidence"] = confidence
                            else:
                                stats["is_speaking"] = False

                            # 2. Real-time Streaming Logic
                            if agent_id not in self.ai_connections and agent_id not in self.ai_pending:
                                self.ai_pending.add(agent_id)
                                asyncio.create_task(self._init_ai_stream(agent_id))
                            
                            # Send raw audio immediately to the AI Brain
                            await self._stream_to_ai(agent_id, payload)

                        # 3. Legacy Dashboard Updates
                        if frame_meta.get('format') == 'aac':
                            stats["latest_audio"] = base64.b64encode(payload).decode('utf-8')
                            stats["_audio_mime"] = "audio/m4a"
                        else:
                            # Pulse data for dashboard
                            stats["latest_audio"] = base64.b64encode(payload).decode('utf-8')
                            stats["_audio_mime"] = "audio/pcm"
                            stats["is_live_audio"] = True
                            
                        stats["audio_updated_at"] = time.time()
                        print(f"[DEBUG] Received AUDIO from {agent_id}: {len(payload)} bytes (Speech: {has_speech})")

                    elif stream_type == 0x04: # LOCATION
                        payload = bytes(view[HEADER_SIZE + meta_len : HEADER_SIZE + meta_len + payload_len])
                        try:
                            loc_data = json.loads(payload.decode('utf-8'))
                            stats["location"] = loc_data
                            stats["stream_type"] = "GPS"
                            print(f"[DEBUG] Receiving location: {loc_data.get('lat')} {loc_data.get('lng')}")
                        except Exception as je:
                            print(f"[DEBUG] JSON Error: {je}")

                    # RELAY TO BACKEND: Inject agent_id into metadata if missing
                    # This ensures the backend knows which agent sent the binary frame
                    try:
                        meta = {}
                        if meta_len > 0:
                            meta_bytes = bytes(view[HEADER_SIZE : HEADER_SIZE + meta_len])
                            try:
                                meta = json.loads(meta_bytes.decode('utf-8'))
                            except: pass
                        
                        # Add agent_id and agent_type to metadata for backend identification
                        meta["agent_id"] = agent_id
                        meta["agent_type"] = agent_type
                        new_meta_bytes = json.dumps(meta).encode('utf-8')
                        new_meta_len = len(new_meta_bytes)
                        
                        # Re-construct the frame with updated metadata
                        new_header = list(header_data)
                        new_header[8] = new_meta_len # Update meta_len
                        header_packed = struct.pack(FRAME_HEADER_FORMAT, *new_header)
                        
                        payload = view[HEADER_SIZE + meta_len : HEADER_SIZE + meta_len + payload_len]
                        full_frame = header_packed + new_meta_bytes + bytes(payload)
                        
                        try:
                            await self.stream_queue.put(full_frame)
                        except asyncio.QueueFull:
                            # Silently drop if queue is full to prevent blocking the worker
                            pass
                    except Exception as re:
                        print(f"[DEBUG] Relay injection error: {re}")
                        # Fallback to original message if injection fails
                        try:
                            await self.stream_queue.put(message)
                        except: pass

                except Exception as e:
                    print(f"[DEBUG] Relay error: {e}")

        except Exception as e:
            print(f"[DEBUG] Connection loop error for {agent_id}: {e}")
        finally:
            print(f"[DEBUG] Cleaning up agent: {agent_id}")
            if agent_id in self.active_agents:
                del self.active_agents[agent_id]

    async def send_command(self, agent_id: str, command: dict):
        """Sends a JSON command to a specific connected agent."""
        if agent_id in self.active_agents:
            ws = self.active_agents[agent_id]
            try:
                await ws.send(json.dumps(command))
                print(f"[DEBUG] Sent command {command} to {agent_id}")
                return True
            except Exception as e:
                print(f"[DEBUG] Failed to send command to {agent_id}: {e}")
        return False

    async def _init_ai_stream(self, agent_id: str):
        """Opens a persistent live pipe to the AI Service on the laptop."""
        import websockets
        uri = f"{self.ai_stream_url}/{agent_id}"
        
        while True:
            try:
                async with websockets.connect(uri) as ws:
                    self.ai_connections[agent_id] = ws
                    self.ai_pending.discard(agent_id)
                    logger.info(f"[AI] Persistent stream established for {agent_id}")
                    
                    async for message in ws:
                        data = json.loads(message)
                        if data.get("type") == "PARTIAL_TRANSCRIPT":
                            text = data["text"]
                            # Update local stats for the diagnostic box
                            if self.metrics_store and agent_id in self.metrics_store.agent_stats:
                                self.metrics_store.agent_stats[agent_id]["last_transcription"] = text
                            
                            # Wrap in binary frame so Backend recognizes it
                            await self._relay_transcription_as_lite(agent_id, text, data.get("language", "en"))
                
            except Exception as e:
                logger.warning(f"[AI] Stream error for {agent_id}: {e}. Reconnecting...")
                self.ai_connections.pop(agent_id, None)
                await asyncio.sleep(3)

    async def _stream_to_ai(self, agent_id: str, audio_data: bytes):
        """Pushes raw audio bytes into the active AI stream."""
        ws = self.ai_connections.get(agent_id)
        if ws:
            try:
                await ws.send(audio_data)
            except:
                self.ai_connections.pop(agent_id, None)

    async def _relay_transcription_as_lite(self, agent_id: str, text: str, language: str):
        """Encapsulate transcription in a NISHA LITE frame and send to Backend."""
        payload = json.dumps({
            "type": "TRANSCRIPTION",
            "text": text,
            "language": language,
            "timestamp": time.time()
        }).encode('utf-8')
        
        # Header: magic(2s), ver(B), type(B), prio(B), res(B), seq(I), ts(Q), payload_len(I), meta_len(H)
        # stream_type 0x01 = LITE
        header = struct.pack(
            FRAME_HEADER_FORMAT,
            b"NI", 0x01, 0x01, 0x01, 0x00, 0, int(time.time()*1000), len(payload), 0
        )
        
        # Meta with agent_id for the relay logic
        meta = {"agent_id": agent_id, "agent_type": "HARDWARE"}
        meta_bytes = json.dumps(meta).encode('utf-8')
        
        # Re-pack with meta_len
        header = struct.pack(
            FRAME_HEADER_FORMAT,
            b"NI", 0x01, 0x01, 0x01, 0x00, 0, int(time.time()*1000), len(payload), len(meta_bytes)
        )
        
        full_frame = header + meta_bytes + payload
        await self.stream_queue.put(full_frame)

    async def _handle_control_message(self, agent_id: str, message: str):
        pass

    async def process_request(self, path, request_headers):
        return None

    async def start(self):
        """Starts the WebSocket server using the modern asyncio API."""
        print(f"[INFO] Agent WS Server starting on port {self.port}")
        async with serve(
            self.handle_client, 
            "", 
            self.port,
            max_size=50 * 1024 * 1024
        ) as server:
            print(f"[INFO] Agent WS Server listening on port {self.port}")
            await server.get_loop().create_future()
