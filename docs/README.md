# Developer Documentation Index

## 📚 Complete Guide to NISHA Sentinel

This directory contains comprehensive documentation for the NISHA Sentinel project, covering architecture, setup, development workflows, and git best practices for each component.

---

## 📖 Documentation Files

### Architecture

| File | Description |
|------|-------------|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Complete system architecture overview, all components, data flow, technology stack. Start here for understanding the full picture. |
| `Nisha_integration_PRD.md` | Product Requirements Document - system design, interfaces, API contracts, deployment strategy |
| `SYSTEM_OPERATIONS.md` | Operations guide - startup sequence, troubleshooting, protocol specifics |
| `STARTUP_GUIDE.md` | Quick start commands for all services with port mapping |

---

### Component Setup Guides

Each guide includes:
- `.gitignore` tailored for that component
- Commit message templates with scoped conventions
- Branch strategy recommendations
- Development setup instructions
- Architecture deep-dive
- Key file paths
- Example commits

| Component | Guide |
|-----------|-------|
| **Backend (FastAPI)** | [backend_setup.md](backend_setup.md) |
| **Frontend (Next.js)** | [frontend_setup.md](frontend_setup.md) |
| **Master Node (Python)** | [master_setup.md](master_setup.md) |
| **Mobile Agent (Expo)** | [mobile_agent_setup.md](mobile_agent_setup.md) |
| **ESP32 Firmware** | [esp32_agent_setup.md](esp32_agent_setup.md) |

---

## 🏗️ Quick Component Overview

### 1. Backend (`Backend/`)
Central FastAPI application handling:
- Agent registration & lifecycle
- WebSocket real-time streaming
- AI inference (YOLOv8 + LSTM violence detection)
- Event correlation & alert generation
- Command dispatch & ACK handling
- Database persistence (PostgreSQL + Redis)

**Entry**: `src/nisha/main.py`  
**Port**: 8000  
**Tech**: Python 3.11, FastAPI, SQLAlchemy, Redis, PyTorch, YOLOv8

---

### 2. Frontend (`Frontend/`)
Next.js dashboard with real-time visualizations:
- Agent list & status (Zustand store)
- Map view (Mapbox GL + Google Maps)
- Network topology graph (SVG force-directed)
- Tactical overlay (Konva canvas)
- Audio waveform (Canvas 2D)
- Real-time alerts & telemetry

**Entry**: `src/app/page.tsx`  
**Port**: 3000  
**Tech**: React 19, Next.js 16, TypeScript, Tailwind, Zustand, Three.js

---

### 3. Master Node (`masters/`)
Raspberry Pi aggregator node:
- Accepts agent WebSocket connections (port 8082)
- Buffers streams (RAM + disk spill)
- Relays to central backend (WSS)
- Local dashboard (port 8080)
- MJPEG ingestion from IP cameras
- Triangulation from RSSI

**Entry**: `src/nisha_master/main.py`  
**Ports**: 8080 (HTTP), 8082 (WS)  
**Tech**: Python 3.11, FastAPI, asyncio, websockets

---

### 4. Mobile Agent (`Nisha-mobile-agent/`)
React Native Expo app for phones/tablets:
- Video recording (3s MP4 clips)
- Audio capture (10s AAC)
- GPS location (background tracking)
- WebSocket streaming to master
- Sensor permissions & controls

**Entry**: `frontend/app/agent.tsx`  
**Tech**: Expo SDK 54, React Native 0.81, TypeScript, Zustand

---

### 5. ESP32 Agent (`agents/esp32_s3_agent/`)
C++ firmware for edge audio sensors:
- I2S microphone (16kHz, 32-bit)
- Raw audio capture + RMS dB calculation
- Threshold-based alerting (>70dB)
- WebSocket client to master node
- Binary NISHA protocol

**Entry**: `src/main.cpp`  
**Platform**: ESP32-S3-Box (or generic ESP32)  
**Tech**: Arduino framework, I2S driver, WebSockets library

---

