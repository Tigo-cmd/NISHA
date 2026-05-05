# NISHA System Integration - Visual Architecture

## System Topology

```
╔═══════════════════════════════════════════════════════════════════════════════════════════╗
║                           NISHA GUARDIAN NETWORK - SYSTEM TOPOLOGY                       ║
╚═══════════════════════════════════════════════════════════════════════════════════════════╝

                                      FRONTEND LAYER
                                    (Next.js Dashboard)
                                           │
                                           │ WebSocket
                                           │ Real-time Updates
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                ┌───▼────┐          ┌──────▼──────┐          ┌───▼────┐
                │  Live  │          │  Video      │          │ Audio  │
                │  Map   │          │  Player     │          │Timeline│
                └────────┘          └─────────────┘          └────────┘
                    │                      │                      │
                    └──────────────────────┬──────────────────────┘
                                           │
                         ┌─────────────────┴─────────────────┐
                         │                                   │
                    ┌────▼────────────────────────────────────▼───┐
                    │        BACKEND SERVER (FastAPI)              │
                    │         Port: 8000 / 443                     │
                    ├─────────────────────────────────────────────┤
                    │ • WebSocket /api/v1/ws (to Frontend)         │
                    │ • Video /api/v1/video/ingest                │
                    │ • Audio /api/v1/audio/ingest                │
                    │ • Location /api/v1/location/ingest          │
                    │ • Agents /api/v1/agents                     │
                    │ • Masters /api/v1/masters                   │
                    │ • Mobile /api/v1/mobile                     │
                    │                                              │
                    │ Processing:                                  │
                    │ • AI Video Analysis (YOLO, behavior)         │
                    │ • Audio Classification (gunshot, scream)     │
                    │ • Location Triangulation                     │
                    │ • Event Correlation                          │
                    │ • Alert Generation                           │
                    │                                              │
                    │ Storage:                                     │
                    │ • PostgreSQL (events, agents)                │
                    │ • Redis (cache, queues)                      │
                    │ • S3/Blob (video/audio clips)               │
                    └────────────────────┬───────────────────────┘
                                         │
                                         │ WebSocket
                                         │ Master ↔ Backend
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
   ┌────▼──────────────┐         ┌───────▼──────────┐            ┌──────▼──────┐
   │   MASTER NODE #1  │         │  MASTER NODE #2  │      ...   │  MASTER N   │
   │   (FastAPI)       │         │   (FastAPI)      │            │  (FastAPI)  │
   │  Port: 8081       │         │  Port: 8081      │            │Port: 8081   │
   ├───────────────────┤         ├──────────────────┤            ├─────────────┤
   │ • Agent WS Server │         │ Agent WS Server  │            │ Agent WS... │
   │ • Backend Client  │         │ Backend Client   │            │ Backend ... │
   │ • Hardware Worker │         │ Hardware Worker  │            │ Hardware... │
   │ • Triangulation   │         │ Triangulation    │            │ Triangu...  │
   │ • Local Dashboard │         │ Local Dashboard  │            │ Local...    │
   │                   │         │                  │            │             │
   │ Queues:           │         │ Queues:          │            │ Queues:     │
   │ • stream_queue    │         │ • stream_queue   │            │ • s. queue  │
   │ • telemetry_queue │         │ • telemetry_q.   │            │ • t. queue  │
   │                   │         │                  │            │             │
   │ Connections:      │         │ Connections:     │            │ Connections │
   │ • 10-50 agents    │         │ • 10-50 agents   │            │ • 10-50 ... │
   │ • 5-10 hardware   │         │ • 5-10 hardware  │            │ • 5-10 ...  │
   └────┬──────┬───────┘         └────┬──────┬──────┘            └────┬───┬───┘
        │      │                      │      │                        │   │
        │      └──────────┬───────────┘      │                        │   │
        │                 │                  │                        │   │
        │    ┌────────────┼──────────────────┼────────────────────────┤   │
        │    │            │                  │                        │   │
        │    │  ┌─────────▼────────┐  ┌─────▼─────────┐  ┌──────────┼──┐│
        │    │  │  MOBILE AGENT #1 │  │ MOBILE AGENT 2│  │ MOBILE N │  ││
        │    │  │   (Expo / RN)    │  │ (Expo / RN)   │  │(Expo/RN) │  ││
        │    │  │   Port: Dynamic  │  │ Port: Dynamic │  │Port: Dyn │  ││
        │    │  ├──────────────────┤  ├───────────────┤  ├──────────┤  ││
        │    │  │ • Camera Stream  │  │ • Camera...   │  │• Camera..│  ││
        │    │  │ • Audio Detect   │  │ • Audio...    │  │• Audio...│  ││
        │    │  │ • Location Track │  │ • Location... │  │• Location│  ││
        │    │  │ • Sensors Status │  │ • Sensors...  │  │• Sensors.│  ││
        │    │  └──────────────────┘  └───────────────┘  └──────────┤  ││
        │    │                                                       └──┘│
        │    └─────────────────────────────────────────────────────────┘
        │
        └────────────────┬────────────────┐
                         │                │
            ┌────────────▼────┐  ┌────────▼──────────┐
            │  HARDWARE NODES │  │  HARDWARE NODES   │
            │ (Mesh Network)  │  │  (Mesh Network)   │
            ├─────────────────┤  ├───────────────────┤
            │ ESP32 Camera    │  │ Audio Sensors     │
            │ ESP32 Audio     │  │ Other Sensors     │
            │ GPS/Tracker     │  │ Thermal Imaging   │
            └─────────────────┘  └───────────────────┘
```

