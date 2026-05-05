 I'll create the master integration document showing how all NISHA systems connect into a unified architecture.

---

# NISHA Master Integration Document

**Version:** 1.0  
**Date:** 2026-04-20  
**Status:** Architecture Complete  
**Scope:** Full system integration across all components

---

## 1. System Architecture Overview

### 1.1 Complete System Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INTERFACES                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   USERS     │  │   LANDING   │  │   MOBILE    │  │  ADMIN DASHBOARD │ │
│  │  (Public)   │  │    PAGE     │  │    APP      │  │   (Internal)     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                │                   │         │
│         └────────────────┴────────────────┴───────────────────┘         │
│                                   │                                     │
│                                   ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      API GATEWAY (FastAPI)                        │   │
│  │         Auth │ Rate Limit │ Routing │ WebSocket Manager            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                   │                                     │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CORE SERVICES LAYER                              │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │    AGENT    │  │    AUDIO    │  │     MAP     │  │   LOCALIZATION   │ │
│  │  MANAGEMENT │  │  PROCESSING │  │    SERVICE  │  │     ENGINE       │ │
│  │             │  │             │  │             │  │                  │ │
│  │ • Lifecycle │  │ • Speech    │  │ • Zones     │  │ • Triangulation  │ │
│  │ • Registry  │  │ • Harmful   │  │ • Coverage  │  │ • Proximity      │ │
│  │ • Commands  │  │ • Emergency │  │ • Heatmaps  │  │ • Fusion         │ │
│  │ • Health    │  │ • Streaming │  │ • Routes    │  │ • Confidence     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                │                   │         │
│         └────────────────┴────────────────┴───────────────────┘         │
│                                   │                                     │
│                                   ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MESSAGE BROKER (Redis)                         │   │
│  │     Streams │ Pub/Sub │ Queue │ Cache │ Session Store              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                   │                                     │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                                │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  POSTGRES   │  │    MINIO    │  │   NETWORK   │  │   MONITORING    │ │
│  │  (Primary)  │  │  (Storage)  │  │   MESH      │  │   (Observability)│ │
│  │             │  │             │  │             │  │                  │ │
│  │ • Agents    │  │ • Audio     │  │ • ESP-NOW   │  │ • Prometheus    │ │
│  │ • Masters   │  │ • Video     │  │ • WiFi      │  │ • Grafana       │ │
│  │ • Events    │  │ • Clips     │  │ • WebSocket │  │ • Logging       │ │
│  │ • Locations │  │ • Backups   │  │ • MQTT      │  │ • Alerting      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EDGE LAYER                                       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      MASTER NODES (Raspberry Pi)                  │   │
│  │                                                                  │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │   │
│  │  │ Master  │  │ Master  │  │ Master  │  │  ...    │  │ Master │ │   │
│  │  │  M-001  │  │  M-002  │  │  M-003  │  │         │  │  M-020 │ │   │
│  │  │(10 agts)│  │(25 agts)│  │(15 agts)│  │         │  │(50 agt)│ │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘  └───┬────┘ │   │
│  │       │            │            │                        │      │   │
│  │       └────────────┴────────────┴────────────────────────┘      │   │
│  │                              │                                   │   │
│  │                         Mesh Network                            │   │
│  │                    (ESP-NOW + WiFi Fallback)                    │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│  ┌──────────────────────────────┼──────────────────────────────────┐   │
│  │                         AGENT NODES                              │   │
│  │                                                                  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        ┌─────────────────┐  │   │
│  │  │  ESP32  │ │  ESP32  │ │  ESP32  │  ...   │   MOBILE AGENT  │  │   │
│  │  │ Agent   │ │ Agent   │ │ Agent   │        │   (Phone App)   │  │   │
│  │  │  A-001  │ │  A-002  │ │  A-500  │        │                 │  │   │
│  │  │• Audio  │ │• Audio  │ │• Audio  │        │ • Audio         │  │   │
│  │  │• Video  │ │• Video  │ │• Radar  │        │ • Video         │  │   │
│  │  │• Mesh   │ │• Mesh   │ │• Mesh   │        │ • GPS           │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘        │ • 4G/WiFi       │  │   │
│  │                                              │ • Master Mode   │  │   │
│  │                                              └─────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Integration