## 🔄 Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ ESP32    │     │ Mobile   │     │ Master   │     │ Backend  │
│ Agent    │────►│ Agent    │────►│ Node     │────►│ API      │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                 │                 │                 │
     ▼                 ▼                 ▼                 ▼
  Audio            Video+Audio       Buffering        AI Inference
  I2S              Camera           Queue Router     (YOLO+LSTM)
  Threshold        Location         Correlation      Alert Gen
  LITE frame       GPS              Alert Gen        DB Write
     │                 │                 │                 │
     └─────────────────┴─────────────────┴─────────────────┘
                           │
                           ▼
                    ┌──────────┐
                    │ Frontend │
                    │ Dashboard│
                    └──────────┘
```

**Protocol**: NISHA binary frames (24-byte header + JSON metadata + payload)

---

## 📁 Repository Structure

```
NISHA_SENTINEL/
├── Backend/                    # FastAPI backend
│   ├── src/nisha/              # Application code
│   ├── migrations/             # DB migrations (Alembic)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── pyproject.toml
│   └── README.md
│
├── Frontend/                   # Next.js dashboard
│   ├── src/
│   │   ├── app/                # Pages
│   │   ├── components/         # React components
│   │   ├── store/              # Zustand
│   │   ├── services/           # API + WS
│   │   └── types/              # TypeScript
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   └── README.md
│
├── masters/                    # Master node software
│   ├── src/nisha_master/
│   │   ├── interfaces/         # WS server + client
│   │   ├── core/               # Buffer, hardware, triangulation
│   │   └── ...
│   ├── static/                 # Dashboard UI (HTML/JS)
│   ├── Dockerfile
│   └── README.md
│
├── Nisha-mobile-agent/         # React Native app
│   ├── frontend/
│   │   ├── app/                # Screens (Expo Router)
│   │   ├── src/
│   │   │   ├── services/       # Stream, Audio, Location
│   │   │   ├── store/          # Zustand
│   │   │   ├── components/     # UI
│   │   │   └── utils/          # Protocol
│   │   ├── package.json
│   │   └── app.json
│   └── backend/                # Simple FastAPI (mobile-specific)
│
├── agents/                     # Edge firmware
│   └── esp32_s3_agent/
│       ├── src/main.cpp        # Main firmware
│       ├── platformio.ini      # Build config
│       └── lib/                # Dependencies
│
├── ai/                         # Machine Learning
│   ├── video_processing/
│   │   ├── inference.py        # YOLO+LSTM detector
│   │   ├── train.py            # Training pipeline
│   │   ├── model.py            # LSTM architecture
│   │   ├── preprocess.py       # Feature extraction
│   │   ├── models/
│   │   │   ├── best_behavior_lstm.pt
│   │   │   ├── yolov8n-pose.pt
│   │   │   └── yolov8s-pose.pt
│   │   └── data/               # Training data
│   └── audio_processor/
│       └── processor.py        # Audio classifier
│
├── docs/                       # This documentation
│   ├── ARCHITECTURE.md
│   ├── backend_setup.md
│   ├── frontend_setup.md
│   ├── master_setup.md
│   ├── mobile_agent_setup.md
│   └── esp32_agent_setup.md
│
├── scripts/                    # Utility scripts
├── docker/
├── shared/                     # Common libraries
├── .github/                    # CI/CD workflows
├── .gitignore                  # Root gitignore
├── docker-compose.yml          # Full stack
├── pyproject.toml              # Backend Python project
├── README.md
└── STARTUP_GUIDE.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python**: 3.11+
- **Node.js**: 20+
- **Docker & Docker Compose** (optional but recommended)
- **PlatformIO** (for ESP32) - `pip install platformio`
- **PostgreSQL**: 16+ (or use Docker)
- **Redis**: 7+ (or use Docker)

### Quick Start (Docker)

```bash
# Clone and enter
cd NISHA_SENTINEL

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Access services:
# - Backend API: http://localhost:8000
# - Backend docs: http://localhost:8000/docs
# - Frontend: http://localhost:3000
# - Master dashboard: http://localhost:8080
```

### Manual Setup

See component-specific guides in `docs/`:
- [Backend Setup](backend_setup.md)
- [Frontend Setup](frontend_setup.md)
- [Master Setup](master_setup.md)

---

## 🧪 Testing

```bash
# Backend unit tests (fast)
cd Backend
pytest tests/ -m unit

# Backend integration (requires DB+Redis)
pytest tests/ -m integration

# Frontend lint
cd Frontend
npm run lint

# Type check
npx tsc --noEmit
```