---

## Data Flow Diagrams

### Video Stream Data Flow

```
MOBILE CAMERA              MASTER NODE            BACKEND SERVER            FRONTEND
─────────────              ───────────            ──────────────            ────────
    │                          │                        │                      │
    ├─ Capture Frame ──────────▶│                        │                      │
    │  (320x240, RGB)           │                        │                      │
    │                           │                        │                      │
    │                           ├─ Buffer ──────────────▶│                      │
    │                           │ (on queue)             │                      │
    │                           │                        │                      │
    │                           │                        ├─ AI Process ────────▶│
    │                           │                        │ (YOLO, Behavior)     │
    │                           │                        │                      │
    │                           │                        ├─ Store ─────────┐    │
    │                           │                        │ (Database)      │    │
    │                           │                        │                 │    │
    │                           │                        │ WebSocket Push ─┼───▶│
    │                           │                        │ Real-time Event │    │
    │                           │                        │                 │    │
    │◀──── ACK ─────────────────◀────────────────────────◀─────────────────┘    │
    │  (Buffered)                (Optional)
```

**Latency Budget**:
- Mobile capture: 33ms (30fps)
- Mobile → Master: 50ms (WiFi)
- Master buffer: 100ms
- Master → Backend: 50ms (network)
- Backend process: 100ms (AI)
- Backend → Frontend: 50ms (WebSocket)
- Frontend render: 16ms (60fps)
- **Total**: ~400ms (< 500ms target ✅)

---

### Audio Detection Flow

```
MOBILE MICROPHONE         MASTER NODE           BACKEND SERVER           FRONTEND
─────────────────         ───────────           ──────────────           ────────
     │                        │                       │                    │
     ├─ Capture Audio ────────▶│                       │                    │
     │ (16kHz, mono)          │                       │                    │
     │                        │                       │                    │
     ├─ Detect Event ────────▶│                       │                    │
     │ (if amplitude > threshold)                    │                    │
     │                        │                       │                    │
     │                        ├─ Send to Backend ────▶│                    │
     │                        │ (WebSocket)           │                    │
     │                        │                       │                    │
     │                        │                       ├─ Classify ────────▶│
     │                        │                       │ (Gunshot/Scream)   │
     │                        │                       │                    │
     │                        │                       ├─ Store ────┐       │
     │                        │                       │            │       │
     │                        │                       │ WebSocket ─┼──────▶│
     │                        │                       │ Push Alert  │       │
     │◀──── ACK ─────────────────────────────────────◀────────────┘       │
     │  (Success)                                                         │
```

**Event Types**:
- Gunshot: High frequency, sharp peaks
- Scream: High pitch, sustained
- Loud noise: Generic alert
- Speech: Conversational level

