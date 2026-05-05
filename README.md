# NISHA Sentinel

> **Distributed Telemetry & Surveillance System**
>
> Real-time acoustic and visual threat detection using edge AI, mesh networking, and multi-agent correlation.

[Architecture](#architecture) • [Quick Start](#-quick-start) • [Components](#-components) • [Documentation](#-documentation) • [License](#license)

---

## 🎯 Overview

NISHA Sentinel is a production-grade surveillance platform that connects distributed audio/video sensor agents to a central AI backend for real-time threat detection. The system employs:

- **Edge Agents**: ESP32 microcontrollers + mobile phones streaming audio/video
- **Master Nodes**: Raspberry Pi aggregators with local buffering and failover
- **Central Backend**: FastAPI service with YOLOv8+LSTM violence detection
- **Dashboard**: Next.js web app with real-time maps, topology graphs, and alerts
- **AI Pipeline**: Pose estimation + behavior classification + multi-agent correlation

**Key Features:**
- ✅ Binary NISHA protocol (24-byte header, priority queues)
- ✅ Continuous video streaming + audio capture
- ✅ GPS location tracking with background updates
- ✅ AI violence detection (78% accuracy, real-time)
- ✅ Multi-agent event correlation (spatio-temporal)
- ✅ Mesh topology with handoff & failover
- ✅ Delta-based configuration management
- ✅ WebSocket real-time updates
- ✅ Docker Compose deployment

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ESP32      │     │  Mobile     │     │   Master    │     │  Backend    │
│  Agent      │────►│  Agent      │────►│   Node      │────►│  (FastAPI)  │
│  (Audio)    │     │  (AV+GPS)   │     │  (Pi)       │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────┐
                                                    │   PostgreSQL     │
                                                    │   + Redis        │
                                                    └──────────────────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────┐
                                                    │  Next.js         │
                                                    │  Dashboard       │
                                                    └──────────────────┘
```

**Protocol**: NISHA binary frames (TELEMETRY, VIDEO, AUDIO, LOCATION streams with 4 priority levels).  
**AI Models**: YOLOv8-nano/pose (6.8 MB) + Bi-LSTM (7 MB) for violence classification.  
**Streaming**: WebSocket with exponential reconnection, RAM+disk buffering.

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose (recommended)
- OR: Python 3.11+, Node.js 20+, PostgreSQL 16, Redis 7

### One-Command Start (Docker)

```bash
git clone <your-fork>
cd NISHA_SENTINEL
docker-compose up -d

# Services start:
# - Backend:  http://localhost:8000
# - Frontend: http://localhost:3000
# - Master:   http://localhost:8080
# - Postgres: localhost:5432
# - Redis:    localhost:6379
```

### Manual Setup

See component-specific guides in `docs/`:

1. [Backend Setup](docs/backend_setup.md)
2. [Frontend Setup](docs/frontend_setup.md)
3. [Master Setup](docs/master_setup.md)
4. [Mobile Agent Setup](docs/mobile_agent_setup.md)
5. [ESP32 Setup](docs/esp32_agent_setup.md)

---

## 📦 Components

| Component | Language | Port | Purpose |
|-----------|----------|------|---------|
| [Backend](Backend/) | Python 3.11 | 8000 | Central API, AI, WebSocket hub |
| [Frontend](Frontend/) | TypeScript | 3000 | Real-time dashboard |
| [Master](masters/) | Python 3.11 | 8080/8082 | Agent aggregator, buffer, local UI |
| [Mobile Agent](Nisha-mobile-agent/) | React Native | N/A | iOS/Android sensor app |
| [ESP32 Agent](agents/esp32_s3_agent/) | C++ | N/A | Edge audio sensor |
| [AI Models](ai/) | Python/PyTorch | N/A | Violence detection |

**Data Flow:** Agent → Master → Backend → Dashboard  
**Protocol**: Binary NISHA frames over WebSocket

---

## 📚 Documentation

### Core Architecture
- **[Full Architecture Guide](docs/ARCHITECTURE.md)** - System design, patterns, data model
- **[Integration PRD](Nisha_integration_PRD.md)** - Product requirements, API specs, scaling strategy
- **[System Operations](SYSTEM_OPERATIONS.md)** - Startup sequence, troubleshooting, monitor
- **[Startup Guide](STARTUP_GUIDE.md)** - Quick command reference

### Component Setup (Git + Dev)
- **[Backend](docs/backend_setup.md)** - FastAPI, Docker, AI integration, gitignore
- **[Frontend](docs/frontend_setup.md)** - Next.js, state, visualizations, gitignore
- **[Master Node](docs/master_setup.md)** - Raspberry Pi software, buffering, dashboard
- **[Mobile Agent](docs/mobile_agent_setup.md)** - Expo app, streaming, permissions
- **[ESP32 Agent](docs/esp32_agent_setup.md)** - Firmware, I2S, flashing, security

### Index
- **[Documentation Index](docs/INDEX.md)** - Complete guide to all docs

---

## 🔧 Development Workflow

### Backend

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn nisha.main:app --reload --port 8000

# API docs: http://localhost:8000/docs
# Tests:
pytest tests/ -m unit
```

### Frontend

```bash
cd Frontend
npm install
npm run dev  # → http://localhost:3000

# Lint
npm run lint

# Build
npm run build
```

### Master

```bash
cd masters
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn nisha_master.main:app --port 8080

# Dashboard: http://localhost:8080
```

### Mobile

```bash
cd Nisha-mobile-agent/frontend
npm install
npx expo start

# a → Android emulator
# i → iOS simulator
# Scan QR → Expo Go app
```

### ESP32

```bash
cd agents/esp32_s3_agent
# Edit config.h with WiFi + Master IP
pio run -e esp32-s3-box -t upload
pio run -e esp32-s3-box -t monitor  # Serial @ 115200
```

---

## 🧪 Testing

```bash
# Backend unit tests (fast, no DB)
cd Backend && pytest tests/ -m unit

# Backend integration (requires Postgres+Redis)
cd Backend && pytest tests/ -m integration

# Frontend type check
cd Frontend && npx tsc --noEmit

# Frontend lint
cd Frontend && npm run lint
```

---

## 🐳 Docker

```bash
# Full stack
docker-compose up -d

# Single service
docker-compose up -d backend postgres redis

# View logs
docker-compose logs -f backend

# Stop
docker-compose down

# Rebuild
docker-compose build --no-cache backend
```

---

## 📡 Protocol: NISHA Binary Frames

```
┌─────────────────────────────────────────────┐
│ Header (24 bytes, big-endian)              │
├────────────┬───────┬──────┬──────┬─────────┤
│ magic[2]   │ ver   │ type │ prio │ resvd   │
│ "NI"       │ 1     │ 0x01 │ 0-3  │ 0       │
├────────────┼───────┼──────┼──────┼─────────┤
│ sequence   │ timestamp          │ payload  │
│ uint32     │ uint64 (ms)        │ uint32   │
├────────────┴───────┴──────┴──────┴─────────┤
│ meta_len[2] (uint16)                       │
│ metadata (JSON, variable)                   │
│ payload (raw bytes)                         │
└─────────────────────────────────────────────┘

Stream Types:
  0x01 = TELEMETRY (heartbeat, RSSI, battery)
  0x02 = VIDEO (MP4 clip)
  0x03 = AUDIO (AAC/WAV)
  0x04 = LOCATION (GPS JSON)

Priorities:
  0 = CRITICAL (alerts, commands)
  1 = EVENT (detections)
  2 = CONTINUOUS (video/audio streams)
  3 = BACKGROUND (telemetry)
```

**Implemented in:**
- Backend: `Backend/src/nisha/infrastructure/websocket/protocol.py`
- Master: `masters/src/nisha_master/interfaces/agent_ws.py` (struct unpack)
- Mobile: `Nisha-mobile-agent/frontend/src/utils/protocol.ts` (TypeScript DataView)
- ESP32: `agents/esp32_s3_agent/src/main.cpp` (pragma pack struct)

---

## 🤝 Contributing

We follow [Conventional Commits](https://www.conventionalcommits.org/).

```
feat(agent): add health evaluation state machine
fix(ws): handle queue overflow gracefully
refactor(master): separate buffer manager
```

See component-specific commit templates in `docs/`.

---

## ⚠️ Security

**Before deploying:**

1. Change all default secrets:
   - `API_KEY` in Backend `.env`
   - `JWT_SECRET_KEY`
2. Enable TLS/WSS (production)
3. Rotate ESP32 WiFi credentials (move to config.h)
4. Enable PostgreSQL encryption (pgcrypto)
5. Configure Redis AUTH
6. Set up firewall (-agent ports only)
7. Enable audit logging

See `docs/backend_setup.md` for detailed security checklist.

---

## 📈 Performance Targets

| Metric | Target |
|--------|--------|
| Heartbeat latency | <2s |
| Video frame pipeline | <100ms |
| Alert delivery | <5s |
| WS broadcast | <100ms |
| DB write throughput | 1000+ events/s |
| Agents per master | 50 |

---

## 🐛 Known Issues & TODOs

- [ ] Audio ML model not implemented (heuristic only)
- [ ] No OTA updates for ESP32
- [ ] Single-threaded ESP32 firmware
- [ ] No mesh networking (ESP-NOW planned)
- [ ] Limited test coverage (~20%)
- [ ] No RBAC (all-or-nothing)
- [ ] Mobile background video restricted by OS

See `docs/ARCHITECTURE.md` for full technical debt list.

---

## 📄 License

MIT License - see `LICENSE` file in repository.

---

## 📞 Support

- **Docs**: `/docs` directory
- **PRD**: `Nisha_integration_PRD.md`
- **Ops**: `SYSTEM_OPERATIONS.md`
- **Issues**: GitHub Issues

---

**Version**: 0.1.0-alpha  
**Last Updated**: 2026-05-04  
**Status**: Active Development
