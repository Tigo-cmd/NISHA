"""Local Dashboard API and WebSocket streaming for the Master Node.

Collects real-time metrics and broadcasts them to the Vanilla JS UI.
"""
import asyncio
import time
from typing import Dict, List, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Body
import httpx
import logging

from nisha_master.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

class DashboardMetrics:
    def __init__(self):
        self.inbound_bytes_sec: float = 0.0
        self.outbound_bytes_sec: float = 0.0
        self.active_agents: int = 0
        self.ram_buffer_used_mb: float = 0.0
        self.latency_ms: float = 0.0

        # Track agent specific stats
        self.agent_stats: Dict[str, Dict[str, Any]] = {}

    def get_snapshot(self) -> Dict[str, Any]:
        # Create a light version of agent stats without the heavy blobs
        light_agents = []
        for aid, stats in self.agent_stats.items():
            s = stats.copy()
            # Remove heavy blobs from broadcast
            s.pop("latest_video", None)
            s.pop("latest_audio", None)
            light_agents.append(s)

        return {
            "master_id": settings.master_id,
            "timestamp": time.time(),
            "traffic": {
                "inbound_mbps": float(round((self.inbound_bytes_sec * 8) / 1_000_000, 2)),
                "outbound_mbps": float(round((self.outbound_bytes_sec * 8) / 1_000_000, 2)),
            },
            "system": {
                "agents_connected": self.active_agents,
                "ram_buffer_used_mb": float(round(self.ram_buffer_used_mb, 2)),
                "ram_buffer_limit_mb": settings.buffer_ram_limit_mb,
                "pipeline_latency_ms": float(round(self.latency_ms, 2))
            },
            "agents": light_agents
        }

metrics_store = DashboardMetrics()

class DashboardWebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Send a generic JSON message to all connected dashboards."""
        if self.active_connections:
            for connection in self.active_connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def broadcast_snapshot(self):
        """Broadcasts metrics snapshot every 100ms as per the spec."""
        while True:
            if self.active_connections:
                snapshot = metrics_store.get_snapshot()
                for connection in self.active_connections:
                    try:
                        await connection.send_json(snapshot)
                    except Exception:
                        pass
            await asyncio.sleep(0.1)  # 100ms refresh rate

ws_manager = DashboardWebSocketManager()

@router.websocket("/api/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Just keep connection open, we push data via broadcast_snapshot
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

@router.get("/api/stats")
async def get_stats():
    return metrics_store.get_snapshot()

@router.get("/api/agents")
async def get_agents():
    return {"agents": list(metrics_store.agent_stats.values())}

@router.get("/api/agent/{agent_id}/media/{media_type}")
async def get_agent_media(agent_id: str, media_type: str):
    if agent_id not in metrics_store.agent_stats:
        return {"error": "Agent not found"}
    
    stats = metrics_store.agent_stats[agent_id]
    if media_type == "video":
        mime = stats.get("_video_mime", "image/jpeg")
        return {
            "base64": stats.get("latest_video"), 
            "mime": mime,
            "width": stats.get("video_width", 160),
            "height": stats.get("video_height", 120)
        }
    elif media_type == "audio":
        mime = stats.get("_audio_mime", "audio/wav")
        return {
            "base64": stats.get("latest_audio"), 
            "mime": mime,
            "is_live": stats.get("is_live_audio", False)
        }
    
    return {"error": "Invalid media type"}

@router.post("/api/v1/agents")
async def relay_agent_registration(data: Dict[str, Any]):
    """Relays generic agent registration (from hardware nodes) to the main backend."""
    backend_url = f"{settings.backend_base_url}/api/v1/agents"
    logger.info(f"Relaying agent registration to backend: {backend_url}")
    
    async with httpx.AsyncClient() as client:
        try:
            # Relay the auth header if present, or use the master's token
            response = await client.post(
                backend_url,
                json=data,
                headers={"Authorization": f"Bearer {settings.backend_auth_token}"},
                timeout=10.0
            )
            return response.json()
        except Exception as e:
            logger.error(f"Failed to relay agent registration: {e}")
            return {"status": "error", "message": str(e)}

@router.post("/api/v1/mobile/register")
async def relay_mobile_registration(data: Dict[str, Any]):
    """Relays mobile agent registration to the main backend."""
    backend_url = f"{settings.backend_base_url}/api/v1/mobile/register"
    logger.info(f"Relaying registration to backend: {backend_url}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                backend_url,
                json=data,
                timeout=10.0
            )
            return response.json()
        except Exception as e:
            logger.error(f"Failed to relay registration: {e}")
            return {"status": "error", "message": str(e)}

@router.post("/api/v1/mobile/heartbeat")
async def relay_mobile_heartbeat(data: Dict[str, Any]):
    """Relays mobile heartbeat to the central backend."""
    backend_url = f"{settings.backend_base_url}/api/v1/mobile/heartbeat"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(backend_url, json=data, timeout=5.0)
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

@router.post("/api/v1/mobile/batch")
async def relay_mobile_batch(data: Dict[str, Any]):
    """Relays batch event data from mobile master/agents to backend."""
    backend_url = f"{settings.backend_base_url}/api/v1/mobile/batch"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(backend_url, json=data, timeout=15.0)
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

@router.post("/api/v1/mobile/stream/chunk")
async def relay_mobile_stream_chunk(request: Request):
    """Relays binary stream chunks (HTTP fallback) to backend."""
    backend_url = f"{settings.backend_base_url}/api/v1/mobile/stream/chunk"
    agent_id = request.headers.get("agent-id")
    body = await request.body()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                backend_url, 
                content=body, 
                headers={"agent-id": agent_id} if agent_id else {},
                timeout=10.0
            )
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

@router.post("/api/agent/{agent_id}/command")
async def send_agent_command(agent_id: str, command: Dict[str, Any] = Body(...)):
    """Relays a command to a specific agent via its WebSocket."""
    if hasattr(metrics_store, 'agent_server'):
        success = await metrics_store.agent_server.send_command(agent_id, command)
        return {"status": "success" if success else "failed"}
    return {"status": "error", "message": "Agent server not linked"}