---

### Location Tracking Flow

```
MOBILE GPS                MASTER NODE           BACKEND SERVER           FRONTEND
──────────                ───────────           ──────────────           ────────
   │                          │                       │                    │
   ├─ Get Location ───────────▶│                       │                    │
   │ (lat, long, accuracy)     │                       │                    │
   │                           │                       │                    │
   │                           ├─ Store in Cache ────▶│                    │
   │                           │ (Redis)               │                    │
   │                           │                       │                    │
   │                           │ WebSocket Send ──────▶│                    │
   │                           │ (Broadcast)           │                    │
   │                           │                       │                    │
   │                           │                       ├─ Triangulate ────▶│
   │                           │                       │ (Multi-agent)      │
   │                           │                       │                    │
   │                           │                       ├─ Determine Zone   │
   │                           │                       │ (Geofencing)       │
   │                           │                       │                    │
   │                           │                       ├─ Store ─────┐     │
   │                           │                       │             │     │
   │                           │                       │ Push Event ─┼────▶│
   │                           │                       │ (Location)  │     │
   │◀──── ACK ─────────────────◀─────────────────────◀─────────────┘     │
```

**Update Frequency**:
- Background: Every 30 seconds
- Foreground: Every 5 seconds
- Critical: Real-time (< 1 second)

---

### Hardware Agent Integration

```
ESP32 CAMERA         MASTER NODE           BACKEND SERVER           FRONTEND
────────────         ───────────           ──────────────           ────────
    │                    │                       │                    │
    ├─ Stream Video ────▶│                       │                    │
    │ (MJPEG/H.264)      │                       │                    │
    │                    │                       │                    │
    │ Telemetry ────────▶│                       │                    │
    │ (RSSI, Battery)    │                       │                    │
    │                    ├─ Classify Type ──────▶│                    │
    │                    │ (Hardware source)     │                    │
    │                    │                       │                    │
    │                    │ WebSocket Send ───────▶│                    │
    │                    │ (with metadata)       │                    │
    │                    │                       │                    │
    │                    │                       ├─ Process ────────▶│
    │                    │                       │ (AI model)        │
    │                    │                       │                   │
    │                    │                       ├─ Display ────────▶│
    │                    │                       │ (Mark as HW)      │
    │◀──── ACK ─────────────────────────────────◀──────────────────│
```

**Hardware Types**:
- ESP32 Camera: Up to 30fps, embedded AI
- Audio Nodes: 16kHz continuous, detection on device
- GPS Trackers: 1Hz update rate
- Thermal: Lower frame rate, processed differently

---

## System State Machine

```
┌─────────────────────────────────────┐
│      MOBILE APP LIFECYCLE           │
└─────────────────────────────────────┘

  START
    │
    ├─ Read stored config
    │
    ├─ Request permissions
    │
    ├─ Initialize sensors
    │
    ├─ Register with Master ◀─────── WebSocket Connection
    │                          Handshake
    │
    ├─ AGENTS_MODE ─────────────┐
    │                            │
    │ START_CAPTURE              │
    │   • Video Stream           │
    │   • Audio Detection        │
    │   • Location Tracking      │
    │                            │
    │ CONNECTED STATE ◀──────────┼─── Connected to Master
    │   • Send Frames            │     Receive Acks
    │   • Buffer Data            │
    │   • Retry on Fail          │
    │                            │
    │ DISCONNECTED STATE ◀───────┼─── Lost Connection
    │   • Queue locally          │     Auto-retry
    │   • Cache on device        │
    │   • Retry with backoff     │
    │                            │
    │ APP_BACKGROUNDED ◀─────────┼─── App loses focus
    │   • Switch to low-power    │     Run background task
    │   • Sample less frequently │
    │   • Keep location on       │
    │                            │
    ├─ Transitions ─────────────┘
    │   • Back to foreground
    │   • Connection restored
    │   • Mode change request
    │
    ├─ Lifecycle events logged
    │
    STOP
```

---

## Master Node State Machine

