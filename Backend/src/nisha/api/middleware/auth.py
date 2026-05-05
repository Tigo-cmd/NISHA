"""Bearer token authentication middleware."""

from __future__ import annotations

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from nisha.config import settings

_api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def verify_api_key(
    auth_header: str | None = Security(_api_key_header),
) -> str:
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    # Support "Bearer <token>" format
    token = auth_header
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    if token != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    return token