### 2.1 Detection to Alert Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  EVENT  │────►│  AGENT  │────►│  MASTER │────►│  SERVER │────►│  ALERT  │
│ DETECTED│     │PROCESS  │     │AGGREGATE│     │ANALYZE  │     │  SENT   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  Gunshot       Audio VAD      Deduplicate    Localize event   Telegram
  detected      Features       Select best    Fuse sensors     Dashboard
  13:31:00      extracted      quality        Calculate        Push notif
                Priority 1     Buffer ±2s     confidence       Log to DB
                Compressed     Forward to     Store clip       Update map
                to Master      Server
```

### 2.2 Configuration Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  ADMIN  │────►│  SERVER │────►│  MASTER │────►│  AGENT  │
│  UPDATE │     │ VALIDATE│     │  QUEUE  │     │  APPLY  │
│  CONFIG │     │  STORE  │     │  BATCH  │     │  CONFIG │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  Change        Update DB        Push to        ACK receipt
  sensitivity   Invalidate       connected      Reboot if
  for Zone 4    cache            agents         needed
                Notify
                masters
```

### 2.3 Health Monitoring Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  AGENT  │────►│  MASTER │────►│  SERVER │────►│  DASH   │────►│  ADMIN  │
│HEARTBEAT│     │ BATCH   │     │ PROCESS │     │  UPDATE │     │NOTIFIED │
│ 30s     │     │  5s     │     │  STORE  │     │  REALTIME      IF CRITICAL
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  Battery:      Aggregate      State machine    WebSocket      SMS/Email
  78%           10 agents      transition       broadcast      if offline
  Signal:       per packet     OFFLINE after    Map update     > 5 minutes
  -65dBm        Compress       3 missed         Alert badge
  Status:       Forward        heartbeats       Red indicator
  ACTIVE
```

---

## 3. Component Integration Matrix

### 3.1 Service Dependencies

| Service | Depends On | Used By | Shared Data |
|---------|-----------|---------|-------------|
| **Agent Mgmt** | Database, Redis | All services | Agent registry, health status |
| **Audio Processing** | Agent Mgmt, Storage | Localization, Alerts | Detections, features, clips |
| **Localization** | Agent Mgmt, Audio, Map | Alerts, Dashboard | Positions, confidence scores |
| **Map Service** | Agent Mgmt, Localization | Dashboard, Alerts | Zones, coverage, heatmaps |
| **Alerts** | All above | External (Telegram) | Formatted notifications |
| **Dashboard** | All above | Admins | Aggregated views |

### 3.2 Data Stores

| Store | Type | Data | Access Pattern | Retention |
|-------|------|------|----------------|-----------|
| **PostgreSQL** | Relational | Agents, Masters, Events, Users | OLTP, indexed queries | Permanent |
| **Redis** | Cache/Queue | Sessions, real-time state, job queues | High read/write | 24h (volatile) |
| **MinIO** | Object | Audio clips, video segments, backups | Write-once, read-rarely | 90 days hot, 1 year warm |
| **TimeScaleDB** | Time-series | Metrics, heartbeats, telemetry | Time-range queries | 30 days raw, 1 year aggregated |

---

## 4. API Integration Map

### 4.1 Internal APIs

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTERNAL API CONTRACTS                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Agent Management Service                                                │
│  ├── GET    /internal/agents/{id}           → Agent details              │
│  ├── POST   /internal/agents/register       → New agent                  │
│  ├── PUT    /internal/agents/{id}/status    → Status update              │
│  └── GET    /internal/agents/healthy        → Health check list          │
│                                                                          │
│  Audio Processing Service                                                │
│  ├── POST   /internal/audio/ingest          → Receive audio features     │
│  ├── GET    /internal/audio/{id}/clip       → Retrieve audio file        │
│  └── POST   /internal/audio/detect          → Submit detection event     │
│                                                                          │
│  Localization Service                                                    │
│  ├── POST   /internal/localize/event        → Calculate position         │
│  ├── GET    /internal/localize/agents/{zone}→ Agents in zone             │
│  └── POST   /internal/localize/calibrate    → Update calibration         │
│                                                                          │
│  Map Service                                                             │
│  ├── GET    /internal/map/zones             → Zone definitions           │
│  ├── GET    /internal/map/coverage          → Coverage polygons          │
│  └── POST   /internal/map/heatmap           → Generate heatmap tiles     │
│                                                                          │
│  Alert Service                                                           │
│  ├── POST   /internal/alerts/create         → Create alert               │
│  ├── PUT    /internal/alerts/{id}/ack       → Acknowledge                │
│  └── GET    /internal/alerts/active         → Active alerts list         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 External APIs

| Service | Endpoint | Purpose | Rate Limit |
|---------|----------|---------|------------|
| **Telegram** | `api.telegram.org` | Alert delivery | 30 msg/sec |
| **NTP** | `pool.ntp.org` | Time synchronization | Standard |
| **Maps** | `api.mapbox.com` | Map tiles, geocoding | 100k/month |
| **SMS** | Provider API (Twilio) | Critical alerts | 10 msg/sec |

---

## 5. Event-Driven Architecture

### 5.1 Event Types

| Event | Publisher | Subscribers | Action |
|-------|-----------|-------------|--------|
| `agent.registered` | Agent Mgmt | Localization, Map | Add to zone, update coverage |
| `agent.status_changed` | Agent Mgmt | Dashboard, Alerts | Update UI, notify if critical |
| `audio.detected` | Audio Processing | Localization, Alerts | Calculate position, create alert |
| `position.estimated` | Localization | Map, Alerts | Update heatmap, enrich alert |
| `alert.created` | Alerts | Telegram, Dashboard, Mobile | Send notifications |
| `config.updated` | Agent Mgmt | Master (via WS) | Push to agents |
| `master.handoff` | Master | Agent Mgmt, Localization | Update routing, recalculate |

### 5.2 Message Broker Topics

```
Redis Streams:
├── nisha:events:agents        (agent lifecycle)
├── nisha:events:audio         (detections)
├── nisha:events:positions     (localization results)
├── nisha:events:alerts        (alert notifications)
└── nisha:commands:agents      (command distribution)

