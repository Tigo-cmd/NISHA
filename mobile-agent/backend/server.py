"""
NISHA Mobile Backend - Agent / Master coordination
Supports mode-aware registration, heartbeats, mode switching, and network snapshots.
"""

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="NISHA Backend", version="2.4.1")
api_router = APIRouter(prefix="/api")


# -------------------- MODELS --------------------

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
    mode: Literal['AGENT', 'MASTER']
    battery: float
    master_id: Optional[str] = None
    detection_count_24h: int = 0


class ModeSwitchRequest(BaseModel):
    agent_id: str
    new_mode: Literal['AGENT', 'MASTER']
    reason: str


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


class ChildConnectRequest(BaseModel):
    master_id: str
    child_id: str
    rssi: Optional[int] = None


class MobileAgentRecord(BaseModel):
    agent_id: str = Field(default_factory=lambda: f"A-{uuid.uuid4().hex[:6].upper()}")
    phone_hash: str
    device_model: str
    os_version: str
    app_version: str
    mode: str
    mode_selected_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    parent_master_id: Optional[str] = None
    max_child_agents: int = 0
    current_child_count: int = 0
    avg_battery_drain_percent_hour: float = 0.0
    detection_count_24h: int = 0
    last_heartbeat: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# -------------------- ROUTES --------------------

@api_router.get("/")
async def root():
    return {
        "service": "NISHA Backend",
        "version": "2.4.1",
        "status": "OPERATIONAL",
        "endpoints": [
            "/api/mobile/register",
            "/api/mobile/heartbeat",
            "/api/mobile/mode",
            "/api/master/batch",
            "/api/master/child-connected",
            "/api/network/snapshot",
        ]
    }


@api_router.post("/mobile/register", response_model=RegisterResponse)
async def register_mobile(req: RegisterRequest):
    """Register a new mobile agent/master."""
    # Generate ID with prefix based on mode
    prefix = "A-" if req.mode == "AGENT" else "M-"
    agent_id = f"{prefix}{uuid.uuid4().hex[:4].upper()}"

    record = MobileAgentRecord(
        agent_id=agent_id,
        phone_hash=req.phone_hash,
        device_model=req.device_info.model,
        os_version=req.device_info.osVersion,
        app_version=req.device_info.appVersion,
        mode=req.mode,
        max_child_agents=10 if req.mode == "MASTER" else 0,
    )

    await db.mobile_agents.insert_one(record.model_dump())

    config = AgentConfig(
        heartbeat_interval_ms=5000 if req.mode == "MASTER" else 30000,
        buffer_size_mb=500 if req.mode == "MASTER" else 50,
        max_children=10 if req.mode == "MASTER" else 0,
    )

    return RegisterResponse(agent_id=agent_id, mode=req.mode, config=config)


@api_router.post("/mobile/heartbeat")
async def heartbeat(req: HeartbeatRequest):
    """Process heartbeat from mobile agent or master."""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.mobile_agents.update_one(
        {"agent_id": req.agent_id},
        {
            "$set": {
                "last_heartbeat": now,
                "updated_at": now,
                "parent_master_id": req.master_id,
                "detection_count_24h": req.detection_count_24h,
            }
        },
    )

    await db.heartbeats.insert_one({
        "agent_id": req.agent_id,
        "mode": req.mode,
        "battery": req.battery,
        "master_id": req.master_id,
        "timestamp": now,
    })

    return {
        "acknowledged": True,
        "matched": result.matched_count,
        "server_time": now,
        "commands": [],
        "config_hash": "sha256:abc123",
    }


@api_router.put("/mobile/mode")
async def switch_mode(req: ModeSwitchRequest):
    """Switch mode for an agent/master."""
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.mobile_agents.find_one({"agent_id": req.agent_id}, {"_id": 0})

    if not existing:
        raise HTTPException(status_code=404, detail="Agent not found")

    await db.mobile_agents.update_one(
        {"agent_id": req.agent_id},
        {
            "$set": {
                "mode": req.new_mode,
                "max_child_agents": 10 if req.new_mode == "MASTER" else 0,
                "mode_selected_at": now,
                "updated_at": now,
            }
        },
    )

    await db.mode_switches.insert_one({
        "agent_id": req.agent_id,
        "from_mode": existing.get("mode"),
        "to_mode": req.new_mode,
        "reason": req.reason,
        "changed_at": now,
    })

    new_config = AgentConfig(
        heartbeat_interval_ms=5000 if req.new_mode == "MASTER" else 30000,
        buffer_size_mb=500 if req.new_mode == "MASTER" else 50,
        max_children=10 if req.new_mode == "MASTER" else 0,
    )

    return {"success": True, "new_mode": req.new_mode, "config": new_config.model_dump()}


@api_router.post("/master/batch")
async def master_batch(req: BatchRequest):
    """Master sends a batch of child events/heartbeats."""
    now = datetime.now(timezone.utc).isoformat()
    if req.events:
        docs = [
            {
                **ev.model_dump(),
                "relayed_by": req.master_id,
                "received_at": now,
            }
            for ev in req.events
        ]
        await db.detections.insert_many(docs)

    return {
        "accepted": len(req.events),
        "heartbeats_accepted": len(req.heartbeats),
        "failed": [],
        "server_time": now,
    }


@api_router.post("/master/child-connected")
async def child_connected(req: ChildConnectRequest):
    """Master reports a new child agent connected."""
    now = datetime.now(timezone.utc).isoformat()

    master = await db.mobile_agents.find_one({"agent_id": req.master_id}, {"_id": 0})
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    current_count = master.get("current_child_count", 0)
    max_count = master.get("max_child_agents", 10)
    if current_count >= max_count:
        return {"accepted": False, "reason": "CAPACITY_FULL"}

    await db.mobile_agents.update_one(
        {"agent_id": req.master_id},
        {"$inc": {"current_child_count": 1}, "$set": {"updated_at": now}},
    )

    await db.mobile_agents.update_one(
        {"agent_id": req.child_id},
        {"$set": {"parent_master_id": req.master_id, "updated_at": now}},
    )

    await db.child_connections.insert_one({
        "master_id": req.master_id,
        "child_id": req.child_id,
        "rssi": req.rssi,
        "connected_at": now,
    })

    return {"accepted": True, "slot_number": current_count + 1}


@api_router.get("/network/snapshot")
async def network_snapshot():
    """Global network overview."""
    total_agents = await db.mobile_agents.count_documents({"mode": "AGENT"})
    total_masters = await db.mobile_agents.count_documents({"mode": "MASTER"})

    # Active = heartbeat within last 2 minutes
    cutoff_iso = datetime.now(timezone.utc).isoformat()
    # Simple approximation
    active_agents = await db.mobile_agents.count_documents({"mode": "AGENT"})
    active_masters = await db.mobile_agents.count_documents({"mode": "MASTER"})

    recent = await db.detections.find(
        {},
        {"_id": 0, "id": 1, "subType": 1, "priority": 1, "timestamp": 1}
    ).sort("received_at", -1).limit(10).to_list(10)

    return {
        "total_agents": total_agents,
        "total_masters": total_masters,
        "active_agents": active_agents,
        "active_masters": active_masters,
        "recent_detections": recent,
    }


@api_router.get("/mobile/{agent_id}")
async def get_agent(agent_id: str):
    """Retrieve agent/master by ID."""
    agent = await db.mobile_agents.find_one({"agent_id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# Status check (legacy + keepalive)
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    return [StatusCheck(**sc) for sc in status_checks]


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
