# Mobile → Master → Backend Integration - Quick Execution Plan

## 🎯 EXECUTIVE SUMMARY

**Goal**: Seamless communication between Mobile → Master → Backend → Frontend
**Status**: 60% infrastructure ready, 40% integration missing
**Timeline**: 4 weeks
**Team**: 1-2 developers

---

## 📋 QUICK EXECUTION CHECKLIST

### WEEK 1: CONNECTION INFRASTRUCTURE

#### Days 1-2: Mobile ↔ Master Connection
```
[ ] Create WebSocket client in mobile
    File: Nisha-mobile-agent/frontend/src/api/master_client.ts
    Task: Replace API client with master WebSocket
    
[ ] Implement handshake protocol
    File: Same file
    Payload: {agent_id, mode, device_info}
    
[ ] Test connection on simulator
    Debug: Check console logs for handshake success
```

**Files to change**:
- `Nisha-mobile-agent/frontend/src/services/StreamManager.ts` - Point to master instead of backend
- `Nisha-mobile-agent/frontend/src/store/useAgentStore.ts` - Add master connection state

**Validation**: Mobile connects and gets agent_id confirmation

#### Days 3-4: Master ↔ Backend Verification
```
[ ] Verify master connects to backend on startup
    File: masters/src/nisha_master/main.py (already does this)
    
[ ] Check authentication token works
    Config: Verify BACKEND_WS_URL and token in .env
    
[ ] Monitor connection in dashboard
    URL: http://master:5000 (local dashboard)
```

**Expected result**: Master shows "Connected to Backend" in logs

#### Day 5: Backend ↔ Frontend Connection
```
[ ] Create WebSocket endpoint in backend
    File: Backend/src/nisha/api/v1/ws.py
    Path: /api/v1/ws
    Auth: Use same token strategy
    
[ ] Create WebSocket client in frontend
    File: Frontend/src/services/backend_socket.ts
    URL: Use REACT_APP_BACKEND_WS_URL env var
    
[ ] Test real-time connection
    Test: Send test event and see it in frontend logs
```

**Validation**: Frontend connects and receives test events

---

### WEEK 2: DATA SCHEMA ALIGNMENT

#### Days 1-2: Video Packet Format
```
[ ] Define video packet schema
    Location: Create Backend/src/nisha/domain/schemas/video_packet.py
    Schema:
    {
      agent_id: str,
      timestamp: ISO,
      frame_index: int,
      detection: {behavior, confidence},
      metadata: {rssi, battery, zone}
    }

[ ] Update Mobile StreamManager
    File: Nisha-mobile-agent/frontend/src/services/StreamManager.ts
    Task: Encode frames in new format

[ ] Update Master agent_ws.py
    File: masters/src/nisha_master/interfaces/agent_ws.py
    Task: Parse and route video packets

[ ] Verify Backend video.py handles packets
    File: Backend/src/nisha/api/v1/video.py
    Task: Confirm /video/ingest matches schema
```

**Test**: Send test video packet end-to-end

#### Days 3-4: Audio Packet Format
```
[ ] Define audio packet schema
    Location: Backend/src/nisha/domain/schemas/audio_packet.py
    Schema:
    {
      agent_id: str,
      timestamp: ISO,
      detection: {type, confidence},
      audio_data: base64,
      sample_rate: int,
      metadata: {rssi, battery, zone}
    }

[ ] Implement Mobile AudioManager
    File: Nisha-mobile-agent/frontend/src/services/AudioManager.ts
    Task: Complete from stub implementation

[ ] Update Backend audio.py
    File: Backend/src/nisha/api/v1/audio.py
    Task: Handle mobile audio packets
```

**Test**: Send test audio event end-to-end

#### Day 5: Location Packet Format
```
[ ] Define location packet schema
    Location: Create Backend/src/nisha/api/v1/schemas/location.py
    Schema:
    {
      agent_id: str,
      timestamp: ISO,
      latitude: float,
      longitude: float,
      accuracy: float,
      zone: str
    }

[ ] Complete Mobile LocationManager
    File: Nisha-mobile-agent/frontend/src/services/LocationManager.ts
    Task: Implement GPS tracking

[ ] Create Backend location.py
    File: Backend/src/nisha/api/v1/location.py (NEW)
    Task: Ingest and process location data
```

**Test**: Send test location update end-to-end

---

### WEEK 3: HARDWARE INTEGRATION

