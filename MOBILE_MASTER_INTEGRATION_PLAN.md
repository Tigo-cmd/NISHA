# NISHA Mobile → Master → Backend Integration Plan

## System Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Mobile Agent   │         │  Master Node     │         │  Backend Server  │         │  Frontend App   │
│  (Expo/RN)      │         │  (FastAPI)       │         │  (FastAPI)       │         │  (Next.js)      │
│                 │         │                  │         │                  │         │                 │
│ • Video Stream  │────────▶│ • Aggregates     │────────▶│ • Processes      │────────▶│ • Dashboard     │
│ • Audio Events  │ WebSocket│ • Buffers        │ WebSocket│ • AI Analysis    │ WebSocket│ • Live View     │
│ • Location Data │         │ • Routes Data    │         │ • Database Store │         │ • Alerts        │
│                 │         │                  │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └──────────────────┘         └─────────────────┘
        ▲                            ▲                           ▲                             ▲
        │                            │                           │                             │
        │      Hardware Agents       │                           │                             │
        │   (ESP32/Audio Nodes)      │                           │                             │
        │                            │                           │                             │
   ┌────┴─────────────────┐         │                           │                             │
   │                      │         │                           │                             │
   ├─ ESP32 Camera        │         │                           │                             │
   ├─ Audio Sensor        │         │                           │                             │
   └─ Location Tracker    │         │                           │                             │
```

---

## Current Implementation Status

### ✅ IMPLEMENTED

#### Backend (Backend/)
- ✅ FastAPI server with WebSocket support
- ✅ Video ingest endpoint (`/video/ingest`)
- ✅ Audio ingest endpoint (`/audio/ingest`)
- ✅ Mobile registration endpoint
- ✅ Master management endpoints
- ✅ Redis caching layer
- ✅ AI processor for analysis
- ✅ Event bus for domain events
- ✅ Async database writer

#### Master Node (masters/)
- ✅ Agent WebSocket server (port 8081)
- ✅ Backend WebSocket client (persistent connection)
- ✅ Hardware ingestion worker
- ✅ Local dashboard
- ✅ Telemetry queue system
- ✅ Stream queue system
- ✅ Buffer manager for offline data

#### Mobile (Nisha-mobile-agent/)
- ✅ App structure
- ✅ State management (Zustand)
- ✅ Camera system
- ✅ Component library
- ⚠️ Video streaming (needs fixes)
- ⚠️ Audio detection (needs implementation)
- ⚠️ Location tracking (partial)

### ❌ NOT WORKING / MISSING

#### Mobile ↔ Master Connection
- ❌ WebSocket connection between mobile and master
- ❌ Mobile agent discovery/registration with master
- ❌ Handshake protocol incomplete

#### Data Schema Alignment
- ⚠️ Video packet format mismatch
- ⚠️ Audio packet format mismatch
- ⚠️ Location data schema undefined

#### Hardware Agent Integration
- ⚠️ ESP32 Camera integration incomplete
- ⚠️ Audio Node integration incomplete
- ⚠️ Hardware worker routing unclear

#### Frontend Connection
- ⚠️ WebSocket connection between backend and frontend
- ⚠️ Real-time data push not working
- ⚠️ Dashboard data feed incomplete

---

## Data Flow Analysis

### Video Stream Flow
```
Mobile Camera                Master Node           Backend             Frontend
     │                           │                    │                   │
     ├─ Capture Frame ──────────▶│                    │                   │
     │                           ├─ Buffer ──────────▶│                   │
     │                           │                    ├─ Process ────────▶│
     │                           │                    │   (AI)            │
     │                           │                    ├─ Store ─┐         │
     │                           │                    │         │         │
     │                           │                    │    WebSocket ────▶│
     │                           │                    │    (Push) Push    │
```

### Audio Detection Flow
```
Mobile Microphone           Master Node           Backend             Frontend
     │                           │                    │                   │
     ├─ Detect Audio ───────────▶│                    │                   │
     │                           ├─ Classify ────────▶│                   │
     │                           │                    ├─ Store ───────────│
     │                           │                    │                   │
     │                           │                    ├─ Alert ──────────▶│
```

### Location Tracking Flow
```
Mobile GPS                  Master Node           Backend             Frontend
     │                           │                    │                   │
     ├─ Get Location ───────────▶│                    │                   │
     │                           ├─ Aggregate ───────▶│                   │
     │                           │                    ├─ Store           │
     │                           │                    │                   │
     │                           │                    ├─ Triangulate ────▶│
