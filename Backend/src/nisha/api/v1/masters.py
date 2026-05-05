"""Master REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from nisha.api.middleware.auth import verify_api_key
from nisha.api.schemas.agent import AgentListResponse, AgentResponse
from nisha.api.schemas.master import MasterListResponse, MasterRegisterRequest, MasterResponse
from nisha.api.schemas.topology import RebalanceResponse
from nisha.dependencies import get_agent_service, get_master_service, get_topology_service

router = APIRouter(prefix="/masters", tags=["masters"])


@router.get("", response_model=MasterListResponse)
async def list_masters(
    status: str | None = None,
    _token: str = Depends(verify_api_key),
    master_svc=Depends(get_master_service),
):
    masters = await master_svc.list_masters(status=status)
    return MasterListResponse(
        items=[
            MasterResponse(
                master_id=m.master_id,
                name=m.name,
                ip_address=m.ip_address,
                max_agents=m.max_agents,
                current_agent_count=m.current_agent_count,
                status=m.status,
                location_zone=m.location_zone,
                gps_lat=m.gps_lat,
                gps_lng=m.gps_lng,
                mesh_neighbors=m.mesh_neighbors,
                last_seen=m.last_seen,
                created_at=m.created_at,
            )
            for m in masters
        ]
    )


@router.post("", response_model=MasterResponse, status_code=201)
async def register_master(
    body: MasterRegisterRequest,
    _token: str = Depends(verify_api_key),
    master_svc=Depends(get_master_service),
):
    master = await master_svc.register_master(
        master_id=body.master_id,
        name=body.name,
        ip_address=body.ip_address,
        max_agents=body.max_agents,
        location_zone=body.location_zone,
        gps_lat=body.gps_lat,
        gps_lng=body.gps_lng,
    )
    return MasterResponse(
        master_id=master.master_id,
        name=master.name,
        ip_address=master.ip_address,
        max_agents=master.max_agents,
        current_agent_count=master.current_agent_count,
        status=master.status,
        location_zone=master.location_zone,
        gps_lat=master.gps_lat,
        gps_lng=master.gps_lng,
        mesh_neighbors=master.mesh_neighbors,
        last_seen=master.last_seen,
        created_at=master.created_at,
    )


@router.get("/{master_id}", response_model=MasterResponse)
async def get_master(
    master_id: str,
    _token: str = Depends(verify_api_key),
    master_svc=Depends(get_master_service),
):
    master = await master_svc.get_master(master_id)
    if not master:
        raise HTTPException(status_code=404, detail=f"Master {master_id} not found")
    return MasterResponse(
        master_id=master.master_id,
        name=master.name,
        ip_address=master.ip_address,
        max_agents=master.max_agents,
        current_agent_count=master.current_agent_count,
        status=master.status,
        location_zone=master.location_zone,
        gps_lat=master.gps_lat,
        gps_lng=master.gps_lng,
        mesh_neighbors=master.mesh_neighbors,
        last_seen=master.last_seen,
        created_at=master.created_at,
    )


@router.get("/{master_id}/agents", response_model=AgentListResponse)
async def list_master_agents(
    master_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
):
    agents, total = await agent_svc.list_agents(master_id=master_id, offset=offset, limit=limit)
    return AgentListResponse(
        total=total,
        offset=offset,
        limit=limit,
        items=[
            AgentResponse(
                agent_id=a.agent_id, short_id=a.short_id, status=a.status,
                master_id=a.master_id, capabilities=a.capabilities, config=a.config,
                location_zone=a.location_zone, gps_lat=a.gps_lat, gps_lng=a.gps_lng,
                firmware_version=a.firmware_version, last_heartbeat=a.last_heartbeat,
                created_at=a.created_at, updated_at=a.updated_at,
            )
            for a in agents
        ],
    )


@router.post("/{master_id}/rebalance", response_model=RebalanceResponse)
async def rebalance_master(
    master_id: str,
    _token: str = Depends(verify_api_key),
    topology_svc=Depends(get_topology_service),
):
    result = await topology_svc.rebalance_master(master_id)
    return RebalanceResponse(**result)
