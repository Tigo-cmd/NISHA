# NISHA Mobile - Quick Reference Guide

## 📊 STATUS AT A GLANCE

```
OVERALL COMPLETION: 45% ███▓▓▓▓▓▓▓
DEPLOYABLE: ❌ NO
CRITICAL ISSUES: 12
ESTIMATED FIX TIME: 3-4 weeks
```

---

## 🔴 TOP 5 CRITICAL ISSUES (START HERE)

### 1. Video Streaming Broken
- **File**: `frontend/src/services/StreamManager.ts`
- **Issue**: WebSocket URL empty, no frame capture loop
- **Fix Time**: 6-8 hours
- **Impact**: 🔴 BLOCKING - No video at all

### 2. Master Mode Missing
- **File**: `frontend/app/master.tsx` (doesn't exist)
- **Issue**: Entire master mode not implemented
- **Fix Time**: 16-20 hours
- **Impact**: 🔴 BLOCKING - Master mode unusable

### 3. Audio Detection Empty
- **File**: `frontend/src/services/AudioManager.ts`
- **Issue**: Stub file, no implementation
- **Fix Time**: 4-6 hours
- **Impact**: 🔴 BLOCKING - No audio detection

### 4. Backend WebSocket Missing
- **File**: `backend/websocket_server.py` (doesn't exist)
- **Issue**: No server for video streaming
- **Fix Time**: 4-6 hours
- **Impact**: 🔴 BLOCKING - Frontend can't send video

### 5. Detection Endpoint Missing
- **File**: `backend/server.py`
- **Issue**: No endpoint for agents to report events
- **Fix Time**: 3-4 hours
- **Impact**: 🔴 BLOCKING - No event collection

**Total Critical Time**: ~35-45 hours (1 week)

---

## 📂 KEY FILES STATUS

### Frontend

| File | Status | Priority |
|------|--------|----------|
| `app/index.tsx` | ✅ Complete | - |
| `app/agent.tsx` | ⚠️ 70% | HIGH |
| `app/master.tsx` | ❌ 0% | 🔴 |
| `app/settings.tsx` | ⚠️ 40% | HIGH |
| `services/StreamManager.ts` | ❌ 30% | 🔴 |
| `services/AudioManager.ts` | ❌ 5% | 🔴 |
| `services/LocationManager.ts` | ⚠️ 30% | HIGH |
| `store/useAgentStore.ts` | ✅ 90% | - |
| `store/useModeStore.ts` | ⚠️ 60% | HIGH |
| `config/theme.ts` | ✅ 85% | - |

### Backend

| File | Status | Priority |
|------|--------|----------|
| `server.py` | ⚠️ 50% | 🔴 |
| `websocket_server.py` | ❌ 0% | 🔴 |
| `.env` | ⚠️ Partial | - |

---

## ⏱️ IMPLEMENTATION TIMELINE

```
WEEK 1 (Phase 1 - Critical)
├─ Mon: StreamManager fix (6-8 hrs)
├─ Tue: Backend WebSocket (4-6 hrs)
├─ Wed: Audio detection (4-6 hrs)
├─ Thu: Detection endpoint (3-4 hrs)
└─ Fri: Testing & fixes (8 hrs)

WEEK 2 (Phase 2 - Core Features)
├─ Mon-Tue: Master dashboard (16-20 hrs)
├─ Wed: Mode switching fix (8-10 hrs)
├─ Thu-Fri: Child management (8-10 hrs)

WEEK 3 (Phase 3 - Robustness)
├─ Error handling (8-10 hrs)
├─ Settings persistence (6-8 hrs)
├─ Testing (8-10 hrs)
└─ Offline support (6-8 hrs)

WEEK 4 (Phase 4 - Polish)
├─ Performance optimization (6-8 hrs)
├─ Design system completion (4-6 hrs)
├─ Monitoring setup (6-8 hrs)
└─ Deployment prep (5-7 hrs)
```

---

## 🎯 QUICK FIX CHECKLIST

### Day 1 (8 hours)
- [ ] Create backend WebSocket server
- [ ] Define NISHA protocol specification
- [ ] Update StreamManager with WebSocket URL

### Day 2 (8 hours)
- [ ] Implement frame capture loop in StreamManager
- [ ] Test WebSocket connection
- [ ] Create detection submission endpoint

### Day 3 (8 hours)
- [ ] Implement AudioManager service
- [ ] Add location tracking
- [ ] Test audio detection

### Day 4 (8 hours)
- [ ] Fix backend heartbeat response
- [ ] Complete mode switching logic
- [ ] Add error handling

### Day 5 (8 hours)
- [ ] Testing on simulator
- [ ] Bug fixes from testing
- [ ] Documentation

---

## 🔧 CODE SNIPPETS FOR FIXES

### Fix 1: StreamManager WebSocket URL
```typescript
// In StreamManager constructor or connect method
async connect(agentId: string, backendUrl: string): Promise<void> {
  const protocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
  const baseUrl = backendUrl
    .replace('http://', '')
    .replace('https://', '');
  
  this.wsUrl = `${protocol}://${baseUrl}/ws/${agentId}`;
  this.agentId = agentId;
  
  // Now attempt connection
  await this.connect();
}
```

### Fix 2: Backend Detection Endpoint
```python
@api_router.post("/api/mobile/detection")
async def submit_detection(detection: DetectionPayload):
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "agent_id": detection.agent_id,
        "type": detection.type,
        "sub_type": detection.sub_type,
        "confidence": detection.confidence,
        "priority": detection.priority,
        "timestamp": now,
        "metadata": detection.metadata,
    }
    result = await db.detections.insert_one(record)
    return {"id": str(result.inserted_id), "received": True}
