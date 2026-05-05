"""API error handlers."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from nisha.domain.services.lifecycle import InvalidTransitionError


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"error": "Bad Request", "detail": str(exc)},
        )

    @app.exception_handler(InvalidTransitionError)
    async def transition_error_handler(request: Request, exc: InvalidTransitionError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={
                "error": "Invalid State Transition",
                "detail": str(exc),
                "code": "E1004",
            },
        )