```

---

## Integration Checklist

### Phase 1: Connection & Handshake (3-4 days)

#### 1.1 Mobile → Master Connection
- [ ] Update `Nisha-mobile-agent/frontend/src/api/client.ts`
  - Add master discovery endpoint
  - Implement master WebSocket connection
  - Add handshake protocol

- [ ] Create Master registration in backend
  - `Backend/src/nisha/api/v1/masters.py` - Add mobile registration
  - `Backend/src/nisha/domain/models/` - Add mobile agent model

- [ ] Update Master agent server
  - `masters/src/nisha_master/interfaces/agent_ws.py`
  - Support mobile agent handshake
  - Route mobile streams properly

**Validation**:
- [ ] Mobile connects to master on startup
- [ ] Handshake successful with agent_id
- [ ] Master acknowledges registration

#### 1.2 Master → Backend Connection
- [ ] Verify existing WebSocket connection is working
- [ ] Test authentication with token
- [ ] Confirm heartbeat mechanism

**Validation**:
- [ ] Master connects to backend at startup
- [ ] Stays connected (no drops)
- [ ] Heartbeat every 5 seconds

#### 1.3 Backend → Frontend Connection
- [ ] Create WebSocket endpoint in backend
  - `Backend/src/nisha/api/v1/ws.py` - Add frontend connection handler
  - Support real-time event push
  - Implement authenticated WebSocket

- [ ] Update Frontend to connect
  - `Frontend/src/services/` - Add WebSocket client
  - Subscribe to events
  - Display real-time data

**Validation**:
- [ ] Frontend connects successfully
- [ ] Receives real-time event updates
- [ ] Dashboard displays live data

---

### Phase 2: Data Schema Alignment (4-5 days)

#### 2.1 Video Packet Schema
- [ ] Define unified video packet format
  ```python
  {
    agent_id: str,
    timestamp: ISO string,
    priority: int (1-3),
    frame_index: int,
    detection: {
      behavior: str,
      confidence: float,
      timestamp: ISO string
    },
    metadata: {
      rssi: int,
      battery: float,
      zone: str
    }
  }
  ```

- [ ] Update Mobile StreamManager
  - Encode frames in correct format
  - Send video packets to master

- [ ] Update Master agent_ws.py
  - Parse video packets
  - Route to stream_queue
  - Forward to backend

- [ ] Update Backend video.py
  - Process incoming video
  - Run AI analysis
  - Store in database

**Files to update**:
- `Nisha-mobile-agent/frontend/src/services/StreamManager.ts`
- `masters/src/nisha_master/interfaces/agent_ws.py`
- `Backend/src/nisha/api/v1/video.py`
- `Backend/src/nisha/domain/schemas/video.py`

#### 2.2 Audio Packet Schema
- [ ] Define unified audio packet format
  ```python
  {
    agent_id: str,
    timestamp: ISO string,
    priority: int (1-3),
    detection: {
      type: str (gunshot, scream, etc),
      confidence: float,
      timestamp: ISO string
    },
    audio_data: base64,
    audio_format: str (WAV, MP3),
    sample_rate: int,
    duration_ms: int,
    metadata: {
      rssi: int,
      battery: float,
      zone: str
    }
  }
  ```

- [ ] Update Mobile AudioManager
  - Capture audio samples
  - Detect events
  - Send audio packets to master

- [ ] Update Master hardware_worker.py
  - Handle audio from ESP32 audio nodes
  - Route to stream_queue

- [ ] Update Backend audio.py
  - Process incoming audio
  - Run transcription/classification
  - Store in database

**Files to update**:
- `Nisha-mobile-agent/frontend/src/services/AudioManager.ts`
- `masters/src/nisha_master/core/hardware_worker.py`
- `Backend/src/nisha/api/v1/audio.py`
- `Backend/src/nisha/domain/schemas/audio.py`

#### 2.3 Location Packet Schema
- [ ] Define unified location packet format
  ```python
  {
    agent_id: str,
    timestamp: ISO string,
    latitude: float,
    longitude: float,
    accuracy: float (meters),
    altitude: float,
    speed: float (m/s),
    heading: float (degrees),
    zone: str,
    metadata: {}
  }
  ```

- [ ] Update Mobile LocationManager
  - Capture GPS coordinates
  - Send location updates to master

- [ ] Create Backend location.py
  - Ingest location data
  - Triangulation calculations
  - Store in database

**Files to create/update**:
- `Nisha-mobile-agent/frontend/src/services/LocationManager.ts`
- `Backend/src/nisha/api/v1/location.py` (NEW)

#### 2.4 Detection/Alert Schema
- [ ] Define detection event schema
  ```python
  {
    event_id: str,
    agent_id: str,
    event_type: str (video/audio/location),
    timestamp: ISO string,
    priority: int (1-3),
    data: {
      // specific to type
    },
    zone: str,
    confirmed: bool,
    alert_sent: bool
  }
  ```

**Files to update**:
- `Backend/src/nisha/domain/models/events.py`
- All API endpoints

---

### Phase 3: Hardware Agent Integration (4-5 days)

#### 3.1 ESP32 Camera Integration
- [ ] Update Master hardware_worker.py
  - Support video streams from ESP32 camera
  - Parse embedded telemetry
  - Route to stream_queue with source metadata

- [ ] Update Backend video.py
  - Accept hardware agent video
  - Handle lower-quality streams
  - Apply different AI models if needed

**Files**:
- `masters/src/nisha_master/core/hardware_worker.py`
- `agents/esp32_cam/` - Verify firmware sends correct format

#### 3.2 Audio Node Integration
- [ ] Update Master hardware_worker.py
  - Support audio streams from audio nodes
  - Parse embedded telemetry
  - Route to stream_queue with source metadata

- [ ] Update Backend audio.py
  - Accept hardware agent audio
  - Handle different sample rates
  - Apply audio classification

**Files**:
- `masters/src/nisha_master/core/hardware_worker.py`
- `agents/audio_node/` - Verify firmware sends correct format

#### 3.3 Hardware Agent Discovery
- [ ] Create hardware agent registration
  - Master scans for hardware agents
  - Registers in database
  - Creates agent records

- [ ] Add hardware agent monitoring
  - Track heartbeat/connectivity
  - Monitor battery/resources
  - Alert on failures

**Files to create**:
- `Backend/src/nisha/api/v1/hardware.py` (NEW)

---

### Phase 4: Error Handling & Reliability (3-4 days)

#### 4.1 Connection Resilience
- [ ] Implement retry logic
  - Mobile → Master reconnect on failure
  - Master → Backend reconnect (already done)
  - Frontend → Backend reconnect

- [ ] Add connection status monitoring
  - Track connection state changes
  - Alert on disconnects
  - Log connection events

- [ ] Implement offline queue
  - Mobile caches data when offline
  - Master buffers on connection loss (already done)
  - Sync when connection restored

#### 4.2 Data Validation
- [ ] Add schema validation at each layer
  - Mobile validates before sending
  - Master validates incoming data
  - Backend validates before processing

- [ ] Add error handling
  - Graceful handling of malformed packets
  - Logging of validation errors
  - Dead letter queue for failures

#### 4.3 Monitoring & Observability
- [ ] Add logging
  - Connection events
  - Data throughput
  - Processing latency
  - Errors and failures

- [ ] Add metrics
  - Agents connected
  - Data flow rates
  - Queue sizes
  - Processing times

- [ ] Add alerts
  - Connection failures
  - Unusual data patterns
  - Processing errors
  - Queue overflow

**Files**:
- `Backend/src/nisha/infrastructure/observability/` (NEW)

---

### Phase 5: Frontend Dashboard Integration (3-4 days)

#### 5.1 Real-time Data Display
- [ ] Connect Frontend to Backend WebSocket
  - Receive real-time events
  - Update dashboard state
  - Render live data

#### 5.2 Map Visualization
- [ ] Display agent locations
  - Map integration
  - Real-time position updates
  - Zone display

#### 5.3 Media Playback
- [ ] Display video streams
  - HLS or WebRTC streaming
  - Timeline scrubbing
  - Quality selection

- [ ] Display audio events
  - Timeline view
  - Playback capability
  - Transcript display

#### 5.4 Alert Management
- [ ] Real-time alerts
  - Visual notifications
  - Sound alerts (configurable)
  - Alert history

---

## File Structure Changes

### New Files to Create
```
Backend/
├── src/nisha/api/v1/
│   ├── location.py                    # Location data endpoints
│   ├── hardware.py                    # Hardware agent endpoints
│   └── schemas/
│       ├── location.py               # Location schemas
│       └── hardware.py               # Hardware schemas
├── src/nisha/domain/
│   └── models/
│       ├── location.py               # Location models
│       └── hardware_agent.py          # Hardware agent models
└── src/nisha/infrastructure/
    └── observability/
        ├── logging.py                # Centralized logging
        ├── metrics.py                # Metrics collection
        └── alerts.py                 # Alert system

