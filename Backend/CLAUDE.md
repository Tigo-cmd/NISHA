# NISHA SENTINEL - Agent Management System

## Project Overview
Centralized control and monitoring for a distributed network of 10-500 ESP32-based agents, coordinated through 10-20 Raspberry Pi master nodes, managed by a central FastAPI server.

## Architecture
Three-tier: **Server** (FastAPI + PostgreSQL + Redis) → **Master** (Raspberry Pi) → **Agent** (ESP32-CAM)

## Tech Stack
- **Runtime**: Python 3.11+
- **Framework**: FastAPI (async)
- **Database**: PostgreSQL 16 (via SQLAlchemy 2.0 async)
- **Cache**: Redis 7
- **Migrations**: Alembic
- **Testing**: pytest + pytest-asyncio
- **Linting**: ruff
- **Type checking**: mypy

## Project Structure
```
src/nisha/
├── domain/         # Pure domain logic, zero framework deps
│   ├── models/     # Entities (Agent, Master, Command)
│   ├── events/     # Domain events
│   ├── services/   # State machine, health eval, mesh logic
│   └── ports/      # Abstract interfaces (repositories, cache)
├── infrastructure/ # Framework & external adapters
│   ├── database/   # SQLAlchemy models, sessions, repo implementations
│   ├── cache/      # Redis adapter
│   ├── messaging/  # Event bus
│   └── websocket/  # Connection manager
├── api/            # FastAPI layer
│   ├── v1/         # Versioned REST + WS endpoints
│   ├── schemas/    # Pydantic request/response models
│   └── middleware/  # Auth, error handling
├── services/       # Application services (use cases)
├── config.py       # Pydantic settings
└── main.py         # App entry point
```

## Commands
- `docker compose up -d` — start all services
- `docker compose up -d postgres redis` — start deps only
- `alembic upgrade head` — run migrations
- `alembic revision --autogenerate -m "desc"` — create migration
- `pytest` — run all tests
- `pytest -m unit` — unit tests only
- `pytest -m integration` — integration tests only
- `ruff check src/` — lint
- `ruff format src/` — format
- `mypy src/` — type check
- `uvicorn nisha.main:app --reload --reload-dir src` — dev server

## Design Principles
- **Hexagonal architecture**: Domain core has zero infrastructure imports
- **Dependency inversion**: Domain defines ports (interfaces), infrastructure provides adapters
- **Domain events**: State changes emit events, side effects happen in handlers
- **Async everywhere**: All I/O is async (asyncpg, aioredis, httpx)
- **Explicit over implicit**: No magic, no metaclasses, clear data flow