---

## 🔧 Configuration

All secrets and connection strings in `.env` files (gitignored):

**Backend `.env`:**
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0
API_KEY=change-me-please
JWT_SECRET_KEY=another-secret
```

**Frontend `.env.local`:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/ws/realtime
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token
```

**Master `.env`:**
```bash
BACKEND_WS_URL=ws://localhost:8000/api/v1/ws/realtime
MASTER_ID=MASTER_001
```

**Mobile `.env`:**
```bash
EXPO_PUBLIC_BACKEND_URL=http://<master-ip>:8000
```

---

## 📊 Monitoring & Observability

### Health Checks

- **Backend**: `GET /health` → `{"status": "healthy"}`
- **Master**: `GET /api/health` → `{"status": "online"}`
- **Frontend**: Real-time status bar

### Logs

- Backend: Structured JSON logs (or console in dev)
- Master: Stdout logging
- Frontend: Browser console

### Metrics (future)

Prometheus + Grafana planned:
- API latency (p50, p95, p99)
- WebSocket connections
- Agent counts by status
- Queue depths
- AI inference latency

---

## 🔐 Security

### Current State

- API key authentication (backends)
- JWT for user sessions (planned)
- Plain WS (dev only) → WSS in production
- Redis cache + sessions

### TODO

- [ ] HTTPS/TLS everywhere
- [ ] OAuth2 / OIDC integration
- [ ] Per-agent API keys
- [ ] Rate limiting (per IP/agent)
- [ ] Role-based access control (RBAC)
- [ ] Audit logging
- [ ] Secrets management (Vault)
- [ ] Certificate rotation

---

## 🐛 Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Backend won't start | PostgreSQL not running | `docker-compose up postgres` |
| "Connection refused" WS | Master not connected to backend | Check `docker-compose logs master` |
| Agents can't connect | Wrong Master IP in ESP32 config | Update `MASTER_HOST` in `main.cpp` |
| Frontend 404 | API URL misconfigured | Set `NEXT_PUBLIC_API_URL` correctly |
| No video streaming | Camera permission denied | Check mobile app permissions |
| DB migration fail | Old version, no migrations | `alembic upgrade head` |

### Debug Mode

**Backend**:
```bash
LOG_LEVEL=DEBUG uvicorn nisha.main:app --reload
```

**Master**:
```bash
DEBUG=true python -m nisha_master.main
```

**Frontend**:
Open browser DevTools → Console

**ESP32**:
```bash
pio run -e esp32-s3-box -t monitor
# Serial at 115200 baud
```

---

## 🤝 Contributing

### Workflow

1. Fork / create feature branch from `main`
2. Make changes (follow component-specific style guides)
3. Add tests (if applicable)
4. Run linters & type checks
5. Commit with [conventional commit message](frontend_setup.md#example-commits)
6. Push & open PR

### Code Style

- **Backend**: Ruff (line length 100), MyPy strict mode
- **Frontend**: ESLint (Next.js), Prettier
- **ESP32**: Arduino style (2-space indent, camelCase)
- **TypeScript**: Strict mode, explicit return types

### Documentation

Update relevant `.md` files when:
- Adding new API endpoints
- Changing config defaults
- Modifying data model
- Adding/removing services

---

## 📈 Roadmap

**Phase 1 (Current)**: Foundation
- ✅ Agent management
- ✅ Basic streaming
- ✅ Dashboard MVP
- ✅ AI violence detection

**Phase 2**: Intelligence
- Audio ML (Whisper + spectral matching)
- Multi-agent correlation
- Mobile app (React Native)
- OTA updates (ESP32)

**Phase 3**: Scale
- Master failover & redundancy
- Mesh networking (ESP-NOW)
- Grid-based triangulation
- Multi-tenancy

**Phase 4**: Polish
- Full RBAC
- Advanced analytics
- Reporting dashboard
- Mobile master mode

---

## 📞 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Docs**: See `docs/` directory
- **PRD**: `Nisha_integration_PRD.md`

---

**Generated**: 2026-05-04  
**Version**: 0.1.0-alpha  
**License**: MIT (see root LICENSE)
