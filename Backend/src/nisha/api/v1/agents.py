"""Agent REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from nisha.api.middleware.auth import verify_api_key
from nisha.api.schemas.agent import (
    AgentHistoryResponse,
    AgentListResponse,
    AgentRegisterRequest,
    AgentResponse,
    AgentUpdateRequest,
    HeartbeatRequest,
    HeartbeatResponse,
)
from nisha.api.schemas.command import CommandRequest, CommandResponse
from nisha.dependencies import get_agent_service, get_command_service, get_config_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=AgentListResponse)
async def list_agents(
    status_filter: str | None = Query(None, alias="status"),
    master_id: str | None = None,
    location_zone: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
):
    agents, total = await agent_svc.list_agents(
        status=status_filter, master_id=master_id,
        location_zone=location_zone, offset=offset, limit=limit,
    )
    return AgentListResponse(
        total=total,
        offset=offset,
        limit=limit,
        items=[
            AgentResponse(
                agent_id=a.agent_id,
                short_id=a.short_id,
                status=a.status,
                master_id=a.master_id,
                capabilities=a.capabilities,
                config=a.config,
                location_zone=a.location_zone,
                gps_lat=a.gps_lat,
                gps_lng=a.gps_lng,
                firmware_version=a.firmware_version,
                hardware_type=a.hardware_type,
                stream_url=a.stream_url,
                last_heartbeat=a.last_heartbeat,
                created_at=a.created_at,
                updated_at=a.updated_at,
            )
            for a in agents
        ],
    )


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def register_agent(
    body: AgentRegisterRequest,
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
):
    agent = await agent_svc.register_agent(
        agent_id=body.agent_id,
        master_id=body.master_id,
        capabilities=body.capabilities,
        firmware_version=body.firmware_version,
        hardware_type=body.hardware_type,
        stream_url=body.stream_url,
        location_zone=body.location_zone,
        gps_lat=body.gps_lat,
        gps_lng=body.gps_lng,
    )
    return AgentResponse(
        agent_id=agent.agent_id,
        short_id=agent.short_id,
        status=agent.status,
        master_id=agent.master_id,
        capabilities=agent.capabilities,
        config=agent.config,
        location_zone=agent.location_zone,
        gps_lat=agent.gps_lat,
        gps_lng=agent.gps_lng,
        firmware_version=agent.firmware_version,
        hardware_type=agent.hardware_type,
        stream_url=agent.stream_url,
        last_heartbeat=agent.last_heartbeat,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
):
    agent = await agent_svc.get_agent(agent_id)
    if not agent:
        agent = await agent_svc.get_agent_by_short_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    return AgentResponse(
        agent_id=agent.agent_id,
        short_id=agent.short_id,
        status=agent.status,
        master_id=agent.master_id,
        capabilities=agent.capabilities,
        config=agent.config,
        location_zone=agent.location_zone,
        gps_lat=agent.gps_lat,
        gps_lng=agent.gps_lng,
        firmware_version=agent.firmware_version,
        hardware_type=agent.hardware_type,
        stream_url=agent.stream_url,
        last_heartbeat=agent.last_heartbeat,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    body: AgentUpdateRequest,
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
):
    if body.status:
        from nisha.domain.models.enums import AgentStatus
        agent = await agent_svc.update_agent_status(
            agent_id, AgentStatus(body.status), body.status_reason or ""
        )
    elif body.config:
        agent = await agent_svc.update_agent_config(agent_id, body.config)
    else:
        agent = await agent_svc.get_agent(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    return AgentResponse(
        agent_id=agent.agent_id,
        short_id=agent.short_id,
        status=agent.status,
        master_id=agent.master_id,
        capabilities=agent.capabilities,
        config=agent.config,
        location_zone=agent.location_zone,
        gps_lat=agent.gps_lat,
        gps_lng=agent.gps_lng,
        firmware_version=agent.firmware_version,
        hardware_type=agent.hardware_type,
        stream_url=agent.stream_url,
        last_heartbeat=agent.last_heartbeat,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )





@router.post("/{agent_id}/command", response_model=CommandResponse)
async def send_command(
    agent_id: str,
    body: CommandRequest,
    _token: str = Depends(verify_api_key),
    cmd_svc=Depends(get_command_service),
):
    cmd = await cmd_svc.dispatch_command(
        agent_id=agent_id,
        command_type=body.command_type,
        params=body.params,
        issued_by=body.issued_by,
    )
    return CommandResponse(
        cmd_id=cmd.cmd_id,
        agent_id=cmd.agent_id,
        command_type=cmd.command_type,
        priority=cmd.priority,
        status=cmd.status,
        params=cmd.params,
        requires_ack=cmd.requires_ack,
        issued_by=cmd.issued_by,
        issued_at=cmd.issued_at,
        dispatched_at=cmd.dispatched_at,
        completed_at=cmd.completed_at,
    )


@router.get("/{agent_id}/logs", response_model=AgentHistoryResponse)
async def get_agent_logs(
    agent_id: str,
    event_type: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
):
    history = await agent_svc.get_agent_history(
        agent_id, event_type=event_type, offset=offset, limit=limit,
    )
    return AgentHistoryResponse(items=history, total=len(history))


@router.put("/{agent_id}/config")
async def update_agent_config(
    agent_id: str,
    config: dict,
    force_full_replace: bool = False,
    _token: str = Depends(verify_api_key),
    config_svc=Depends(get_config_service),
):
    """Update agent configuration with automatic delta detection."""
    version = await config_svc.update_config(agent_id, config, force_full_replace)
    return {
        "version_id": version.version_id,
        "version_number": version.version_number,
        "config_hash": version.config_hash,
        "change_type": version.change_type,
        "changed_keys": version.changed_keys,
    }


@router.post("/{agent_id}/config/rollback")
async def rollback_config(
    agent_id: str,
    target_hash: str,
    _token: str = Depends(verify_api_key),
    config_svc=Depends(get_config_service),
):
    """Rollback agent config to a previous version."""
    config = await config_svc.rollback_config(agent_id, target_hash)
    return {"status": "rolled_back", "config": config}


@router.get("/{agent_id}/config/check")
async def check_config_sync(
    agent_id: str,
    reported_hash: str,
    _token: str = Depends(verify_api_key),
    config_svc=Depends(get_config_service),
):
    """Check if agent config is in sync with server."""
    return await config_svc.check_config_sync(agent_id, reported_hash)


@router.get("/{agent_id}/media/{media_type}")
async def get_agent_media(
    agent_id: str,
    media_type: str,
    _token: str = Depends(verify_api_key),
    agent_svc=Depends(get_agent_service),
):
    """Fetch the latest media clip for an agent."""
    from nisha.infrastructure.database.session import async_session_factory
    from sqlalchemy import select
    
    if media_type == "video":
        from nisha.infrastructure.database.models import VideoEventModel
        stmt = (
            select(VideoEventModel)
            .where(VideoEventModel.agent_id == agent_id)
            .order_by(VideoEventModel.timestamp.desc())
            .limit(1)
        )
        async with async_session_factory() as session:
            result = await session.execute(stmt)
            event = result.scalar_one_or_none()
            if not event or not event.video_data:
                return {"base64": None}
            return {"base64": event.video_data}
    
    elif media_type == "audio":
        from nisha.infrastructure.database.models import AudioEventModel
        stmt = (
            select(AudioEventModel)
            .where(AudioEventModel.agent_id == agent_id)
            .order_by(AudioEventModel.timestamp.desc())
            .limit(1)
        )
        async with async_session_factory() as session:
            result = await session.execute(stmt)
            event = result.scalar_one_or_none()
            if not event or not event.audio_data:
                return {"base64": None}
            
            audio_b64 = event.audio_data
            try:
                import base64
                import struct
                raw_data = base64.b64decode(audio_b64)
                
                # Check if it already has a RIFF header
                if not raw_data.startswith(b'RIFF'):
                    # Legacy Raw PCM -> Wrap in WAV header on-the-fly
                    sample_rate = 16000
                    bits_per_sample = 16
                    channels = 1
                    data_size = len(raw_data)
                    byte_rate = sample_rate * channels * bits_per_sample // 8
                    block_align = channels * bits_per_sample // 8
                    
                    wav_header = struct.pack(
                        '<4sI4s4sIHHIIHH4sI',
                        b'RIFF', 36 + data_size, b'WAVE', b'fmt ', 16, 1, channels,
                        sample_rate, byte_rate, block_align, bits_per_sample, b'data', data_size
                    )
                    audio_b64 = base64.b64encode(wav_header + raw_data).decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to process audio for playback: {e}")
                
            return {"base64": audio_b64}
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported media type")