Redis Pub/Sub:
├── nisha:realtime:dashboard   (WebSocket broadcast)
├── nisha:realtime:map         (map updates)
└── nisha:system:health        (health checks)

Redis Queues:
├── nisha:queue:audio:process  (audio processing jobs)
├── nisha:queue:alerts:send    (notification jobs)
└── nisha:queue:exports        (report generation)
```

---

## 6. Security Integration

### 6.1 Authentication Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  USER   │────►│  LANDING│────►│  SERVER │────►│ DASHBOARD│
│         │     │  LOGIN  │     │  AUTH   │     │  ACCESS  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  Request        Submit creds    Verify JWT      Load user
  dashboard      (email/pass)    Issue token     permissions
                 MFA if enabled  24h expiry      WebSocket
                                                 connection

AGENT AUTHENTICATION:
├─ Device certificate (X.509) generated at provisioning
├─ Token-based (short-lived) for session
└─ Master validates, forwards to Server with attestation

MOBILE AUTHENTICATION:
├─ Phone number verification (SMS)
├─ Device UUID registration
└─ JWT token, refresh mechanism
```

### 6.2 Authorization Matrix

| Role | Agents | Masters | Config | Alerts | Analytics | Users |
|------|--------|---------|--------|--------|-----------|-------|
| **Super Admin** | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD |
| **Admin** | CRUD | RU | RU | CRUD | CR | R |
| **Operator** | RU | R | R | CRU | R | - |
| **Viewer** | R | R | R | R | R | - |
| **Agent** | Self | - | Read | Create | - | - |

---

## 7. Deployment Architecture