masters/
└── src/nisha_master/
    ├── handlers/
    │   ├── mobile_handler.py         # Mobile packet handler
    │   ├── video_handler.py          # Video packet handler
    │   ├── audio_handler.py          # Audio packet handler
    │   └── location_handler.py       # Location packet handler
    └── validators/
        ├── packet_validator.py       # Schema validation

Nisha-mobile-agent/frontend/
└── src/
    ├── api/
    │   ├── master_client.ts          # Master connection client
    │   └── schemas/
    │       ├── packets.ts            # Packet type definitions
    │       └── events.ts             # Event type definitions
    └── utils/
        └── protocol.ts               # Protocol helpers

Frontend/
├── src/
│   ├── services/
│   │   ├── backend_socket.ts         # Backend WebSocket client
│   │   ├── live_stream.ts            # Video streaming service
│   │   └── location_tracker.ts       # Location tracking service
│   ├── components/
│   │   ├── LiveMap.tsx               # Real-time map
│   │   ├── VideoPlayer.tsx           # Video playback
│   │   ├── AudioTimeline.tsx         # Audio events timeline
│   │   └── AlertPanel.tsx            # Alerts display
│   └── hooks/
│       ├── useRealtimeData.ts        # Real-time data hook
│       └── useAgentLocations.ts      # Agent locations hook
```

### Files to Modify
```
Key Updates Required:
1. Nisha-mobile-agent/frontend/src/services/StreamManager.ts
   - Fix WebSocket connection to master
   - Implement frame encoding
   - Add error handling