```

### Fix 3: Audio Detection Starter
```typescript
class AudioManager {
  async startListening(): Promise<void> {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Audio permission denied');
    
    // Configure and start recording
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await recording.startAsync();
    
    // Analyze periodically
    setInterval(() => this.analyzeAudio(), 500);
  }
  
  private async analyzeAudio(): Promise<void> {
    // Get metering data and detect loud sounds
    // Submit detections via API
  }
}
```

---

## 📊 METRICS TO TRACK

### Performance Targets
- App startup: < 3 seconds
- API response: < 500ms
- Video latency: < 1 second
- Battery drain: < 10%/hour
- Bundle size: < 10MB

### Quality Targets
- Test coverage: 60% minimum
- Error rate: < 1%
- Crash rate: < 0.1%
- Success rate: > 99%

### Timeline Targets
- Phase 1: 5 days (Critical)
- Phase 2: 5 days (Core)
- Phase 3: 4 days (Robust)
- Phase 4: 3 days (Polish)

---

## 🚀 DEPLOYMENT CHECKLIST

Before launching:
- [ ] Phase 1 complete (video streaming works)
- [ ] Phase 2 complete (master mode working)
- [ ] Phase 3 complete (error handling)
- [ ] 60% test coverage
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Rollback procedure ready
- [ ] Monitoring setup
- [ ] Crash reporting enabled

---

## 📚 DETAILED DOCUMENTS

For more information, read:

1. **MOBILE_APP_ANALYSIS.md**
   - Complete architecture review
   - Component-by-component analysis
   - Database schema review
   - Design system assessment

2. **IMPLEMENTATION_ROADMAP.md**
   - 4-phase detailed plan
   - File-by-file checklist
   - Risk assessment
   - Success criteria

3. **TECHNICAL_ISSUES.md**
   - Specific code issues
   - Exact fixes needed
   - Code examples
   - Performance issues

---

## 🎓 LEARNING RESOURCES

### Key Technologies
- **Frontend**: React Native, Expo, TypeScript
- **Backend**: FastAPI, FastAPI WebSocket, Motor (async MongoDB)
- **State**: Zustand (lightweight state management)
- **Camera**: react-native-vision-camera + Worklets

### Key Files to Study First
1. `frontend/src/store/useAgentStore.ts` - Good state management example
2. `frontend/app/agent.tsx` - Main UI logic
3. `backend/server.py` - API structure
4. `frontend/src/config/theme.ts` - Design system

---

## 🆘 TROUBLESHOOTING

### WebSocket Connection Failed
- Check EXPO_PUBLIC_BACKEND_URL env var
- Verify backend server running
- Check protocol (ws vs wss)
- Look for CORS issues

### Frame Capture Not Working
- Check camera permissions
- Verify HiddenCamera mounted
- Check vision-camera version
- Test on real device (simulators may have issues)

### Audio Detection Silent
- Check audio permissions
- Verify expo-av installed
- Check if service started
- Monitor metering values

### Mode Switch Fails
- Check MongoDB connection
- Verify agent exists in DB
- Check mode validation logic
- Monitor backend logs

---

## 💡 TIPS & TRICKS

### Development Workflow
1. Use `expo start --localhost` for local development
2. Use `adb logcat | grep NISHA` to see Android logs
3. Use React DevTools for state debugging
4. Use Postman for API testing

### Performance Optimization
1. Profile with React DevTools Profiler
2. Use `React.memo` for expensive components
3. Use Zustand selectors to avoid re-renders
4. Profile frame processor with flamegraph

### Debugging
1. Add console.logs in critical paths
2. Use error boundaries to catch crashes
3. Monitor WebSocket messages with DevTools
4. Test with network throttling enabled

---

## 📞 DECISION POINTS

### Audio Detection Approach
- **Option A**: ML model (best but complex)
- **Option B**: Pre-trained model (balanced)
- **Option C**: Mock/threshold (fastest for MVP)
→ **Recommended**: Option B or C for MVP

### Offline Support
- **Option A**: Full SQLite sync (complex)
- **Option B**: Partial offline (practical)
- **Option C**: Online only (simple)
→ **Recommended**: Option B for MVP

### Master Discovery
- **Option A**: Central registry (simple)
- **Option B**: Bluetooth (limited)
- **Option C**: QR code (secure but manual)
→ **Recommended**: Option A for MVP

---

## 📋 BEFORE YOU START

Ensure you have:
- [ ] Node.js 18+ and npm/yarn
- [ ] Python 3.9+ and pip
- [ ] MongoDB running
- [ ] Expo CLI installed
- [ ] Android Studio or Xcode for testing
- [ ] USB debugger (for real device testing)
- [ ] All dependencies installed

Commands to run:
```bash
# Frontend
cd Nisha-mobile-agent/frontend
yarn install
yarn start

# Backend
cd ../backend
pip install -r requirements.txt
uvicorn server:app --reload
```

---

## ✅ COMPLETION CHECKLIST

### Phase 1 Done When:
- [ ] Video streaming works end-to-end
- [ ] Audio detection working
- [ ] Detection events in database
- [ ] No crashes on simulator
- [ ] <500ms API responses

### Phase 2 Done When:
- [ ] Master mode fully functional
- [ ] Child agent management working
- [ ] Mode switching reliable
- [ ] All pages navigable
- [ ] No missing features

### Phase 3 Done When:
- [ ] Error handling on all critical paths
- [ ] Settings persist correctly
- [ ] Offline functionality working
- [ ] 60% test coverage
- [ ] Notifications working

### Phase 4 Done When:
- [ ] Bundle size < 10MB
- [ ] Startup < 3 seconds
- [ ] All design specs met
- [ ] Monitoring configured
- [ ] Deployment ready

---

**Last Updated**: May 5, 2026
**Analysis Status**: ✅ Complete
**Next Step**: Start Phase 1 fixes

