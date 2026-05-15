"""NISHA Agent Management System - FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from nisha.api.errors import register_error_handlers
from nisha.api.v1.router import v1_router
from nisha.api.v1.system import set_connection_manager as set_system_cm
from nisha.api.v1.ws import set_connection_manager as set_ws_cm
from nisha.config import settings
from agora_token_builder import RtcTokenBuilder
import time
from nisha.dependencies import init_singletons
from nisha.infrastructure.cache.redis_cache import RedisCache
from nisha.infrastructure.database.repositories.agent_repo import SqlAlchemyAgentRepository
from nisha.infrastructure.database.repositories.master_repo import SqlAlchemyMasterRepository
from nisha.infrastructure.database.session import async_session_factory, engine
from nisha.infrastructure.messaging.event_bus import InProcessEventBus
from nisha.infrastructure.websocket.connection_manager import ConnectionManager
from nisha.services.heartbeat_monitor import HeartbeatMonitor


def _configure_logging() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if settings.is_development else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    log = structlog.get_logger()

    # Initialize Redis
    redis_client = aioredis.from_url(
        settings.redis_url,
        decode_responses=False,
    )
    cache = RedisCache(redis_client)

    # Initialize event bus
    event_bus = InProcessEventBus()

    # Initialize AI Processor
    from nisha.services.ai_processor import AIProcessor
    ai_processor = AIProcessor(use_nano=True)
    ai_processor.load_models()

    # Initialize Intelligence Layer
    from nisha.services.correlation_engine import CorrelationEngine
    from nisha.services.alert_generator import AlertGenerator
    from nisha.services.adaptive_streaming import AdaptiveStreamingController
    correlation_engine = CorrelationEngine()
    alert_generator = AlertGenerator(event_bus)
    streaming_controller = AdaptiveStreamingController()
    await streaming_controller.start()

    # Initialize Async DB Writer
    from nisha.infrastructure.database.writer import AsyncDatabaseWriter
    db_writer = AsyncDatabaseWriter(async_session_factory, batch_size=10, flush_interval=1.0)
    await db_writer.start()

    # Initialize Telegram Alert Service
    from nisha.services.telegram_service import TelegramService
    telegram_service = TelegramService(
        bot_token=settings.telegram_bot_token,
        chat_id=settings.telegram_chat_id
    )
    if telegram_service.is_enabled:
        log.info("telegram_service.initialized", channel=telegram_service.chat_id)
    else:
        log.warning("telegram_service.disabled", reason="No TELEGRAM_BOT_TOKEN set")

    # Initialize WebSocket manager with session factory for safe updates
    connection_manager = ConnectionManager(
        session_factory=async_session_factory,
        telegram_service=telegram_service
    )
    set_ws_cm(connection_manager)
    set_system_cm(connection_manager)

    # Wire dependencies
    init_singletons(event_bus, cache)

    app.state.redis = redis_client
    app.state.cache = cache
    app.state.event_bus = event_bus
    app.state.connection_manager = connection_manager
    app.state.ai_processor = ai_processor
    app.state.correlation_engine = correlation_engine
    app.state.alert_generator = alert_generator
    app.state.db_writer = db_writer
    app.state.streaming_controller = streaming_controller

    # --- Domain Event Bridge to WebSocket ---
    from nisha.domain.events.agent_events import AgentStateChanged, AgentDeleted, CommandDispatched
    
    async def bridge_agent_state(event: AgentStateChanged):
        await connection_manager.broadcast({
            "type": "AGENT_STATUS",
            "agent_id": event.agent_id,
            "timestamp": event.timestamp.isoformat(),
            "payload": {
                "previous_status": event.previous_status,
                "status": event.new_status,
                "reason": event.reason
            }
        })
        
    async def bridge_agent_deleted(event: AgentDeleted):
        await connection_manager.broadcast({
            "type": "AGENT_DELETED",
            "agent_id": event.agent_id,
            "timestamp": event.timestamp.isoformat()
        })

    async def bridge_command_dispatched(event: CommandDispatched):
        # We need to find which master this agent belongs to
        async with async_session_factory() as session:
            from nisha.infrastructure.database.repositories.agent_repo import SqlAlchemyAgentRepository
            repo = SqlAlchemyAgentRepository(session)
            agent = await repo.get_by_id(event.agent_id)
            if agent and agent.master_id:
                await connection_manager.dispatch_command_to_master(
                    agent.master_id, 
                    event.agent_id, 
                    {
                        "cmd_id": event.cmd_id,
                        "type": event.command_type,
                        "priority": event.priority
                    }
                )
    
    event_bus.subscribe(AgentStateChanged, bridge_agent_state)
    event_bus.subscribe(AgentDeleted, bridge_agent_deleted)
    event_bus.subscribe(CommandDispatched, bridge_command_dispatched)

    # Start priority queue workers
    connection_manager.start_workers(app.state)

    heartbeat_monitor = HeartbeatMonitor(
        session_factory=async_session_factory,
        cache=cache,
        event_bus=event_bus,
        connection_manager=connection_manager,
    )
    await heartbeat_monitor.start()
    app.state.heartbeat_monitor = heartbeat_monitor

    log.info(
        "nisha_sentinel.started",
        app_env=settings.app_env,
        server_port=settings.server_port,
    )

    yield

    # Shutdown
    log.info("nisha_sentinel.shutting_down")
    await db_writer.stop()
    await connection_manager.stop_workers()
    await heartbeat_monitor.stop()
    await redis_client.aclose()
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="NISHA Agent Management System",
        description="Centralized control and monitoring for distributed ESP32 agent networks",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routes and error handlers
    app.include_router(v1_router)
    register_error_handlers(app)

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
            return {"error": str(e)}, 500

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "nisha-sentinel"}

    return app




app = create_app()