```
┌─────────────────────────────────────┐
│    MASTER NODE LIFECYCLE            │
└─────────────────────────────────────┘

  START
    │
    ├─ Initialize services
    │
    ├─ Start Agent WS Server (8081)
    │   • Listen for agent connections
    │   • Accept binary streams
    │   • Route to queues
    │
    ├─ Start Backend WS Client
    │   • Connect with auth token ◀─ CONNECTED_TO_BACKEND
    │   • Drain offline buffer
    │   • Maintain connection
    │
    ├─ Start Hardware Worker
    │   • Scan for hardware
    │   • Create agent records
    │   • Subscribe to streams
    │
    ├─ OPERATIONAL STATE
    │   • Accept connections
    │   • Buffer streams
    │   • Forward to backend
    │   • Monitor telemetry
    │   • Local dashboard
    │
    ├─ ERROR HANDLING
    │   • Backend disconnected
    │   • Agent connection lost
    │   • Hardware failure
    │   • Buffer overflow
    │
    ├─ Recovery
    │   • Retry connection
    │   • Clear old data
    │   • Re-discover agents
    │
    STOP
```

---

## Backend Processing Pipeline

```
┌─────────────────────────────────────────────────┐
│      BACKEND EVENT PROCESSING PIPELINE          │
└─────────────────────────────────────────────────┘

INCOMING EVENTS
    │
    ├─▶ VIDEO_INGEST
    │   ├─ Validate packet
    │   ├─ Extract frame
    │   ├─ Run YOLO detection
    │   ├─ Classify behavior
    │   ├─ Check confidence threshold
    │   ├─ Store in DB
    │   └─ Publish to WebSocket
    │
    ├─▶ AUDIO_INGEST
    │   ├─ Validate packet
    │   ├─ Decode audio data
    │   ├─ Run classification
    │   │   ├─ Gunshot: High freq + sharp peaks
    │   │   ├─ Scream: High pitch + sustained
    │   │   └─ Other: Classify event type
    │   ├─ Check confidence
    │   ├─ Store audio clip
    │   ├─ Generate transcript (if enabled)
    │   └─ Publish alert
    │
    ├─▶ LOCATION_INGEST
    │   ├─ Validate GPS data
    │   ├─ Check geofence
    │   ├─ Correlate with other agents
    │   ├─ Triangulate position
    │   ├─ Update agent location
    │   └─ Publish location update
    │
    └─▶ AGGREGATION & CORRELATION
        ├─ Combine events from multiple sources
        ├─ Detect patterns (clustering)
        ├─ Generate alerts
        ├─ Update incident reports
        └─ Cache results (Redis)

OUTGOING STREAMS
    │
    ├─▶ WebSocket to Masters
    │   ├─ Confirm receipt
    │   ├─ Send commands
    │   └─ Stream health metrics
    │
    ├─▶ WebSocket to Frontend
    │   ├─ Real-time events
    │   ├─ Agent status updates
    │   ├─ Location updates
    │   └─ Alert notifications
    │
    └─▶ Database Write Queue
        ├─ Batch inserts
        ├─ Update agent metrics
        ├─ Store raw data
        └─ Archive old data
```

---

## Frontend Dashboard Architecture

