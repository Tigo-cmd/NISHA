# NISHA Sentinel - Complete Codebase Analysis

> **Generated**: 2026-05-04  
> **Analysis Tool**: Kilo CLI  
> **Scope**: Full architecture review of all components

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Component Deep Dive](#component-deep-dive)
   - [Backend (FastAPI)](#backend-fastapi)
   - [Frontend (Next.js)](#frontend-nextjs)
   - [Master Node (Python)](#master-node-python)
   - [Mobile Agent (React Native)](#mobile-agent-react-native)
   - [ESP32 Firmware](#esp32-firmware)
   - [AI/ML Subsystem](#aiml-subsystem)
4. [Data Model](#data-model)
5. [Deployment](#deployment)
6. [Developer Guides](#developer-guides)
7. [Git Workflow](#git-workflow)

---

## Executive Summary

**NISHA Sentinel** is a distributed telemetry and surveillance system for acoustic and visual threat detection. It's a production-grade, multi-tier architecture implementing:

- **Edge Layer**: ESP32-S3 audio agents + Mobile React Native app
- **Aggregation Layer**: Master Nodes (Raspberry Pi) with buffering and local intelligence
- **Core Layer**: FastAPI backend with AI processing, event correlation, and alerting
- **Presentation Layer**: Next.js dashboard with real-time visualizations

**Project Stats:**
- **Languages**: Python, TypeScript, C++, JavaScript, Bash
- **Codebase**: ~20,000+ lines (estimated)
- **Architecture**: Clean/Hexagonal, Domain-Driven Design
- **Pattern**: Event-driven, async-first, microservices-ready

**Key Features:**
- Agent registration, lifecycle, health monitoring
- Binary NISHA protocol (24-byte header + JSON metadata)
- Priority-based streaming (4 levels: CRITICAL/EVENT/CONTINUOUS/BACKGROUND)
- AI violence detection (YOLOv8 pose + Bi-LSTM + audio heuristics)
- Multi-agent event correlation (spatio-temporal)
- Mesh topology, handoff protocol, master failover
- Delta-based configuration updates
- WebSocket real-time updates + REST API
- Docker Compose deployment

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NISHA SENTINEL ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [ESP32] ←(I2S Audio)→ [Mobile App]               Mobile Agent             │
│       │                     │                (React Native Expo)           │
│       └───────────┬─────────┴──────────────┬───────────────────────────────┘
│                   │                        │ (WiFi/Ethernet)               │
│                   ▼                        ▼                               │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    MASTER NODE (Raspberry Pi)                    │       │
│  │  (Python + FastAPI + asyncio)                                    │       │
│  │                                                                  │       │
│  │  ┌─────────────────┐           ┌───────────────────────────────┐ │       │
│  │  │ Agent WS Server │◄──WS───►│  Backend WSS Client           │ │       │
│  │  │ Port 8082       │  (raw)   │  (relay)                     │ │       │
│  │  └────────┬────────┘           └──────────┬────────────────────┘ │       │
│  │           │                                │                      │       │
│  │           │  Binary NISHA Frames           │ WSS (authenticated)  │       │
│  │           ▼                                ▼                      │       │
│  │  ┌─────────────────────────────────────────────────────┐           │       │
│  │  │      Queue Router (asyncio.Queue)                   │           │       │
│  │  │  • stream_queue (5000)  → Video/Audio payloads     │           │       │
│  │  │  • telemetry_queue (1000) → Agent status/JSON     │           │       │
│  │  └─────────────────────────────────────────────────────┘           │       │
│  │                                                                  │       │
│  │  ┌─────────────────────────────────────────────────────┐           │       │
│  │  │            Buffer Manager (RAM+ Disk)               │           │       │
│  │  │  • 1024 MB RAM limit                               │           │       │
│  │  │  • Auto spill to /tmp/nisha_buffer                 │           │       │
│  │  │  • Drain on reconnection                            │           │       │
│  │  └─────────────────────────────────────────────────────┘           │       │
│  │                                                                  │       │
│  │  ┌─────────────────────────────────────────────────────┐           │       │
│  │  │        Local Dashboard (FastAPI + Vanilla JS)       │           │       │
│  │  │  Port 8080 • Real-time metrics • WebSocket push    │           │       │
│  │  └─────────────────────────────────────────────────────┘           │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                      │                                      │
│                                      │ WSS (TLS optional)                  │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │                    CENTRAL BACKEND (FastAPI)                             │
│  │  Port 8000 • /api/v1/* (REST) • /ws (WebSocket)                         │
│  │                                                                          │
│  │  ┌────────────────────────────────────────────────────────────┐          │
│  │  │ Connection Manager (Priority Queues)                      │          │
│  │  │  • CRITICAL (1000)  → Alerts, commands                   │          │
│  │  │  • EVENT (5000)     → Detections                         │          │
│  │  │  • CONTINUOUS (20k) → Video/audio streams (drops at 90%)│          │
│  │  │  • BACKGROUND (50k) → Telemetry                          │          │
│  │  │  • 4 Worker pools (asyncio)                              │          │
│  │  └────────────────────────────────────────────────────────────┘          │
│  │                                                                          │
│  │  ┌────────────────────────────────────────────────────────────┐          │
│  │  │  Worker Pipeline (per priority queue)                     │          │
│  │  │  AI Processor (YOLOv8+LSTM) → Correlation Engine →       │          │
│  │  │  Alert Generator → Async DB Writer (batched)              │          │
│  │  └────────────────────────────────────────────────────────────┘          │
│  │                                                                          │
│  │  Services (Domain Layer):                                               │
│  │  • AgentService      - Lifecycle, registration, health                 │
│  │  • CommandService    - Dispatch, ACK, retry                            │
│  │  • AudioService      - Audio event ingestion                           │
│  │  • VideoService      - Video frame processing                          │
│  │  • MasterService     - Master node management                          │
│  │  • TopologyService   - Mesh routing, neighbor discovery                │
│  │  • HandoffService    - Agent handoff protocol                          │
│  │  • FailoverService   - Master failure recovery                         │
│  │  • ConfigService     - Delta-based config updates                     │
│  │  • HeartbeatMonitor  - Background health checker (10s)                 │
│  │                                                                          │
│  └─────────────────────────────────────────────────────────────────────────┘
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │                    DATA PERSISTENCE LAYER                               │
│  │                                                                          │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐               │
│  │  │  PostgreSQL  │  │     Redis    │  │     MinIO       │               │
│  │  │  (Primary)   │  │  (Cache/Qs)  │  │  (Object Store) │               │
│  │  │              │  │              │  │                  │               │
│  │  │ • Agents     │  │ • Sessions   │  │ • Audio clips   │               │
│  │  │ • Masters    │  │ • Telemetry  │  │ • Video segments│               │
│  │  │ • Events     │  │ • Config     │  │ • Backups       │               │
│  │  │ • Commands   │  │ • Event bus  │  │                 │               │
│  │  │ • History    │  │              │  │                 │               │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘               │
│  │                                                                          │
│  └─────────────────────────────────────────────────────────────────────────┘
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │                    FRONTEND DASHBOARD (Next.js)                         │
│  │  Port 3000 • React 19 • TypeScript • Zustand • Tailwind                 │
│  │                                                                          │
│  │  • Real-time WebSocket (+ Socket.io fallback)                          │
│  │  • Mapbox GL / Google Maps (agent positions)                          │
│  │  • NetworkTopology (SVG force-directed graph)                         │
│  │  • WaveformVisualizer (Canvas 2D)                                      │
│  │  • TacticalOverlay (Konva canvas)                                     │
│  │  • AgentDrawer (detailed telemetry)                                   │
│  │                                                                          │
│  └─────────────────────────────────────────────────────────────────────────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Deep Dive

### Backend (FastAPI)

**Location**: `Backend/`  
**Entry**: `src/nisha/main.py`  
**Port**: 8000  
**Architecture**: Clean/Hexagonal, DDD

#### Technology Stack

```python
# Core
fastapi>=0.115.0          # API framework
uvicorn[standard]>=0.32.0 # ASGI server
sqlalchemy[asyncio]>=2.0  # ORM
asyncpg>=0.30.0           # PostgreSQL driver
alembic>=1.14.0           # Migrations

# Cache & Messaging
redis[hiredis]>=5.2.0     # Cache + session store

# Validation & Auth
pydantic>=2.10.0          # Settings + validation
pydantic-settings>=2.6.0  # Config loading
python-jose[cryptography] # JWT
passlib[bcrypt]           # Password hashing

# AI / ML
numpy>=1.26.0
opencv-python-headless
torch>=2.0.0              # PyTorch
ultralytics>=8.0.0        # YOLOv8

# Observability
structlog>=24.4.0         # Structured logging
psutil>=5.9.0             # System metrics
```

#### Directory Structure

```
Backend/
├── src/nisha/
│   ├── main.py                    # App entry + lifespan
│   ├── config.py                  # Pydantic settings
│   ├── dependencies.py             # DI container
│   │
│   ├── api/v1/
│   │   ├── router.py              # Aggregates all v1 routes
│   │   ├── agents.py              # Agent CRUD, heartbeats, commands, config
│   │   ├── masters.py             # Master management
│   │   ├── audio.py               # Audio event ingestion
│   │   ├── video.py               # Video frame processing
│   │   ├── topology.py            # Mesh routes, handoff, neighbors
│   │   ├── system.py              # Health, status
│   │   ├── ws.py                  # WebSocket endpoint
│   │   └── mobile.py              # Mobile agent endpoints
│   │
│   ├── domain/                    # Pure business logic
│   │   ├── events/                # Domain events
│   │   ├── models/                # Domain entities
│   │   └── ports/                 # Repository interfaces
│   │
│   ├── services/                  # Application services
│   │   ├── agent_service.py       # Agent lifecycle
│   │   ├── command_service.py     # Command dispatch
│   │   ├── audio_service.py       # Audio event processing
│   │   ├── video_service.py       # Video events
│   │   ├── master_service.py      # Master management
│   │   ├── topology_service.py    # Mesh topology
│   │   ├── handoff_service.py     # Handoff orchestration
│   │   ├── failover_service.py    # Master failover
│   │   ├── config_service.py      # Delta config updates
│   │   ├── heartbeat_monitor.py   # Background health task
│   │   ├── correlation_engine.py  # Multi-agent correlation
│   │   ├── alert_generator.py     # Alert creation
│   │   ├── adaptive_streaming.py  # Traffic shaping
│   │   └── ai_processor.py        # ML bridge
│   │
│   └── infrastructure/
│       ├── database/              # DB session, writer, models, repos
│       ├── cache/                 # Redis cache
│       ├── messaging/             # In-process event bus
│       └── websocket/             # Connection manager, protocol
│
├── migrations/                     # Alembic DB migrations
├── Dockerfile                      # Multi-stage build
├── docker-compose.yml              # Local dev stack
├── pyproject.toml                  # Project config
└── README.md
```

---

### Frontend (Next.js)

**Location**: `Frontend/`  
**Entry**: `src/app/page.tsx`  
**Port**: 3000  
**Framework**: Next.js 16.2.4 (App Router)

#### Tech Stack

```json
{
  "next": "16.2.4",
  "react": "19.2.4",
  "zustand": "^5.0.12",
  "mapbox-gl": "^3.22.0",
  "three": "^0.184.0",
  "konva": "^10.2.5",
  "framer-motion": "^12.38.0",
  "tailwindcss": "^4",
  "socket.io-client": "^4.8.3"
}
```

#### Directory Structure

```
Frontend/
├── src/
│   ├── app/                      # Next.js pages
│   │   ├── page.tsx              # Landing
│   │   ├── dashboard/            # Dashboard routes
│   │   │   ├── layout.tsx        # With sidebar
│   │   │   ├── page.tsx          # Overview
│   │   │   ├── agents/           # Agent list
│   │   │   ├── alerts/           # Alert management
│   │   │   ├── maps/             # Map view
│   │   │   └── audio/            # Audio monitoring
│   │   └── api/                  # API routes (if needed)
│   │
│   ├── components/
│   │   ├── dashboard/            # Dashboard components
│   │   │   ├── KPICard.tsx
│   │   │   ├── DataLoader.tsx    # Data orchestration
│   │   │   ├── MapView.tsx       # Mapbox
│   │   │   ├── GoogleMapView.tsx # Google Maps
│   │   │   ├── AgentDrawer.tsx   # Agent detail
│   │   │   ├── NetworkTopology.tsx  # SVG graph
│   │   │   ├── TacticalOverlay.tsx  # Konva
│   │   │   └── WaveformVisualizer.tsx
│   │   │
│   │   └── ui/                   # Reusable primitives
│   │       ├── button.tsx, card.tsx, tabs.tsx, Badge.tsx
│   │
│   ├── store/useStore.ts         # Zustand global state
│   ├── services/
│   │   ├── apiService.ts         # REST client
│   │   └── websocketService.ts   # WS manager
│   ├── types/index.ts            # TypeScript interfaces
│   └── config/theme.ts           # Colors, fonts
│
├── public/                       # Static assets
├── package.json
├── next.config.ts
├── tsconfig.json
└── .env.local
```

#### Key Features

- **State**: Zustand with AsyncStorage persistence
- **Real-time**: WebSocket binary + Socket.IO fallback
- **Visualization**: Mapbox GL, Google Maps, Three.js, Konva, Canvas, SVG
- **Styling**: Tailwind CSS v4 + custom animations (framer-motion)

---

### Master Node (Python)

**Location**: `masters/`  
**Entry**: `src/nisha_master/main.py`  
**Ports**: 8082 (agents), 8080 (dashboard)  
**Framework**: FastAPI (same as backend but lighter)

#### Architecture

```
Master Node (Raspberry Pi)
├── Agent WebSocket Server (8082)
│   └── Accepts ESP32 + Mobile agents
│   └── Parses NISHA binary frames
│   └── Updates metrics_store
│   └── Relays to stream_queue
├── Backend WSS Client
│   └── Connects to central backend
│   └── Sends stream_queue → WSS
│   └── Receives commands → agent_server
│   └── Auto-reconnect with buffer drain
├── Buffer Manager
│   └── RAM: 1024 MB limit
│   └── Disk: /tmp/nisha_buffer spill
├── Hardware Worker
│   └── MJPEG streams from IP cameras
│   └── Wrap in NISHA frames
├── Triangulation Engine
│   └── RSSI → distance conversion
│   └── Weighted centroid
└── Local Dashboard (8080)
    └── FastAPI + static HTML/JS
    └── WebSocket push every 100ms
```

#### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | 147 | Lifespan, task orchestration |
| `config.py` | 42 | Settings (ports, buffer, triangulation) |
| `interfaces/agent_ws.py` | 152 | WS server for agents |
| `interfaces/backend_client.py` | ~200 | WSS client to backend |
| `interfaces/dashboard.py` | ~120 | REST + WS for UI |
| `core/buffer.py` | ~100 | RAM/disk buffering |
| `core/hardware_worker.py` | ~120 | MJPEG ingestion |
| `core/triangulation.py` | ~80 | RSSI positioning |

#### Message Flow

```
ESP32 → agent_ws → [LITE/VIDEO/AUDIO/LOCATION]
                       ↓
           telemetry_queue (dashboard) + stream_queue (backend)
                       ↓
           backend_client._send_loop() → WSS to backend
                       ↓
           On disconnect: buffer → disk
           On reconnect: drain buffer (50 frames/batch)
```

---

### Mobile Agent (React Native Expo)

**Location**: `Nisha-mobile-agent/frontend/`  
**Entry**: `app/agent.tsx`  
**Platform**: iOS + Android (Expo managed)

#### Architecture

```
app/
├── _layout.tsx          Root Stack Navigator
├── index.tsx            Splash → redirect
├── agent.tsx            MAIN DASHBOARD
├── activity.tsx         Detection history
└── settings.tsx         Configuration

src/
├── services/
│   ├── StreamManager.ts    # WebSocket, video loop
│   ├── AudioManager.ts     # 10s AAC recordings
│   └── LocationManager.ts  # GPS + background task
├── store/
│   ├── useAgentStore.ts    # agentId, status, sensors, detections
│   └── useModeStore.ts     # Mode (AGENT only)
├── components/
│   ├── HiddenCamera.tsx    # Off-screen recording
│   ├── SensorRow.tsx       # Toggle: video/audio/location
│   └── ConfigOverlay.tsx   # Master URL config
└── utils/protocol.ts       # NISHAFrame encoder
```

#### Data Streaming

**Video:**
- 3-second MP4 clips @ 480p, 500 kbps
- Hidden off-screen CameraView
- Base64 encode → NISHAFrame binary → WebSocket
- Continuous loop while enabled

**Audio:**
- 10-second AAC @ 22kHz, 64kbps, mono
- Looping recordings
- Same WebSocket connection

**Location:**
- Foreground: every 2s / 5m
- Background: 5-10s (Android foreground service)
- Background modes: audio, location

#### State Machine

```
UNSELECTED → NEW → DIRECT_SERVER → SEARCHING → CONNECTED → ORPHAN (reconnect)
    ↓
 initializeAgent()
    ↓
  generate SENTINEL-XXXX ID
    ↓
  connect(agentId) to ws://<master>:8082
```

---

### ESP32 Firmware (C++)

**Location**: `agents/esp32_s3_agent/src/main.cpp`  
**Platform**: ESP32-S3-Box  
**Language**: C++ (Arduino framework)  
**Size**: 228 lines

#### Hardware

```
ESP32-S3-Box
├── I2S Microphone (MAX9814)
│   WS → GPIO15
│   SD → GPIO13
│   SCK → GPIO14
├── WiFi 802.11 b/g/n
└── WebSocket client
```

#### Initialization

```cpp
void setup() {
  1. Serial(115200)
  2. WiFi.begin(ssid, password)  // Blocking
  3. agentId = WiFi.macAddress() (colons stripped)
  4. webSocket.begin(master_ip, 8082, "/")
  5. webSocket.setReconnectInterval(5000)
  6. I2S driver install (16kHz, 32-bit, DMA 8×512)
}
```

#### Audio Processing

```cpp
void processAudio() {
  i2s_read(I2S_PORT, buffer, 4096, portMAX_DELAY);
  // Blocking DMA read

  // RMS calculation
  for (samples) sum += sample^2;
  rms = sqrt(sum / count);
  db = 20 * log10(rms / 10.0);

  if (db > 70.0 && 5s elapsed) {
    send LITE frame: {"alert":"HARMFUL_SOUND","db":75.2}
  }
}
```

#### NISHA Protocol

```cpp
#pragma pack(push, 1)
struct NishaHeader {
  char magic[2];      // "NI"
  uint8_t version;    // 1
  uint8_t stream_type; // 0x01=LITE, 0x02=VIDEO, 0x03=AUDIO, 0x04=LOCATION
  uint8_t priority;   // 0=LOW, 1=HIGH
  uint32_t sequence;  // big-endian
  uint64_t timestamp; // big-endian (ms)
  uint32_t payload_len;
  uint16_t meta_len;
};
#pragma pack(pop)
```

#### Limitations

- Hardcoded WiFi credentials (insecure)
- No OTA updates
- No command handling (ignores inbound JSON)
- No battery monitoring (hardcoded 100%)
- No deep sleep (continuous power)
- Blocking I2S read (WDT risk)
- No TLS (plain WS)

---

### AI/ML Subsystem

**Location**: `ai/`

#### Video: Violence Detection (YOLOv8 + LSTM)

**Two-Stage Pipeline:**

1. **YOLOv8 Pose Estimation**
   - Models: `yolov8n-pose.pt` (6.8 MB) or `yolov8s-pose.pt` (23.5 MB)
   - Extracts 17 body keypoints → 51 features (x, y, conf)
   - Resolution: 320px (nano) or 640px (full)

2. **Bidirectional LSTM**
   - Input: 30 frames sliding window → (30, 51)
   - Architecture: 2-layer Bi-LSTM, hidden=128, dropout=0.3
   - Output: Violence / NonViolence + confidence
   - Model: `models/best_behavior_lstm.pt` (7.0 MB)

**Training:**
- Dataset: Real Life Violence Dataset (Kaggle)
- Split: 80% train, 10% val, 10% test
- Optimizer: Adam (lr=1e-3)
- Early stopping (patience=10)
- Best: val_f1=0.876 (epoch 12)
- Test accuracy: **78.53%**
  - Violence: Precision 70.77%, Recall 96.84%, F1 81.78%
  - NonViolence: Precision 95.08%, Recall 60.42%, F1 73.89%

**Inference:**
- Frame-by-frame or video file
- Classify every 10 frames (stride)
- Latency: ~10-30ms (GPU), ~50-150ms (CPU)

#### Audio: Heuristic Classification (Current)

**Module**: `ai/audio_processor/processor.py`

Not ML-based yet (rule-based):

```python
if intensity > 0.12:      return "Scream", 0.92
elif 0.02 < intensity < 0.12 and variance > 0.4:
                           return "VoicePattern", 0.88
else:                      return "AmbientNoise", 1.0
```

**Planned** (per `Backend/Audio_processing.md`):
- Whisper ASR (multilingual)
- Spectral template matching (gunshots, explosions)
- Speaker diarization
- Keyword spotting

---

## Data Model (PostgreSQL)

### Schema Overview

```sql
agents (
  agent_id VARCHAR(17) PK,
  short_id VARCHAR(10) UNIQUE,
  master_id VARCHAR(10) FK,
  status VARCHAR(20) INDEX,      -- NEW, ACTIVE, DEGRADED, OFFLINE, TAMPERED
  capabilities JSONB,
  config JSONB,
  location_zone VARCHAR(50),
  gps_lat NUMERIC(10,8),
  gps_lng NUMERIC(10,8),
  firmware_version VARCHAR(20),
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

masters (
  master_id VARCHAR(10) PK,
  name VARCHAR(100),
  ip_address INET,
  max_agents INTEGER DEFAULT 50,
  current_agent_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ONLINE',
  mesh_neighbors JSONB,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

agent_history (
  id SERIAL PK,
  agent_id VARCHAR(17) FK → agents(agent_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ,
  event_type VARCHAR(50),        -- REGISTRATION, HEARTBEAT, ALERT
  data JSONB,
  server_received_at TIMESTAMPTZ
)

commands (
  cmd_id VARCHAR(36) PK,
  agent_id VARCHAR(17) INDEX,
  command_type VARCHAR(30),      -- REBOOT, UPDATE_CONFIG, FLIP_CAMERA
  priority VARCHAR(10),
  status VARCHAR(20) INDEX,      -- PENDING, DISPATCHED, ACK, COMPLETED, FAILED
  params JSONB,
  requires_ack BOOLEAN,
  max_retries INTEGER DEFAULT 3,
  retry_count INTEGER DEFAULT 0
)

audio_events (
  id VARCHAR(36) PK,
  agent_id VARCHAR(17) INDEX,
  timestamp TIMESTAMPTZ INDEX,
  event_type VARCHAR(30),        -- HARMFUL_SOUND, GUNSHOT
  class_name VARCHAR(30) INDEX,
  confidence NUMERIC(4,3),
  audio_data TEXT,               -- Base64 encoded
  transcription TEXT,
  confirmed BOOLEAN DEFAULT false
)

video_events (
  id VARCHAR(36) PK,
  agent_id VARCHAR(17) INDEX,
  timestamp TIMESTAMPTZ INDEX,
  behavior VARCHAR(20) INDEX,    -- Violence, NonViolence, Suspicious
  confidence NUMERIC(4,3),
  keypoints JSONB,
  frame_index INTEGER
)

mesh_routes (
  id SERIAL PK,
  source_node VARCHAR(17),
  target_node VARCHAR(17),
  next_hop VARCHAR(17),
  hop_count INTEGER DEFAULT 1,
  signal_strength INTEGER,
  active BOOLEAN DEFAULT true
)
```

**Indexes for performance:**
- `ix_agents_status_master (status, master_id)`
- `ix_agent_history_agent_time (agent_id, timestamp)`
- `ix_mesh_routes_source_target (source_node, target_node)`
- `ix_commands_agent_status (agent_id, status)`

---

## Deployment

### Docker Compose (All-in-One)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nisha
      POSTGRES_PASSWORD: nisha_secret
      POSTGRES_DB: nisha_sentinel
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data

  backend:
    build: ./Backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://nisha:nisha_secret@postgres:5432/nisha_sentinel
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./Frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000
      NEXT_PUBLIC_WS_URL: ws://backend:8000/api/v1/ws/realtime

  master:
    build: ./masters
    ports:
      - "8080:8080"   # Dashboard
      - "8082:8082"   # Agents
    environment:
      BACKEND_WS_URL: ws://backend:8000/api/v1/ws/realtime
      MASTER_ID: MASTER_001
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

### Manual Startup Order

1. **PostgreSQL + Redis** (Docker)
2. **Backend** → `uvicorn nisha.main:app --port 8000`
3. **Master** → `python -m nisha_master.main` (connects to backend)
4. **Frontend** → `npm run dev` (http://localhost:3000)
5. **Mobile** → `npx expo start`
6. **ESP32** → Flashed firmware auto-connects to Master

---

## Developer Guides

### Backend Development

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn nisha.main:app --reload --port 8000
```

**API Docs**: http://localhost:8000/docs  
**WebSocket**: ws://localhost:8000/api/v1/ws/realtime

**Run tests:**
```bash
pytest tests/ -m unit          # Fast unit tests
pytest tests/ -m integration   # Requires DB+Redis
```

### Frontend Development

```bash
cd Frontend
npm install
npm run dev  # → http://localhost:3000
```

**Environment**: `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/ws/realtime
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token
```

### Master Node Development

```bash
cd masters
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn nisha_master.main:app --port 8080
```

**Dashboard**: http://localhost:8080  
**Agent WS**: ws://localhost:8082

### Mobile Development

```bash
cd Nisha-mobile-agent/frontend
npm install
npx expo start
```

**Scan QR** with Expo Go app, or press:
- `a` → Android emulator
- `i` → iOS simulator

### ESP32 Flashing

```bash
cd agents/esp32_s3_agent
# Edit config.h with WiFi credentials and master IP
pio run -e esp32-s3-box -t upload
pio run -e esp32-s3-box -t monitor  # Serial output
```

---

## Git Workflow

### Branch Strategy

```
main           → Production (tagged releases)
develop        → Integration (optional)
feature/*      → New features (feat/agent-health)
bugfix/*       → Hotfixes (bugfix/ws-reconnect)
release/*      → Release candidates
hotfix/*       → Emergency patches
```

### Commit Message Format

```
type(scope): short description (50 chars max)

Longer description if needed (wrap at 72 chars).
Focus on WHY, not WHAT.

- Bullet point 1
- Bullet point 2

Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:    Code formatting (no logic change)
refactor: Restructuring
perf:     Performance improvement
test:     Tests
chore:    Build, CI, dependencies
infra:    Deployment, Docker
ai:       AI/ML changes

Scopes (backend): agent, master, audio, video, topology, handoff, 
                  failover, config, command, ws, api, db, ai
Scopes (frontend): dashboard, map, agents, alerts, components, store,
                   services, websocket, ui
```

### Example Commits

```
feat(agent): add multi-dimensional health evaluation

- Introduces battery, signal, temp, memory thresholds
- Status transitions: ACTIVE → DEGRADED → OFFLINE
- HeartbeatMonitor runs every 10s, broadcasts state changes
- Worst check determines overall health level

fix(ws): handle binary frame queue overflow

- Added try/except for QueueFull on stream_queue.put_nowait()
- Drops frames when backend congested, logs warning
- Prevents OOM under extreme load

refactor(mobile): separate audio and video streaming services

- AudioManager: continuous 10s AAC loop
- StreamManager: video 3s clip loop + WebSocket
- Clearer separation of concerns, independent toggles
```

---

## Component READMEs

For detailed setup and architecture per component, see:

- **[Backend Setup](docs/backend_setup.md)** - FastAPI, Docker, AI integration
- **[Frontend Setup](docs/frontend_setup.md)** - Next.js, state management, visualizations
- **[Master Node Setup](docs/master_setup.md)** - Raspberry Pi aggregator
- **[Mobile Agent Setup](docs/mobile_agent_setup.md)** - React Native Expo app
- **[ESP32 Agent Setup](docs/esp32_agent_setup.md)** - C++ firmware, I2S audio, WebSocket

---

## Quick Reference

### Ports

| Service | Port | Protocol |
|---------|------|----------|
| Backend API | 8000 | HTTP/REST |
| Backend WS | 8000 | WebSocket (WSS) |
| Frontend | 3000 | HTTP |
| Master Dashboard | 8080 | HTTP |
| Master Agent WS | 8082 | WebSocket |
| ESP32 → Master | 8082 | WebSocket |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |

### Environment Variables

**Backend** (`.env`):
```bash
DATABASE_URL=postgresql+asyncpg://nisha:nisha_secret@localhost:5432/nisha_sentinel
REDIS_URL=redis://localhost:6379/0
API_KEY=your-secure-key
JWT_SECRET_KEY=your-jwt-secret
APP_ENV=development
LOG_LEVEL=INFO
```

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/ws/realtime
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token
```

**Master** (`.env`):
```bash
BACKEND_WS_URL=ws://localhost:8000/api/v1/ws/realtime
MASTER_ID=MASTER_001
BUFFER_RAM_LIMIT_MB=1024
```

**Mobile** (`.env`):
```bash
EXPO_PUBLIC_BACKEND_URL=http://<master-ip>:8000
```

### Useful Commands

```bash
# View logs (backend)
docker-compose logs -f backend

# Database migrations
alembic upgrade head

# Redis CLI
redis-cli ping

# ESP32 serial monitor
pio run -e esp32-s3-box -t monitor

# ESLint + Prettier (frontend)
npm run lint
```

---

## Security Notes

- **Change all default secrets** before deployment (API_KEY, JWT_SECRET)
- Use **WSS (TLS)** in production (currently plain WS for dev)
- **Rotate credentials**: ESP32 hardcoded WiFi/move to config.h
- **Enable authentication**: Backend uses simple API key; implement JWT for users
- **Network isolation**: Agents/Master on separate VLAN or VPN
- **Database encryption**: Enable pgcrypto for sensitive fields
- **Audit logging**: All command/state changes logged to `agent_history`

---

## Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| Agent heartbeat latency | < 2s | 30s interval, 90s timeout |
| Video frame pipeline | < 100ms | From capture to DB write |
| Alert delivery | < 5s | Detection → Telegram |
| WebSocket broadcast | < 100ms | To all connected dashboards |
| DB write throughput | 1000+ events/s | Batched async writer |
| Agent capacity (per master) | 50 | WiFi bandwidth bound (~5 Mbps/agent) |
| Master failover detection | 60s | Last seen > 60s |

---

## Known Limitations & TODOs

1. **Audio AI not implemented** (rule-based only)
2. **No OTA updates** for ESP32
3. **Single-threaded** ESP32 firmware (no FreeRTOS tasks)
4. **No mesh networking** (ESP-NOW not used)
5. **No grid-level triangulation** (RSSI only)
6. **Limited test coverage** (~20% estimated)
7. **No RBAC** (all-or-nothing API key)
8. **No rate limiting** per agent
9. **Mobile app**: Background video not possible (OS restriction)
10. **Models**: Trained on small dataset (~100 videos), may need more data

---

## Resources

- **Documentation**: See `docs/` directory
- **PRD**: `Nisha_integration_PRD.md`
- **System Ops**: `SYSTEM_OPERATIONS.md`
- **Startup Guide**: `STARTUP_GUIDE.md`
- **AI Models**: `ai/video_processing/` (inference, training)
- **Hardware PRD**: `agents/hardware_integration_prd.md`

---

**Last Updated**: 2026-05-04  
**Maintainer**: NISHA Sentinel Team  
**License**: (see repository LICENSE)
