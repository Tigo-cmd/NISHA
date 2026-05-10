import asyncio
import struct
import logging
import time
import base64
import json
from typing import Dict, Any

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

    async def handle_client(self, websocket: ServerConnection):
        """Main handler for a connected agent."""
        agent_id = "UNKNOWN"
        agent_mode = "UNKNOWN"
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
                            self.active_agents[agent_id] = websocket
                            print(f"[DEBUG] Handshake successful: {agent_id} (mode: {agent_mode})")
                            
                            # Support for dynamic hardware stream registration
                            stream_url = handshake.get("stream_url")
                            if stream_url and self.hw_worker:
                                # Defensive check for dynamically added hardware agents
                                if hasattr(self.hw_worker, 'add_agent'):
                                    asyncio.create_task(self.hw_worker.add_agent({
                                        "id": agent_id,
                                        "url": stream_url,
                                        "type": "VIDEO"
                                    }))
                                else:
                                    logger.error(f"[ERROR] HardwareIngestionWorker missing 'add_agent' method. Type: {type(self.hw_worker)}")

                            # Initialize agent stats
                            if agent_id not in self.metrics_store.agent_stats:
                                self.metrics_store.agent_stats[agent_id] = {
                                    "agent_id": agent_id,
                                    "mode": agent_mode,
                                    "device_info": handshake.get("device_info", {}),
                                    "stream_url": stream_url
                                }
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
                            # Standard update for JPEGs
                            stats["latest_video"] = base64.b64encode(payload).decode('utf-8')
                            stats["_video_mime"] = "image/jpeg"
                            from nisha_master.interfaces.dashboard import ws_manager
                            asyncio.create_task(ws_manager.broadcast({
                                "type": "MEDIA_UPDATE",
                                "agent_id": agent_id,
                                "media_type": "video"
                            }))
                        print(f"[DEBUG] Received VIDEO CLIP from {agent_id}: {len(payload)} bytes")
                    
                    elif stream_type == 0x03: # AUDIO (10s/30s clip)
                        payload = bytes(view[HEADER_SIZE + meta_len : HEADER_SIZE + meta_len + payload_len])
                        
                        # Parse metadata to check if this is already encoded audio (e.g. AAC)
                        frame_meta = {}
                        if meta_len > 0:
                            try:
                                frame_meta = json.loads(bytes(view[HEADER_SIZE : HEADER_SIZE + meta_len]).decode('utf-8'))
                            except: pass
                        
                        if frame_meta.get('format') == 'aac':
                            # Already encoded as AAC/M4A, just store it
                            stats["latest_audio"] = base64.b64encode(payload).decode('utf-8')
                            stats["_audio_mime"] = "audio/m4a"
                        elif frame_meta.get('format') == 'pcm_s16le':
                            # Raw PCM Stream chunk (Low Latency)
                            stats["latest_audio"] = base64.b64encode(payload).decode('utf-8')
                            stats["_audio_mime"] = "audio/pcm"
                            stats["is_live_audio"] = True
                        else:
                            # Wrap Raw PCM in a WAV Header for Dashboard Playback
                            # (16kHz, 16-bit, Mono)
                            sample_rate = 16000
                            bits_per_sample = 16
                            channels = 1
                            data_size = len(payload)
                            byte_rate = sample_rate * channels * bits_per_sample // 8
                            block_align = channels * bits_per_sample // 8
                            
                            wav_header = struct.pack(
                                '<4sI4s4sIHHIIHH4sI',
                                b'RIFF', 36 + data_size, b'WAVE', b'fmt ', 16, 1, channels,
                                sample_rate, byte_rate, block_align, bits_per_sample, b'data', data_size
                            )
                            stats["latest_audio"] = base64.b64encode(wav_header + payload).decode('utf-8')
                            stats["_audio_mime"] = "audio/wav"
                            stats["is_live_audio"] = False
                            
                        stats["audio_updated_at"] = time.time()
                        stats["stream_type"] = "AUDIO CLIP"
                        print(f"[DEBUG] Received AUDIO CLIP from {agent_id}: {len(payload)} bytes")

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
                        
                        # Add agent_id to metadata for backend identification
                        meta["agent_id"] = agent_id
                        new_meta_bytes = json.dumps(meta).encode('utf-8')
                        new_meta_len = len(new_meta_bytes)
                        
                        # Re-construct the frame with updated metadata
                        new_header = list(header_data)
                        new_header[8] = new_meta_len # Update meta_len
                        header_packed = struct.pack(FRAME_HEADER_FORMAT, *new_header)
                        
                        payload = view[HEADER_SIZE + meta_len : HEADER_SIZE + meta_len + payload_len]
                        full_frame = header_packed + new_meta_bytes + bytes(payload)
                        
                        await self.stream_queue.put(full_frame)
                    except Exception as re:
                        print(f"[DEBUG] Relay injection error: {re}")
                        # Fallback to original message if injection fails
                        await self.stream_queue.put(message)

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