#### Days 1-2: ESP32 Camera Integration
```
[ ] Update Master hardware_worker.py
    File: masters/src/nisha_master/core/hardware_worker.py
    Task: Add video packet support from ESP32
    
[ ] Verify ESP32 firmware
    File: agents/esp32_cam/esp32_cam_firmware.ino
    Task: Check it sends correct format
    
[ ] Test hardware video stream
    Test: Connect ESP32 and verify master receives frames
```

#### Days 3-4: Audio Node Integration  
```
[ ] Update Master hardware_worker.py (cont.)
    Task: Add audio packet support from audio nodes
    
[ ] Verify audio node firmware
    File: agents/audio_node/audio_node_firmware.ino
    Task: Check it sends correct format
    
[ ] Test hardware audio stream
    Test: Connect audio node and verify detections
```

#### Day 5: Hardware Agent Discovery
```
[ ] Implement agent registration
    File: Backend/src/nisha/api/v1/agents.py (or new hardware.py)
    Task: Register hardware agents in system
    
[ ] Add heartbeat monitoring
    Task: Track which hardware agents are online
    
[ ] Test discovery
    Test: Hardware agents appear in dashboard
```

---

### WEEK 4: ERROR HANDLING & DASHBOARD

#### Days 1-2: Connection Resilience
```
[ ] Add retry logic to mobile
    File: Nisha-mobile-agent/frontend/src/api/master_client.ts
    Task: Reconnect on failure with backoff
    
[ ] Add offline queue
    File: Nisha-mobile-agent/frontend/src/store/
    Task: Queue data when offline, sync when online
    
[ ] Monitor connection status
    File: All services
    Task: Add connection state tracking
```

#### Days 3-4: Frontend Dashboard Integration
```
[ ] Display real-time agent locations
    File: Frontend/src/components/LiveMap.tsx
    Task: Show agents on map with live updates
    
[ ] Display video streams
    File: Frontend/src/components/VideoPlayer.tsx
    Task: Play video with HLS or WebRTC
    
[ ] Display audio events
    File: Frontend/src/components/AudioTimeline.tsx
    Task: Show audio events with playback
    
[ ] Display alerts
    File: Frontend/src/components/AlertPanel.tsx
    Task: Real-time alert notifications
```

#### Day 5: Testing & Fixes
```
[ ] End-to-end test: Mobile video → Frontend display
[ ] End-to-end test: Mobile audio → Frontend playback
[ ] End-to-end test: Hardware agents → Frontend display
[ ] Performance test: Latency measurement
[ ] Load test: Multiple agents simultaneously
[ ] Fix any bugs found
```

---

## 🔧 PRIORITY FIXES IN ORDER

### CRITICAL (Do First - Week 1)
1. **Mobile → Master Connection**
   - Create WebSocket client
   - Implement handshake
   - Start receiving data
   - **Impact**: Without this, nothing works
   - **Time**: 4-6 hours

2. **Master → Backend Verification**
   - Confirm connection stability
   - Test token authentication
   - Verify data forwarding
   - **Impact**: Confirm infrastructure ready
   - **Time**: 2-3 hours

3. **Backend → Frontend WebSocket**
   - Create WS endpoint
   - Create client connection
   - Test real-time push
   - **Impact**: Enable live dashboard
   - **Time**: 3-4 hours

### HIGH (Week 2)
4. **Video Packet Schema**
   - Define format
   - Update mobile encoder
   - Update master router
   - Test end-to-end
   - **Impact**: Video streaming working
   - **Time**: 6-8 hours

5. **Audio Packet Schema**
   - Complete AudioManager
   - Define format
   - Update routing
   - Test end-to-end
   - **Impact**: Audio detection working
   - **Time**: 4-6 hours

6. **Location Packet Schema**
   - Complete LocationManager
   - Create backend endpoint
   - Test end-to-end
   - **Impact**: Location tracking working
   - **Time**: 4-5 hours

### MEDIUM (Week 3-4)
7. **Hardware Integration**
   - ESP32 camera support
   - Audio node support
   - Agent discovery
   - **Impact**: Full sensor array working
   - **Time**: 8-10 hours

8. **Error Handling**
   - Reconnect logic
   - Offline queue
   - Validation
   - **Impact**: System reliability
   - **Time**: 6-8 hours

9. **Dashboard Integration**
   - Real-time display
   - Map view
   - Video playback
   - **Impact**: User-facing features
   - **Time**: 10-12 hours

---

## 🧪 TESTING AT EACH STAGE

### After Mobile → Master Connection
```bash
# Check logs
tail -f ~/master.log | grep "Handshake"
# Should see: "Handshake successful: MOBILE-ABC123"

# Test in app
Open mobile app → Should see "Connected to Master"
```