2. masters/src/nisha_master/interfaces/agent_ws.py
   - Add mobile agent handling
   - Route different packet types
   - Add validation

3. masters/src/nisha_master/core/hardware_worker.py
   - Extend for multiple hardware types
   - Add packet routing

4. Backend/src/nisha/api/v1/video.py
   - Add hardware video support
   - Implement adaptive processing

5. Backend/src/nisha/api/v1/audio.py
   - Add hardware audio support
   - Implement enhanced processing

6. Frontend/src/services/ (new WebSocket client)
   - Real-time data subscription
   - Event broadcasting
```

---

## Integration Testing Checklist

### Unit Tests (per component)
- [ ] Mobile packet encoding/decoding
- [ ] Master packet routing
- [ ] Backend packet processing
- [ ] Frontend data display

### Integration Tests (end-to-end)
- [ ] Mobile → Master → Backend → Frontend (video)
- [ ] Mobile → Master → Backend → Frontend (audio)
- [ ] Mobile → Master → Backend → Frontend (location)
- [ ] Hardware agent → Master → Backend → Frontend

### Performance Tests
- [ ] Latency measurement (mobile to frontend)
- [ ] Throughput measurement (multiple agents)
- [ ] Buffer management under load
- [ ] Database write performance

### Reliability Tests
- [ ] Network disconnection scenarios
- [ ] Agent failure handling
- [ ] Backend service restart
- [ ] Frontend reconnection

### Load Tests
- [ ] 5 simultaneous agents
- [ ] 10 simultaneous agents
- [ ] 20 simultaneous agents
- [ ] Stress test with video + audio + location

---

## Communication Protocols

### Mobile ↔ Master (WebSocket)

**Handshake**:
```json
{
  "type": "HANDSHAKE",
  "agent_id": "MOBILE-ABC123",
  "mode": "AGENT",
  "device_info": {
    "model": "iPhone 14",
    "osVersion": "17.0",
    "appVersion": "2.4.1"
  }
}
```

**Heartbeat**:
```json
{
  "type": "HEARTBEAT",
  "agent_id": "MOBILE-ABC123",
  "timestamp": "2026-05-05T12:00:00Z",
  "battery": 85.5,
  "rssi": -65
}
```

### Master ↔ Backend (WebSocket)

**Connection**:
```
ws://backend:8000/ws?token=TOKEN-MASTER-ID
```

**Data Packet**:
```json
{
  "type": "STREAM_PACKET",
  "master_id": "MASTER-001",
  "packets": [
    {
      "agent_id": "MOBILE-ABC123",
      "packet_type": "VIDEO",
      "data": "base64_encoded_frame",
      "metadata": {...}
    }
  ]
}
```

### Backend → Frontend (WebSocket)

**Event Stream**:
```json
{
  "type": "EVENT",
  "event_id": "EVENT-123",
  "agent_id": "MOBILE-ABC123",
  "event_type": "VIDEO_DETECTION",
  "data": {
    "behavior": "person_detected",
    "confidence": 0.95,
    "zone": "zone_1"
  }
}
```

---

## Configuration Requirements

### Environment Variables

**Mobile**:
```bash
EXPO_PUBLIC_BACKEND_URL=http://master:8081
EXPO_PUBLIC_MASTER_URL=http://master:8081
```

**Master**:
```bash
AGENT_WS_PORT=8081
BACKEND_WS_URL=wss://backend:8000/ws
BACKEND_AUTH_TOKEN=SECRET_TOKEN
```

**Backend**:
```bash
FRONTEND_WS_URL=ws://frontend:3000/ws
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

