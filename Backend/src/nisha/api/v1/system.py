"""System health REST endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from nisha.api.middleware.auth import verify_api_key
from nisha.dependencies import get_agent_service, get_master_service
from nisha.infrastructure.websocket.connection_manager import ConnectionManager

router = APIRouter(prefix="/system", tags=["system"])

# Shared connection manager instance
_connection_manager: ConnectionManager | None = None


def set_connection_manager(cm: ConnectionManager) -> None:
    global _connection_manager
    _connection_manager = cm


@router.get("/status")
async def system_status(
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
    master_svc=Depends(get_master_service),
):
    masters = await master_svc.list_masters()
    status_counts = await agent_svc.get_agent_status_counts()

    active_count = status_counts.get("ACTIVE", 0)
    offline_count = status_counts.get("OFFLINE", 0)
    degraded_count = status_counts.get("DEGRADED", 0)
    agents_total_count = sum(status_counts.values())

    return {
        "status": "operational",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agents": {
            "total": agents_total_count,
            "active": active_count,
            "offline": offline_count,
            "degraded": degraded_count,
        },
        "masters": {
            "total": len(masters),
            "online": sum(1 for m in masters if m.status == "ONLINE"),
        },
        "websocket_connections": _connection_manager.active_connections if _connection_manager else 0,
    }
