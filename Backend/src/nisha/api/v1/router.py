"""V1 API router aggregation."""

from fastapi import APIRouter

from nisha.api.v1.agents import router as agents_router
from nisha.api.v1.audio import router as audio_router
from nisha.api.v1.masters import router as masters_router
from nisha.api.v1.mobile import router as mobile_router
from nisha.api.v1.system import router as system_router
from nisha.api.v1.topology import router as topology_router
from nisha.api.v1.video import router as video_router
from nisha.api.v1.ws import router as ws_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(agents_router)
v1_router.include_router(masters_router)
v1_router.include_router(audio_router)
v1_router.include_router(video_router)
v1_router.include_router(topology_router)
v1_router.include_router(system_router)
v1_router.include_router(ws_router)
v1_router.include_router(mobile_router)