### After Master → Backend Connection
```bash
# Check logs
tail -f ~/backend.log | grep "Master connected"
# Should see: "Master MASTER-001 connected"

# Test in master dashboard
http://master:5000 → Should show "Backend: Connected"
```

### After Backend → Frontend Connection
```bash
# Check browser console
Should see: "Frontend WebSocket connected"

# Test in frontend
Open dashboard → Should see live metrics updating
```

### After Video Schema
```bash
# Trigger video detection
Point camera at movement → Should appear in dashboard

# Check logs
Master: Frame received from MOBILE-ABC123
Backend: Video packet processed
Frontend: Video displayed
```

---

## 📊 SUCCESS CRITERIA

### Functional
- ✅ Mobile connects to master automatically
- ✅ Master forwards all data to backend
- ✅ Backend processes and stores data
- ✅ Frontend receives real-time updates
- ✅ Dashboard displays live data
- ✅ Hardware agents integrated

### Performance
- ✅ Latency < 500ms (mobile → frontend)
- ✅ Packet loss < 0.1%
- ✅ No connection drops (> 99% uptime)
- ✅ Dashboard responsive (> 30fps)

### Reliability
- ✅ Auto-reconnect on failure
- ✅ Data persists on network loss
- ✅ No data corruption
- ✅ Proper error handling

---

## ⚠️ POTENTIAL BLOCKERS

| Blocker | Solution | Timeline |
|---------|----------|----------|
| WebSocket auth conflicts | Use consistent token scheme | Day 1 |
| Packet format mismatch | Define schema before implementing | Day 2 |
| Frontend not connected | Check WebSocket endpoint exists | Day 3 |
| Hardware firmware outdated | Update ESP32 firmware | Week 3 |
| Performance issues | Add compression/sampling | Week 4 |

---

## 🚀 GETTING STARTED TODAY

### Step 1: Check Current Status (30 min)
```bash
# Check master can start
cd masters && python -m nisha_master.main

# Check backend is running
curl http://localhost:8000/health

# Check frontend builds
cd Frontend && npm run build
```

### Step 2: Create Development Branch
```bash
git checkout -b feature/mobile-master-integration
```

### Step 3: Start Day 1 Task
```
Task: Create mobile WebSocket client
File: Nisha-mobile-agent/frontend/src/api/master_client.ts
Time: 4-6 hours
```

### Step 4: Test Connection
```bash
# Start master
cd masters && python -m nisha_master.main

# Start mobile app
cd Nisha-mobile-agent/frontend && yarn start

# Check logs for successful connection
```

---

## 📝 DAILY STANDUP TEMPLATE

```
Date: 
Developer: 

Yesterday:
- [ ] Task 1 completed?
- [ ] Task 2 completed?
- [ ] Blockers encountered?

Today:
- [ ] Task 1 planned
- [ ] Task 2 planned  
- [ ] Dependencies needed?

Blockers:
- If any, list here with escalation plan
```

---

## 🎓 KEY FILES TO UNDERSTAND FIRST

Before starting, read these files to understand the system:

1. **Masters architecture**:
   - `masters/src/nisha_master/main.py` - System startup
   - `masters/src/nisha_master/interfaces/agent_ws.py` - Agent connection handler

2. **Backend architecture**:
   - `Backend/src/nisha/main.py` - System startup
   - `Backend/src/nisha/api/v1/video.py` - Video endpoint example
   - `Backend/src/nisha/api/v1/audio.py` - Audio endpoint example

3. **Mobile architecture**:
   - `Nisha-mobile-agent/frontend/app/index.tsx` - App entry
   - `Nisha-mobile-agent/frontend/src/store/useAgentStore.ts` - State management

4. **Frontend architecture**:
   - `Frontend/src/App.tsx` - Frontend entry
   - Check how WebSocket is currently handled (if at all)

---

## 📞 COMMUNICATION & ESCALATION

**Daily Updates**: Share in standup
**Blockers**: Escalate within 2 hours
**Questions**: Document and discuss in group

---

## ✅ FINAL VALIDATION

When complete, verify:

```
[ ] Mobile connects to master on startup
[ ] Master forwards data to backend
[ ] Backend processes video/audio/location
[ ] Frontend displays real-time dashboard
[ ] No connection drops in 1-hour test
[ ] Video visible in dashboard
[ ] Audio events shown in dashboard
[ ] Location map displays agents
[ ] Hardware agents appear in system
[ ] All data persists in database
[ ] Dashboard responsive under load
```

---

**Ready to start?** Begin with Week 1, Day 1 tasks above.
**Questions?** Refer to MOBILE_MASTER_INTEGRATION_PLAN.md for detailed info.

