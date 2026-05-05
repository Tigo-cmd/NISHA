# NISHA Backend - Git Configuration

## Repository: Backend/

### .gitignore for Backend/

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual environments
.venv/
venv/
ENV/
env/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Environment variables
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite
*.sqlite3

# Logs
*.log
logs/

# Testing
.pytest_cache/
.coverage
htmlcov/
.tox/
.nox/

# Migration files (keep migrations/ but not versions)
backup/
migrations/versions/.backup

# Models
ai/models/*.pt
ai/models/
!ai/models/.gitkeep

# Temporary files
tmp/
temp/
*.tmp

# OS
.DS_Store
Thumbs.db

# Uploads
uploads/
media/
static/uploads/
```

### Commit Message Template for Backend/

```
type: scope (short description)

Longer description if needed.

- Bullet point changes
- Focus on WHY not WHAT

Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation only
style:    Formatting, linting (no code change)
refactor: Code restructuring (no functional change)
perf:     Performance improvement
test:     Test addition/modification
chore:    Maintenance, build, CI/CD
infra:    Infrastructure, Docker, deployment
ai:       AI/ML model or inference changes

Scopes:
agent, master, audio, video, topology, handoff, failover,
config, command, ws, api, db, models, ai, infra, deploy
```

### Example Commit Messages

```
feit(agent): add agent health evaluation state machine

- Introduces multi-dimensional health checks (battery, signal, temp, memory)
- Agent status transitions: ACTIVE -> DEGRADED -> OFFLINE
- Worst-check determines overall health level
- HeartbeatMonitor checks agents every 10s, publishes state events

fix(ws): handle binary frame queue overflow gracefully
- Added try/except for QueueFull on stream_queue.put_nowait()
- Drops frames when backend congested, logs warning
- Prevents memory leak under extreme load

refactor(ai): separate ViolenceDetector into inference module
- Moves LSTM model to dedicated ai/video_processing/
- Keeps only AIProcessor bridge in backend
- Allows independent training/inference workflows

infra: add Docker multi-stage build with uvicorn workers
- Base stage installs system deps (gcc, libpq, libglib2.0)
- Production stage uses opencv-python-headless
- Runs 4 uvicorn workers for parallelism
```

### Pre-commit Hook Suggestions (`.git/hooks/pre-commit`)

```bash
#!/bin/bash
# Run Ruff linting
 ruff check src/

# Run MyPy type checking
 mypy src/

# Run tests (unit only - fast)
 pytest tests/ -m unit -x

if [ $? -ne 0 ]; then
    echo "Pre-commit checks failed. Fix errors before committing."
    exit 1
fi
```

### Branch Strategy for Backend/

```
main          → Production-ready, tagged releases
develop       → Integration branch (optional)
feature/*     → New features (feat/agent-health, feat/video-processing)
bugfix/*      → Hotfixes (bugfix/ws-reconnect)
release/*     → Release preparation
hotfix/*      → Emergency patches
```

### GitHub Actions CI (suggested `.github/workflows/ci.yml`)

```yaml
name: Backend CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: nisha, POSTGRES_PASSWORD: test, POSTGRES_DB: test }
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with: { python-version: '3.11' }
      - name: Install deps
        run: |
          pip install -e ".[dev]"
          pip install -r requirements.txt
      - name: Ruff lint
        run: ruff check src/
      - name: MyPy
        run: mypy src/
      - name: Unit tests
        run: pytest tests/ -m unit --cov=src
      - name: Integration tests
        run: pytest tests/ -m integration
        env:
          DATABASE_URL: postgresql+asyncpg://nisha:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379/0
```

---

## Backend Architecture Summary

**Framework**: FastAPI 0.115 (async, ASGI)  
**Architecture**: Clean/Hexagonal, Domain-Driven Design  
**Language**: Python 3.11+  
**Lines of Code**: ~8,000+ (backend only, excluding AI)  

### Key Components

1. **API Layer** (`api/v1/`): REST endpoints + WebSocket
2. **Services Layer** (`services/`): Business logic orchestrators
3. **Domain Layer** (`domain/`): Pure business entities, events, ports
4. **Infrastructure** (`infrastructure/`): DB, cache, WebSocket, messaging
5. **AI Bridge** (`services/ai_processor.py`): YOLOv8 + LSTM + Audio

### Data Flow

```
Agent → Master → Backend WebSocket → ConnectionManager
    ↓
Priority Queues (4 levels)
    ↓
Worker Pipeline: AI → Correlation → Alert → DB Writer
    ↓
PostgreSQL (persistence) + Redis (cache)
    ↓
WebSocket broadcast → Frontend Dashboard
```

### Core Features

- Agent registration, lifecycle, heartbeat monitoring
- Binary NISHA protocol (24-byte header + JSON metadata)
- Priority-based streaming (CRITICAL/EVENT/CONTINUOUS/BACKGROUND)
- AI violence detection (YOLOv8 pose + Bi-LSTM)
- Multi-agent event correlation (spatio-temporal)
- Mesh topology, handoff protocol, failover
- Delta-based configuration updates
- Command dispatch with ACK/retry

### Running

```bash
cd Backend
source .venv/bin/activate  # or create: python -m venv .venv
pip install -e .
uvicorn nisha.main:app --host 0.0.0.0 --port 8000 --reload
```

### Environment (.env)

```env
DATABASE_URL=postgresql+asyncpg://nisha:nisha_secret@localhost:5432/nisha_sentinel
REDIS_URL=redis://localhost:6379/0
API_KEY=change-me-to-a-secure-api-key
JWT_SECRET_KEY=your-secret-here
APP_ENV=development
LOG_LEVEL=INFO
```

---

Generated by Kilo CLI analysis. Refer to source code in `Backend/src/nisha/` for implementation details.