```
┌──────────────────────────────────────┐
│    FRONTEND DASHBOARD LAYOUT         │
└──────────────────────────────────────┘

┌────────────────────────────────────────────┐
│             TOP NAVIGATION BAR             │
│  NISHA | Dashboard | Alerts | Settings    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│              STATUS BAR                    │
│ Agents: 12/20 | Masters: 2/4 | Uptime: 99│
└────────────────────────────────────────────┘

┌──────────────────────┬───────────────────────┐
│                      │                       │
│    LIVE MAP         │    REAL-TIME METRICS  │
│                      │                       │
│  • Agent locations  │  • Total detections   │
│  • Zone boundaries  │  • Alerts in last HR  │
│  • Incidents        │  • Avg latency        │
│                      │  • Data throughput    │
│  ┌────────────────┐  │  • Hardware status   │
│  │      MAP       │  │                       │
│  │                │  ├───────────────────────┤
│  │   ● Agent 1    │  │   ACTIVE ALERTS      │
│  │   ● Agent 2    │  │                       │
│  │   ▲ Incident   │  │ 🔴 GUNSHOT detected  │
│  │                │  │    Zone 3 - 2min ago │
│  └────────────────┘  │                       │
│                      │ 🟠 PERSON detected   │
│                      │    Zone 1 - Now      │
└──────────────────────┴───────────────────────┘

┌──────────────────────┬───────────────────────┐
│  VIDEO STREAMS       │  AUDIO EVENTS         │
│                      │                       │
│ Agent 1: LIVE        │ Timeline of events    │
│ ┌──────────────────┐ │                       │
│ │                  │ │ 12:35 - Gunshot      │
│ │   [Video Feed]   │ │ 12:30 - Scream       │
│ │                  │ │ 12:25 - Noise        │
│ │                  │ │                       │
│ └──────────────────┘ │ [Play audio clips]   │
│                      │ [Download transcr.]  │
│ Agent 2: OFFLINE     │                       │
│ ┌──────────────────┐ │                       │
│ │   No stream      │ │                       │
│ │   Battery: 5%    │ │                       │
│ │                  │ │                       │
│ └──────────────────┘ │                       │
└──────────────────────┴───────────────────────┘

┌────────────────────────────────────────────┐
│           EVENT HISTORY LOG                │
│ Time | Type | Agent | Zone | Details      │
├────────────────────────────────────────────┤
│12:45│Video │Agent1│Zone1│Person detected │
│12:43│Audio │Agent2│Zone3│Gunshot - High │
│12:40│Loc   │Agent1│Zone2│Moved to Zone 2 │
│12:35│Video │Agent3│Zone1│Motion detected │
│12:30│Audio │Agent2│Zone3│Scream detected │
└────────────────────────────────────────────┘
```

---

## Network Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    NISHA NETWORK TOPOLOGY                       │
└─────────────────────────────────────────────────────────────────┘

                          INTERNET / CLOUD
                                  │
                   ┌──────────────┼──────────────┐
                   │              │              │
              [ISP Router]    [CDN/DDoS]    [Backup Link]
                   │              │              │
                   └──────────────┴──────────────┘
                                  │
                        ┌─────────┴─────────┐
                        │                   │
                   ┌────▼────┐          ┌──▼────┐
                   │ Firewall│          │VPN GW │
                   └────┬────┘          └──┬────┘
                        │                  │
                  ┌─────┴──────────────────┴────┐
                  │                             │
          ┌───────▼────────┐          ┌────────▼────────┐
          │  BACKEND (DC1) │◀─────────│ MASTER NODE (DC)│
          │  Port 8000/443 │  WebSocket Port 8081       │
          │ PostgreSQL,    │          │ Agent WS Server │
          │ Redis, Storage │          │ Dashboard (5000)│
          └────────────────┘          └─────────┬───────┘
                                                 │
                         ┌───────────────────────┼───────────────────┐
                         │                       │                   │
                    ┌────▼────┐            ┌────▼────┐         ┌────▼────┐
                    │ Mobile 1 │            │ Mobile 2 │         │ Mobile N │
                    │ WiFi/LTE │            │ WiFi/LTE │         │WiFi/LTE │
                    │ Agent    │            │ Agent    │         │ Agent    │
                    └──────────┘            └──────────┘         └──────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
     │ESP32 Cam│    │Audio Node│   │GPS Track│
     │         │    │          │   │         │
     └─────────┘    └──────────┘   └─────────┘

Protocols:
• Mobile ↔ Master: WebSocket (Binary frames)
• Master ↔ Backend: WebSocket (JSON events)
• Backend ↔ Frontend: WebSocket (Real-time updates)
• Hardware → Master: Serial/HTTP (configured)

Bandwidth:
• Video: ~1-5 Mbps per stream
• Audio: ~64 kbps per stream
• Location: ~1 kbps per agent
• Telemetry: ~10 kbps per agent

Encryption:
• WSS (WebSocket Secure) for all connections
• TLS 1.3 minimum
• Token-based authentication
```

---

## Success Validation Flowchart

```
┌─────────────────────────────────────────┐
│    INTEGRATION VALIDATION FLOWCHART     │
└─────────────────────────────────────────┘

