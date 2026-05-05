from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from pydantic import BaseModel, Field

from nisha.dependencies import get_agent_service, get_master_service
from nisha.domain.models.enums import AgentStatus

router = APIRouter(prefix="/mobile", tags=["mobile"])

# -------------------- SCHEMAS --------------------

class DeviceInfo(BaseModel):
    model: str
    osVersion: str
    appVersion: str

class RegisterRequest(BaseModel):
    phone_hash: str
    mode: Literal['AGENT', 'MASTER']
    device_info: DeviceInfo

class AgentConfig(BaseModel):
    heartbeat_interval_ms: int
    buffer_size_mb: int
    max_children: int

class RegisterResponse(BaseModel):
    agent_id: str
    mode: str
    config: AgentConfig

class HeartbeatRequest(BaseModel):
    agent_id: str
    mode: str
    battery: float
    master_id: Optional[str] = None
    detection_count_24h: int = 0

class DetectionPayload(BaseModel):
    id: str
    type: Literal['audio', 'video', 'location']
    subType: str
    confidence: float
    priority: int
    timestamp: str

class BatchRequest(BaseModel):
    master_id: str
    events: List[DetectionPayload] = []
    heartbeats: List[HeartbeatRequest] = []

# -------------------- ROUTES --------------------

@router.post("/register", response_model=RegisterResponse)
async def register_mobile(
    req: RegisterRequest,
    agent_svc=Depends(get_agent_service)
):
    """Bridge mobile registration to the main Agent service."""
    # Map mobile mode to internal status if necessary
    # For now, we utilize the agent_id prefixing the mobile app expects
    prefix = "A-" if req.mode == "AGENT" else "M-"
    suggested_id = f"{prefix}{uuid.uuid4().hex[:6].upper()}"
    
    agent = await agent_svc.register_agent(
        agent_id=suggested_id,
        capabilities={
            "audio": True, 
            "video": True, 
            "mobile": True,
            "os": req.device_info.osVersion
        },
        firmware_version=req.device_info.appVersion,
        location_zone="mobile-net"
    )
    
    # Return the config the mobile app expects
    config = AgentConfig(
        heartbeat_interval_ms=5000 if req.mode == "MASTER" else 30000,
        buffer_size_mb=500 if req.mode == "MASTER" else 50,
        max_children=10 if req.mode == "MASTER" else 0,
    )
    
    return RegisterResponse(agent_id=agent.agent_id, mode=req.mode, config=config)

@router.post("/heartbeat")
async def mobile_heartbeat(
    req: HeartbeatRequest,
    agent_svc=Depends(get_agent_service)
):
    """Process heartbeat from a mobile agent."""
    # Update metrics in the main repo
    await agent_svc.update_agent_status(
        req.agent_id, 
        AgentStatus.ACTIVE, 
        f"Mobile heartbeat - Battery: {req.battery}%"
    )
    
    return {
        "acknowledged": True,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "commands": []
    }

@router.post("/batch")
async def master_batch(
    req: BatchRequest,
    agent_svc=Depends(get_agent_service)
):
    """Process a batch of events from a mobile Master node."""
    # In a full integration, we would create AudioEvent/VideoEvent records here
    # For now, we acknowledge to keep the master flowing
    return {
        "accepted": len(req.events),
        "heartbeats_accepted": len(req.heartbeats),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }

@router.post("/stream/chunk")
async def upload_stream_chunk(
    request: Request,
    agent_id: str = Header(...),
    conn_mgr: ConnectionManager = Depends(lambda: router.state.connection_manager if hasattr(router, 'state') else None)
):
    """HTTP fallback for binary chunks when WebSocket is unstable."""
    body = await request.body()
    
    # We need access to the global connection manager
    from nisha.api.v1.ws import connection_manager as global_cm
    if global_cm:
        await global_cm.handle_binary_frame(agent_id, body)
        return {"status": "queued"}
    
    return {"status": "error", "message": "Connection manager not initialized"}