**Frontend**:
```bash
REACT_APP_BACKEND_WS_URL=wss://backend:8000/ws
REACT_APP_API_BASE_URL=http://backend:8000/api
```

---

## Success Metrics

### Functional Requirements
- ✅ All connections established automatically
- ✅ Video data flows end-to-end without loss
- ✅ Audio events detected and transmitted
- ✅ Location data aggregated and displayed
- ✅ Hardware agents integrated seamlessly
- ✅ Frontend displays real-time data

### Performance Requirements
- ⏱️ Mobile → Frontend latency: < 1 second
- 📊 Packet loss: < 0.1%
- 🔋 Mobile battery drain: < 10%/hour
- 💾 Backend throughput: > 100 packets/sec
- 📈 Dashboard refresh rate: > 30 FPS

### Reliability Requirements
- 🔄 Connection resilience: 99% uptime
- 🛡️ Data integrity: 100%
- 🚨 Alert delivery: 99.9%
- 🔐 No unauthorized access

---

## Timeline & Dependencies

```
Week 1 (Phase 1: Connections)
├─ Mon: Connection infrastructure
├─ Tue: Mobile-Master handshake
├─ Wed: Master-Backend verification
├─ Thu: Backend-Frontend WebSocket
└─ Fri: Integration testing

Week 2 (Phase 2: Data Alignment)
├─ Mon-Tue: Video schema + implementation
├─ Wed: Audio schema + implementation  
├─ Thu: Location schema + implementation
└─ Fri: End-to-end testing

Week 3 (Phase 3: Hardware Integration)
├─ Mon-Tue: ESP32 Camera integration
├─ Wed: Audio Node integration
├─ Thu: Discovery & monitoring
└─ Fri: Testing

Week 4 (Phase 4-5: Polish & Dashboard)
├─ Mon-Tue: Error handling & resilience
├─ Wed-Thu: Frontend integration
└─ Fri: Final testing & deployment
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Connection drops | Implement auto-reconnect with exponential backoff |
| Data loss | Use persistent queues with offline caching |
| Packet corruption | Add checksums and validation at each layer |
| Performance degradation | Implement rate limiting and adaptive compression |
| Hardware incompatibility | Create adapter layer for different hardware types |
| Frontend lag | Implement virtual scrolling and data pagination |
| Database bottleneck | Add read replicas and optimize queries |
| Security vulnerabilities | Implement token auth and message encryption |

---

## Documentation to Create

1. **Protocol Specification** - Define NISHA packet format
2. **API Reference** - Complete endpoint documentation
3. **Deployment Guide** - How to deploy integrated system
4. **Troubleshooting Guide** - Common issues and solutions
5. **Architecture Diagrams** - Visual system overview

---

## Next Steps

1. **Immediately**:
   - [ ] Review this plan
   - [ ] Identify blockers
   - [ ] Start Phase 1

2. **This Week**:
   - [ ] Implement mobile-master connection
   - [ ] Test handshake protocol
   - [ ] Verify backend connection stability

3. **Next Week**:
   - [ ] Define packet schemas
   - [ ] Implement data encoding
   - [ ] Start Phase 2 implementation

