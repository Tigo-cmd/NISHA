"""WebSocket endpoint for real-time communication."""

from __future__ import annotations

import json
import logging
import uuid

import time
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from nisha.dependencies import get_master_service

from nisha.infrastructure.websocket.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# Will be set from main.py during app startup
connection_manager: ConnectionManager | None = None


def set_connection_manager(cm: ConnectionManager) -> None:
    global connection_manager
    connection_manager = cm


@router.websocket("/ws/realtime")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(None),
):
    if connection_manager is None:
        await websocket.close(code=1011)
        return

    # Basic token-based role identification
    # In a real app, validate JWT here
    is_master = False
    client_id = str(uuid.uuid4())
    
    if token and (token.startswith("NISHA-M1") or token == "NISHA-FRONTEND-DEV"):
        is_master = True
        logger.info("Master/Dashboard node identified: %s", client_id)

    client = await connection_manager.connect(websocket, client_id, is_master=is_master)

    try:
        while True:
            # Flexible receiver handling both text and binary
            msg = await websocket.receive()
            
            if msg["type"] == "websocket.disconnect":
                logger.info("WebSocket disconnect received for client: %s", client_id)
                break
                
            if "text" in msg:
                raw_text = msg["text"]
                try:
                    message = json.loads(raw_text)
                    await _handle_json_message(client_id, message)
                except json.JSONDecodeError:
                    await websocket.send_json({"error": "Invalid JSON"})
                    
            elif "bytes" in msg:
                await connection_manager.handle_binary_frame(client_id, msg["bytes"])

    except WebSocketDisconnect:
        await connection_manager.disconnect(client_id)

async def _handle_json_message(client_id: str, message: dict):
    """Handle control messages (JSON)."""
    msg_type = message.get("type")

    if msg_type == "SUBSCRIBE":
        target = message.get("target", "all")
        connection_manager.subscribe(client_id, target)
        await connection_manager.send_to_client(client_id, {"type": "SUBSCRIBED", "target": target})

    elif msg_type == "UNSUBSCRIBE":
        target = message.get("target", "all")
        connection_manager.unsubscribe(client_id, target)
        await connection_manager.send_to_client(client_id, {"type": "UNSUBSCRIBED", "target": target})

    elif msg_type == "PING":
        await connection_manager.send_to_client(client_id, {"type": "PONG", "timestamp": time.time()})

    elif msg_type == "MASTER_HEARTBEAT":
        # Access app state via client's websocket (a bit hacky but works for now)
        from nisha.infrastructure.database.session import async_session_factory
        from nisha.infrastructure.database.repositories.master_repo import SqlAlchemyMasterRepository
        
        async with async_session_factory() as session:
            repo = SqlAlchemyMasterRepository(session)
            master_id = message.get("master_id")
            agent_count = message.get("agent_count")
            
            if master_id:
                try:
                    master = await repo.get_by_id(master_id)
                    if not master:
                        # Auto-register if not exists
                        from nisha.domain.models.master import Master
                        from nisha.domain.models.enums import MasterStatus
                        from datetime import datetime, timezone
                        
                        master = Master(
                            master_id=master_id,
                            name=f"Master {master_id}",
                            status=MasterStatus.ONLINE.value,
                            last_seen=datetime.now(timezone.utc),
                            current_agent_count=agent_count or 0
                        )
                        await repo.create(master)
                        logger.info(f"Auto-registered master: {master_id}")
                    else:
                        from datetime import datetime, timezone
                        master.last_seen = datetime.now(timezone.utc)
                        if agent_count is not None:
                            master.current_agent_count = agent_count
                        await repo.update(master)
                    
                    # Associate this connection with the master_id in the connection manager
                    connection_manager.set_master_id(client_id, master_id)
                    
                    await session.commit()
                except Exception as e:
                    logger.error(f"Failed to update master heartbeat: {e}")