START
  │
  ├─ Mobile connects to Master?
  │  ├─ YES ──▶ Check handshake ──▶ Get Agent ID?
  │  │  ├─ YES ──▶ ✅ PASS Week 1.1
  │  │  └─ NO  ──▶ ❌ FAIL Debug connection
  │  └─ NO  ──▶ ❌ FAIL Check firewall/port
  │
  ├─ Master connects to Backend?
  │  ├─ YES ──▶ Check heartbeat ──▶ Stable?
  │  │  ├─ YES ──▶ ✅ PASS Week 1.2
  │  │  └─ NO  ──▶ ❌ FAIL Check queuing
  │  └─ NO  ──▶ ❌ FAIL Check token/URL
  │
  ├─ Frontend connects to Backend?
  │  ├─ YES ──▶ Check WebSocket ──▶ Events push?
  │  │  ├─ YES ──▶ ✅ PASS Week 1.3
  │  │  └─ NO  ──▶ ❌ FAIL Check event bus
  │  └─ NO  ──▶ ❌ FAIL Create endpoint
  │
  ├─ Video data flows end-to-end?
  │  ├─ YES ──▶ Check latency ──▶ < 500ms?
  │  │  ├─ YES ──▶ ✅ PASS Week 2.1
  │  │  └─ NO  ──▶ ⚠️ OPTIMIZE buffers
  │  └─ NO  ──▶ ❌ FAIL Check format
  │
  ├─ Audio data flows end-to-end?
  │  ├─ YES ──▶ Check classification ──▶ Accurate?
  │  │  ├─ YES ──▶ ✅ PASS Week 2.2
  │  │  └─ NO  ──▶ ⚠️ TUNE model
  │  └─ NO  ──▶ ❌ FAIL Check format
  │
  ├─ Location data flows end-to-end?
  │  ├─ YES ──▶ Check accuracy ──▶ < 10m?
  │  │  ├─ YES ──▶ ✅ PASS Week 2.3
  │  │  └─ NO  ──▶ ⚠️ IMPROVE GPS
  │  └─ NO  ──▶ ❌ FAIL Check format
  │
  ├─ Hardware agents integrated?
  │  ├─ YES ──▶ Check discovery ──▶ Auto-register?
  │  │  ├─ YES ──▶ ✅ PASS Week 3
  │  │  └─ NO  ──▶ ⚠️ FIX discovery
  │  └─ NO  ──▶ ❌ FAIL Update firmware
  │
  ├─ Connection resilient?
  │  ├─ YES ──▶ Test offline/online ──▶ Sync works?
  │  │  ├─ YES ──▶ ✅ PASS Week 4.1
  │  │  └─ NO  ──▶ ⚠️ FIX queue
  │  └─ NO  ──▶ ❌ FAIL Implement retry
  │
  ├─ Dashboard fully functional?
  │  ├─ YES ──▶ Performance test ──▶ 30+ fps?
  │  │  ├─ YES ──▶ ✅ PASS Week 4.2
  │  │  └─ NO  ──▶ ⚠️ OPTIMIZE render
  │  └─ NO  ──▶ ❌ FAIL Add components
  │
  ├─ System handles load (10 agents)?
  │  ├─ YES ──▶ Stress test (20 agents) ──▶ Success?
  │  │  ├─ YES ──▶ ✅ PRODUCTION READY
  │  │  └─ NO  ──▶ ⚠️ SCALE infrastructure
  │  └─ NO  ──▶ ❌ FAIL Optimize code
  │
  END

✅ = Ready for next phase
⚠️ = Needs optimization but functional
❌ = Blocking, must fix before continuing
```

---

## Summary

This visual architecture shows:
1. **How all layers connect** (Mobile → Master → Backend → Frontend)
2. **Data flow patterns** (video, audio, location)
3. **System state transitions**
4. **Event processing pipeline**
5. **Dashboard layout**
6. **Network topology**
7. **Validation checklist**

All connections are **asynchronous**, use **WebSockets** for real-time updates, and support **hardware agents** seamlessly.