### 7.1 Docker Compose (Single Server)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Core Application
  api:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql://nisha:${DB_PASS}@postgres:5432/nisha
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio:9000
    depends_on: [postgres, redis, minio]

  # Frontend
  web:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - API_URL=http://api:8000
      - WS_URL=ws://api:8000/ws

  # Databases
  postgres:
    image: timescale/timescaledb:latest-pg15
    volumes: ["postgres_data:/var/lib/postgresql/data"]
    environment:
      - POSTGRES_USER=nisha
      - POSTGRES_PASSWORD=${DB_PASS}

  redis:
    image: redis:7-alpine
    volumes: ["redis_data:/data"]
    command: redis-server --appendonly yes

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio_data:/data"]
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=nisha
      - MINIO_ROOT_PASSWORD=${MINIO_PASS}

  # Monitoring
  prometheus:
    image: prom/prometheus
    volumes: ["./prometheus.yml:/etc/prometheus/prometheus.yml"]

  grafana:
    image: grafana/grafana
    ports: ["3001:3000"]
    volumes: ["grafana_data:/var/lib/grafana"]

volumes:
  postgres_data:
  redis_data:
  minio_data:
  grafana_data:
```

### 7.2 Scaling Strategy

| Scale | Agents | Infrastructure | Changes |
|-------|--------|----------------|---------|
| **Pilot** | 10-50 | Single VPS (4CPU/8GB) | Docker Compose |
| **Community** | 50-200 | Dedicated server (8CPU/32GB) | Add read replica |
| **District** | 200-500 | 2-3 servers + load balancer | Kubernetes, sharding |
| **City** | 500+ | Cloud (K8s, managed DB) | Regional masters, CDN |

---

## 8. Development Integration

### 8.1 Repository Structure

```
nisha-platform/
├── README.md
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── backend/                    # FastAPI monorepo
│   ├── app/
│   │   ├── main.py
│   │   ├── core/              # Config, logging, security
│   │   ├── api/               # Route handlers
│   │   │   ├── v1/
│   │   │   │   ├── agents.py
│   │   │   │   ├── audio.py
│   │   │   │   ├── localization.py
│   │   │   │   └── alerts.py
│   │   │   └── internal/      # Service-to-service
│   │   ├── services/          # Business logic
│   │   │   ├── agent_manager.py
│   │   │   ├── audio_processor.py
│   │   │   ├── localization_engine.py
│   │   │   └── alert_service.py
│   │   ├── models/            # SQLAlchemy models
│   │   └── infrastructure/    # DB, Redis, MinIO clients
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # Next.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Landing page
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx       # Overview
│   │   │   ├── agents/
│   │   │   ├── alerts/
│   │   │   └── map/
│   │   └── api/               # Next.js API routes
│   ├── components/
│   │   ├── ui/                # Radix UI components
│   │   ├── three/             # 3D visuals
│   │   └── dashboard/         # Dashboard widgets
│   ├── lib/
│   │   ├── api.ts             # API client
│   │   └── websocket.ts       # Real-time connection
│   └── public/
│       ├── logo.svg
│       └── models/            # 3D assets
│
├── mobile/                     # React Native
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── services/
│   │   │   ├── audio.ts
│   │   │   ├── location.ts
│   │   │   └── api.ts
│   │   └── store/
│   ├── android/
│   ├── ios/
│   └── package.json
│
├── firmware/                   # ESP32
│   ├── agent/
│   │   ├── src/
│   │   │   ├── main.cpp
│   │   │   ├── audio/
│   │   │   ├── network/
│   │   │   └── sensors/
│   │   └── platformio.ini
│   └── master/
│       └── (Raspberry Pi software)
│
└── docs/
    ├── architecture/
    ├── api/
    └── deployment/
```

### 8.2 CI/CD Pipeline

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  PUSH   │────►│  TEST   │────►│  BUILD  │────►│ DEPLOY  │
│  TO     │     │         │     │         │     │         │
│  MAIN   │     │ • Unit  │     │ • Docker│     │ • Staging │
└─────────┘     │ • Int   │     │ • Push  │     │ • Prod   │
                │ • E2E   │     │  to reg │     │ (manual) │
                └─────────┘     └─────────┘     └─────────┘
```

---

## 9. Testing Integration

### 9.1 Test Pyramid

```
                    ┌─────────┐
                    │   E2E   │  5%  (Cypress, Detox)
                    │  Tests  │      Full user flows
                    └────┬────┘
                   ┌─────┴─────┐
                   │ Integration│ 15%  (API tests)
                   │   Tests    │      Service boundaries
                   └─────┬─────┘
              ┌──────────┴──────────┐
              │       Unit          │ 80%  (pytest, Jest)
              │      Tests          │      Functions, components
              └─────────────────────┘
```

