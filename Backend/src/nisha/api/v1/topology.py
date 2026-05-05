"""Topology and mesh management REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from nisha.api.middleware.auth import verify_api_key
from nisha.api.schemas.topology import (
    HandoffEvalRequest,
    HandoffEvalResponse,
    TopologyResponse,
)
from nisha.dependencies import get_handoff_service, get_topology_service

router = APIRouter(prefix="/topology", tags=["topology"])


@router.get("", response_model=TopologyResponse)
async def get_topology(
    _token: str = Depends(verify_api_key),
    topology_svc=Depends(get_topology_service),
):
    topology = await topology_svc.get_topology()
    return TopologyResponse(**topology)


@router.get("/summary")
async def get_topology_summary(
    _token: str = Depends(verify_api_key),
    topology_svc=Depends(get_topology_service),
):
    return await topology_svc.get_topology_summary()


@router.post("/optimize")
async def optimize_topology(
    _token: str = Depends(verify_api_key),
    topology_svc=Depends(get_topology_service),
):
    return await topology_svc.optimize_routes()


@router.post("/handoff/evaluate", response_model=HandoffEvalResponse)
async def evaluate_handoff(
    body: HandoffEvalRequest,
    _token: str = Depends(verify_api_key),
    topology_svc=Depends(get_topology_service),
):
    result = await topology_svc.evaluate_agent_handoff(body.agent_id, body.current_signal)
    return HandoffEvalResponse(**result)


@router.post("/handoff/initiate")
async def initiate_handoff(
    body: HandoffEvalRequest,
    _token: str = Depends(verify_api_key),
    handoff_svc=Depends(get_handoff_service),
):
    """Initiate an actual handoff for an agent."""
    handoff = await handoff_svc.initiate_handoff(
        agent_id=body.agent_id,
        current_signal=body.current_signal,
        trigger_reason="api_request",
    )
    return {
        "handoff_id": handoff.handoff_id,
        "agent_id": handoff.agent_id,
        "from_master": handoff.from_master_id,
        "to_master": handoff.to_master_id,
        "status": handoff.status,
        "duration_seconds": handoff.duration_seconds,
        "error": handoff.error,
    }


@router.post("/neighbor")
async def report_neighbor(
    node_id: str,
    neighbor_id: str,
    signal_strength: int,
    _token: str = Depends(verify_api_key),
    topology_svc=Depends(get_topology_service),
):
    """Report a mesh neighbor observation."""
    await topology_svc.report_neighbor(node_id, neighbor_id, signal_strength)
    return {"status": "recorded"}
