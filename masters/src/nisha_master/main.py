"""Main entry point for the Master Node.

Orchestrates the asynchronous startup of the Agent WebSocket Server,
Backend Client, Triangulation Engine, and Local Dashboard.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from nisha_master.config import settings
from nisha_master.core.buffer import BufferManager
from nisha_master.interfaces.agent_ws import AgentWebSocketServer
from nisha_master.interfaces.backend_client import BackendWebSocketClient
from nisha_master.interfaces.dashboard import router as dashboard_router
from nisha_master.core.hardware_worker import HardwareIngestionWorker
from agora_token_builder import RtcTokenBuilder
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Global Queues (The Core Router glue) ---
# High priority queue for telemetry & status, bounded to prevent memory leaks
telemetry_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
# Binary payload queue (Video/Audio)
stream_queue: asyncio.Queue = asyncio.Queue(maxsize=5000)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info(f"Starting NISHA Master: {settings.master_id}")

    # 1. Initialize BufferManager
    logger.info(f"Initializing BufferManager (Limit: {settings.buffer_ram_limit_mb}MB)")
    buffer_manager = BufferManager()

    # 2. Start Hardware Ingestion Worker
    logger.info("Starting Hardware Ingestion Worker...")
    hw_worker = HardwareIngestionWorker(stream_queue, telemetry_queue)
    hw_task = asyncio.create_task(hw_worker.start(settings.hardware_agents))

    # 3. Start Agent WS Server (Port 8081)
    logger.info(f"Opening Agent Interface on port {settings.agent_ws_port}")
    from nisha_master.interfaces.dashboard import metrics_store
    agent_server = AgentWebSocketServer(
        settings.agent_ws_port, 
        stream_queue, 
        telemetry_queue, 
        metrics_store,
        hw_worker=hw_worker
    )
    metrics_store.agent_server = agent_server  # Link for command relay
    agent_task = asyncio.create_task(agent_server.start())

    # 4. Start Backend WSS Client Background Task
    logger.info(f"Connecting to Backend: {settings.backend_ws_url}")
    backend_client = BackendWebSocketClient(stream_queue, buffer_manager, agent_server)
    backend_client.metrics_store = metrics_store
    backend_task = asyncio.create_task(backend_client.connect_and_run())

    # 4. Start Triangulation Background Task (Placeholder)
    # logger.info("Starting Triangulation Engine background routines...")

    # 5. Background task to drain telemetry queue to Dashboard metrics
    async def process_telemetry():
        while True:
            try:
                telemetry = await telemetry_queue.get()
                agent_id = telemetry["agent_id"]
                from nisha_master.interfaces.dashboard import metrics_store

                if agent_id not in metrics_store.agent_stats:
                    metrics_store.agent_stats[agent_id] = {"agent_id": agent_id}

                metrics_store.agent_stats[agent_id].update({
                    "rssi": telemetry.get("rssi", -50),
                    "battery": telemetry.get("battery", 100),
                    "stream_type": "LITE"
                })
                telemetry_queue.task_done()
            except Exception as e:
                # logger.error(f"Telemetry processing error: {e}")
                await asyncio.sleep(5)

    async def compute_traffic():
        last_bytes = 0
        while True:
            from nisha_master.interfaces.dashboard import metrics_store
            metrics_store.active_agents = len(agent_server.active_agents)
            metrics_store.ram_buffer_used_mb = buffer_manager.current_ram_bytes / (1024 * 1024)
            
            # Calculate REAL throughput from the socket
            current_total = agent_server.total_inbound_bytes
            diff = current_total - last_bytes
            last_bytes = current_total
            
            # bytes * 8 = bits. bits / (2 seconds) = bits per second. bits per second / 1M = Mbps
            metrics_store.inbound_bytes_sec = diff / 2.0 
            metrics_store.outbound_bytes_sec = 0.0 # Isolated
            metrics_store.latency_ms = 10.0 # Direct connection
            
            await asyncio.sleep(2.0)

    asyncio.create_task(process_telemetry())
    asyncio.create_task(compute_traffic())

    # Start Dashboard WebSocket broadcast loop
    from nisha_master.interfaces.dashboard import ws_manager
    asyncio.create_task(ws_manager.broadcast_snapshot())

    yield

    # --- Shutdown ---
    logger.info("Shutting down Master Node... flushing buffers to disk.")
    agent_task.cancel()
    backend_task.cancel()
    hw_task.cancel()
    await hw_worker.stop()
    # Ensure buffer flushes correctly here


# Local Dashboard FastAPI App
app = FastAPI(
    title=f"NISHA Master ({settings.master_id}) Local UI",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Dashboard REST and WS routes
app.include_router(dashboard_router)

# Mount static files for the Vanilla JS Dashboard
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/api/agora/token")
async def get_agora_token(channelName: str, uid: int = 0, role: int = 1):
    """
    Generates an Agora RTC token for the given channel.
    role=1 is kRolePublisher (default), role=2 is kRoleSubscriber.
    """
    expiration_time_in_seconds = 3600
    current_timestamp = int(time.time())
    privilege_expired_ts = current_timestamp + expiration_time_in_seconds

    try:
        token = RtcTokenBuilder.buildTokenWithUid(
            settings.agora_app_id,
            settings.agora_app_certificate,
            channelName,
            uid,
            role,
            privilege_expired_ts
        )
        return {"token": token, "appId": settings.agora_app_id}
    except Exception as e:
        logger.error(f"Error generating Agora token: {e}")
        return {"error": str(e)}, 500

@app.get("/")
async def serve_dashboard():
    """Serve the root dashboard HTML."""
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/api/health")
async def health_check():
    """Local heartbeat endpoint for the Master."""
    return {
        "status": "online",
        "master_id": settings.master_id,
        "latency_target": settings.target_latency_ms
    }

# This is intended to be run via uvicorn nisha_master.main:app