### 9.2 Integration Test Scenarios

| Scenario | Components | Validation |
|----------|-----------|------------|
| **Agent registration** | Agent → Master → Server → DB | Record created, ACK received |
| **Audio detection flow** | Audio → Localization → Alert → Telegram | Position calculated, notification sent |
| **Master handoff** | Agent → Old Master → New Master → Server | Seamless transfer, no data loss |
| **Config update** | Dashboard → API → Master → Agent → ACK | Config applied, version updated |
| **Offline recovery** | Agent offline → buffer → online → sync | Data replayed, state consistent |

---

## 10. Monitoring & Observability

### 10.1 Metrics

| Category | Metric | Threshold | Alert |
|----------|--------|-----------|-------|
| **System** | CPU usage | > 80% for 5m | PagerDuty |
| | Memory usage | > 90% | Slack |
| | Disk space | > 85% | Email |
| **Application** | API latency (p95) | > 500ms | Slack |
| | Error rate | > 1% | PagerDuty |
| | WebSocket connections | Drop > 10% | Slack |
| **Business** | Agents offline | > 5% | PagerDuty |
| | Missed detections | Any | PagerDuty |
| | Alert latency | > 5s | Slack |

### 10.2 Logging

```
Structured JSON logs:
{
  "timestamp": "2026-04-20T13:31:00Z",
  "level": "INFO",
  "service": "agent-manager",
  "trace_id": "abc-123",
  "event": "agent.heartbeat_received",
  "agent_id": "A-001",
  "latency_ms": 45,
  "metadata": {...}
}

Correlation: trace_id spans request across services
Retention: 7 days hot, 30 days warm, 1 year cold (S3)
```

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Months 1-2)
- [ ] Repository setup, CI/CD
- [ ] Agent Management (registration, heartbeat)
- [ ] Basic Dashboard (agent list, map)
- [ ] Master node software (Pi)

### Phase 2: Intelligence (Months 3-4)
- [ ] Audio Processing (capture, VAD, detection)
- [ ] Alert system (Telegram integration)
- [ ] Mobile app (basic agent functionality)
- [ ] Landing page (3D visuals, download)

### Phase 3: Localization (Months 5-6)
- [ ] Zone-based positioning
- [ ] Proximity ranking
- [ ] RSSI trilateration
- [ ] Dashboard heatmaps

### Phase 4: Scale & Polish (Months 7-8)
- [ ] Mobile master mode
- [ ] Multi-sensor fusion
- [ ] Performance optimization
- [ ] Documentation, training

---

## 12. Appendices

### Appendix A: Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 14 | Web UI, landing |
| **Mobile** | React Native | 0.73 | iOS/Android app |
| **Backend** | FastAPI | 0.110 | API services |
| **Database** | PostgreSQL + TimescaleDB | 15 | Primary store |
| **Cache** | Redis | 7 | Sessions, real-time |
| **Storage** | MinIO | Latest | Object storage |
| **Queue** | Redis Streams | 7 | Event streaming |
| **Monitoring** | Prometheus + Grafana | Latest | Observability |
| **ESP32** | Arduino/PlatformIO | ESP-IDF 5 | Firmware |
| **Master** | Python + asyncio | 3.11 | Pi software |

### Appendix B: Network Ports

| Port | Service | Protocol | Access |
|------|---------|----------|--------|
| 80/443 | Web (Nginx) | HTTP/HTTPS | Public |
| 8000 | FastAPI | HTTP | Internal/VPN |
| 3000 | Next.js dev | HTTP | Development |
| 6379 | Redis | TCP | Internal |
| 5432 | PostgreSQL | TCP | Internal |
| 9000/9001 | MinIO | HTTP | Internal |
| 1883 | MQTT | TCP | Agents (optional) |
| 9090/3001 | Prometheus/Grafana | HTTP | Internal |

---

**Document Status:** Architecture Complete

**Next Steps:**
1. Technical review with team
2. Sprint planning for Phase 1
3. Development environment setup
4. Begin Agent Management implementation

---
