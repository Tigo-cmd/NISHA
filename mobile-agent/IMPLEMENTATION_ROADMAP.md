# NISHA Mobile - Implementation Roadmap & Action Plan

## Current State Assessment
- **Overall Completion**: ~45%
- **Deployable Status**: ❌ Not Ready
- **Critical Blockers**: 8
- **Estimated Time to MVP**: 3-4 weeks

---

## IMPLEMENTATION ROADMAP

### 🔴 PHASE 1: CRITICAL FOUNDATIONS (Week 1)
**Goal**: Get core functionality working

#### 1.1 Fix Video Streaming (StreamManager)
**Files to Fix**:
- `frontend/src/services/StreamManager.ts` (384 lines)
- Need to check `frontend/src/utils/protocol.ts` (referenced but may not exist)

**Issues**:
- WebSocket connection logic incomplete
- Frame capture loop not implemented
- Protocol frame encoding unclear

**Tasks**:
- [ ] Define NISHA protocol frame format (header, payload, checksum)
- [ ] Create WebSocket server in backend
- [ ] Implement frame capture loop in StreamManager
- [ ] Add proper error handling & reconnection
- [ ] Test with dummy WebSocket server
- [ ] Verify video chunks received correctly

**Expected Output**: Video frames streaming to backend

---

#### 1.2 Implement Backend WebSocket Server
**File to Create**:
- `backend/websocket_server.py` (new file)

**Tasks**:
- [ ] Create FastAPI WebSocket endpoint at `/ws/{agent_id}`
- [ ] Implement frame aggregation logic
- [ ] Add clip buffer management
- [ ] Create detection trigger mechanism
- [ ] Persist clips to storage
- [ ] Return acknowledgments to client

**Expected Output**: Backend can receive and store video streams

---

#### 1.3 Add Detection Event Submission
**Files to Modify**:
- `backend/server.py` - Add endpoint

**Tasks**:
- [ ] Create `POST /api/mobile/detection` endpoint
- [ ] Add DetectionEvent model to backend
- [ ] Implement detection aggregation in MongoDB
- [ ] Add timestamp and agent_id tracking
- [ ] Create detection query endpoints

**Expected Output**: Agents can submit detection events

---

#### 1.4 Implement Audio Detection Service
**Files to Create**:
- `frontend/src/services/AudioManager.ts` (replace stub)

**Tasks**:
- [ ] Implement audio capture using expo-av
- [ ] Add real-time audio analysis
- [ ] Integrate gunshot/scream detection model or mock it
- [ ] Create detection event emission
- [ ] Add battery optimization (sampling strategy)
- [ ] Test on real device

**Expected Output**: Audio detection working and sending events to backend

---

### 🟡 PHASE 2: CORE FEATURES (Week 2)
**Goal**: Implement master mode and complete sensor features

#### 2.1 Master Mode Dashboard (master.tsx)
**Files to Create**:
- `frontend/app/master.tsx` (new file)

**Tasks**:
- [ ] Design master dashboard layout
- [ ] Implement child agent list display
- [ ] Add real-time child status visualization
- [ ] Create network mesh visualization for masters
- [ ] Add detection event aggregation view
- [ ] Implement master mode settings

**Components Needed**:
- New master-specific version of TopBar
- ChildAgentCard (component exists, needs parent)
- AgentListView
- NetworkStatsView
- EventAggregationPanel

**Expected Output**: Functional master mode UI

---

#### 2.2 Complete Location Services
**File to Modify**:
- `frontend/src/services/LocationManager.ts`

**Tasks**:
- [ ] Implement background location tracking
- [ ] Add configurable update frequency
- [ ] Create location permission handling
- [ ] Emit location change events
- [ ] Add to store state
- [ ] Implement geofencing skeleton

**Expected Output**: Real-time location tracking

---

#### 2.3 Mode Switching Logic
**Files to Modify**:
- `backend/server.py` - Complete PUT /mobile/mode
- `frontend/src/store/useModeStore.ts` - Add master initialization

**Tasks**:
- [ ] Implement state machine for mode switching
- [ ] Add child agent transfer during AGENT→MASTER switch
- [ ] Clear state during MASTER→AGENT switch
- [ ] Prevent invalid transitions
- [ ] Add proper error handling

**Backend Tasks**:
- [ ] Update mode in database
- [ ] Handle child agent reassignment
- [ ] Create mode change history log
- [ ] Send confirmation to client

**Expected Output**: Reliable mode switching with state management

---

#### 2.4 Child Agent Management (Master)
**Files to Create**:
- `backend/routes/master.py` (new file with master-specific logic)

**Tasks**:
- [ ] Implement child agent discovery
- [ ] Add child status tracking
- [ ] Create command dispatch system
- [ ] Implement RSSI-based signal strength
- [ ] Add child agent UI interaction

**Endpoints Needed**:
- `GET /api/master/{master_id}/children`
- `POST /api/master/{master_id}/command`
- `GET /api/master/{master_id}/events`

**Expected Output**: Master can manage child agents

---

### 🟢 PHASE 3: ROBUSTNESS (Week 3)
**Goal**: Add error handling, testing, reliability

#### 3.1 Error Handling & Recovery
**Files to Add/Modify**:
- `frontend/src/components/ErrorBoundary.tsx` (create)
- All service files - Add try/catch
- Backend routes - Add try/catch

**Tasks**:
- [ ] Create global error boundary component
- [ ] Add per-screen error handling
- [ ] Implement retry logic for failed API calls
- [ ] Add user-facing error messages
- [ ] Implement error logging to backend
- [ ] Add recovery UI for network failures

**Expected Output**: Graceful error handling throughout app

---

#### 3.2 Settings & Persistence
**Files to Modify**:
- `frontend/app/settings.tsx`
- `frontend/src/store/useAgentStore.ts`

**Tasks**:
- [ ] Add configurable settings form
- [ ] Implement settings persistence
- [ ] Add sensors configuration
- [ ] Add stream quality settings
- [ ] Add notification preferences
- [ ] Sync settings to backend

**Settings to Add**:
- Heartbeat frequency
- Video quality
- Audio sensitivity
- Location tracking interval
- Data retention period

**Expected Output**: Fully functional settings screen

---

#### 3.3 Offline Support
**Files to Modify**:
- `frontend/src/store/useAgentStore.ts`
- Create `frontend/src/db/sqlite.ts` for local DB

**Tasks**:
- [ ] Add SQLite for local data storage
- [ ] Implement offline detection queue
- [ ] Add sync queue management
- [ ] Implement conflict resolution
- [ ] Add offline UI indicators

**Expected Output**: App can work offline, syncs when back online

---

#### 3.4 User Notifications
**Files to Create**:
- `frontend/src/services/NotificationManager.ts`

**Tasks**:
- [ ] Implement push notification setup
- [ ] Add local notifications
- [ ] Create notification preferences
- [ ] Add critical alert handling
- [ ] Implement notification history

**Expected Output**: Users informed of important events

---

#### 3.5 Comprehensive Testing
**Files to Create**:
- `tests/unit/stores.test.ts`
- `tests/unit/api.test.ts`
- `tests/integration/backend.test.py`
- `tests/e2e/critical_flows.test.ts`

**Tasks**:
- [ ] Write unit tests for stores (60% coverage)
- [ ] Write API client tests
- [ ] Write backend endpoint tests
- [ ] Write E2E tests for critical flows
- [ ] Set up CI/CD pipeline

**Coverage Target**: 60% minimum

**Expected Output**: Test suite and CI/CD setup

---

### 🔵 PHASE 4: OPTIMIZATION & POLISH (Week 4)
**Goal**: Performance, UX polish, deployment readiness

#### 4.1 Performance Optimization
**Tasks**:
- [ ] Optimize bundle size (use metro bundler config)
- [ ] Implement memoization in components
- [ ] Add image optimization
- [ ] Optimize state updates (Zustand selectors)
- [ ] Profile frame processor performance
- [ ] Add request caching

**Targets**:
- Bundle size < 10MB
- Startup time < 3s
- 60 FPS on list scrolling

---

#### 4.2 Design System Completion
**Files to Modify**:
- `frontend/src/config/theme.ts`
- Various components

**Tasks**:
- [ ] Import Space Grotesk & Inter fonts
- [ ] Implement CSS glitch effects (web only)
- [ ] Complete radar sweep animation
- [ ] Add all motion interactions from spec
- [ ] Ensure all components match design spec

**Expected Output**: Pixel-perfect design implementation

---

#### 4.3 Monitoring & Analytics
**Files to Create**:
- `frontend/src/services/AnalyticsManager.ts`
- `backend/monitoring.py`

**Tasks**:
- [ ] Integrate crash reporting (Sentry)
- [ ] Add event tracking
- [ ] Implement performance monitoring
- [ ] Add error tracking
- [ ] Create dashboard for ops team

**Expected Output**: Full observability

---

#### 4.4 Deployment Preparation
**Tasks**:
- [ ] Create production build config
- [ ] Set up staging environment
- [ ] Create deployment documentation
- [ ] Add rollback procedures
- [ ] Create user documentation
- [ ] Prepare release notes template

**Expected Output**: Production-ready deployment process

---

## FILE-BY-FILE IMPLEMENTATION CHECKLIST

### Frontend - To Create
- [ ] `app/master.tsx` (complete master dashboard)
- [ ] `src/components/ErrorBoundary.tsx`
- [ ] `src/components/AgentListView.tsx`
- [ ] `src/components/NetworkStatsView.tsx`
- [ ] `src/components/EventPanel.tsx`
- [ ] `src/services/NotificationManager.ts`
- [ ] `src/services/CrashReporter.ts`
- [ ] `src/db/sqlite.ts` (if offline support)
- [ ] `src/utils/queue.ts` (for offline queue)
- [ ] `src/utils/retry.ts` (for retry logic)

### Frontend - To Fix
- [ ] `src/services/StreamManager.ts` (80% rewrite)
- [ ] `src/services/AudioManager.ts` (complete from stub)
- [ ] `src/services/LocationManager.ts` (complete implementation)
- [ ] `app/settings.tsx` (add functional settings)
- [ ] `src/components/HiddenCamera.tsx` (verify lifecycle)
- [ ] `src/store/useModeStore.ts` (add master init)

### Backend - To Create
- [ ] `websocket_server.py` (WebSocket handler)
- [ ] `routes/master.py` (master-specific routes)
- [ ] `routes/detection.py` (detection handling)
- [ ] `models/detection.py` (Pydantic models)
- [ ] `services/aggregation.py` (event aggregation)

### Backend - To Modify
- [ ] `server.py` - Complete all route stubs

### Tests - To Create
- [ ] `tests/unit/stores.test.ts`
- [ ] `tests/unit/api.test.ts`
- [ ] `tests/integration/backend_integration.test.py`
- [ ] `tests/e2e/critical_flows.test.ts`

### Configuration - To Add
- [ ] Environment variables template
- [ ] Firebase/notification config
- [ ] Database migration scripts
- [ ] Deployment config

---

## RISK ASSESSMENT & MITIGATION

### High Risk Items
1. **Video Streaming Protocol Mismatch**
   - Risk: Frontend and backend incompatible protocol
   - Mitigation: Define protocol spec first, write tests

2. **Audio Detection ML Model**
   - Risk: Detection accuracy poor or model too large
   - Mitigation: Use pre-trained small model or mock first, test

3. **Master Mode Complexity**
   - Risk: State management becomes unwieldy
   - Mitigation: Break into sub-stores, extensive testing

4. **Background Tasks on iOS**
   - Risk: iOS restricts background execution
   - Mitigation: Use Expo TaskManager, design for limitations

5. **Battery Drain**
   - Risk: Continuous streaming kills battery fast
   - Mitigation: Implement intelligent sampling, compression

### Mitigation Strategies
- Write tests before implementation (TDD)
- Implement features on simulator first
- Create feature flags for gradual rollout
- Monitor battery/performance from day 1
- Regular code reviews

---

## ESTIMATED EFFORT & TIMELINE

| Phase | Duration | Effort | Blocker | Notes |
|-------|----------|--------|---------|-------|
| Phase 1 | 5 days | 40 hrs | CRITICAL | Must complete before moving to Phase 2 |
| Phase 2 | 5 days | 40 hrs | HIGH | Core features |
| Phase 3 | 4 days | 30 hrs | MEDIUM | Robustness |
| Phase 4 | 3 days | 25 hrs | LOW | Polish |
| **Total** | **17 days** | **135 hrs** | - | ~3 weeks full-time |

### Resource Requirements
- 1 Full-stack developer (primary)
- 0.5 QA engineer (testing)
- 0.5 DevOps (CI/CD, infrastructure)

---

## SUCCESS CRITERIA

### MVP (After Phase 2)
- [ ] Agent mode fully functional with video streaming
- [ ] Master mode dashboard with child management
- [ ] Audio detection working
- [ ] Mode switching reliable
- [ ] <1% backend errors
- [ ] <500ms API response times

### Production Ready (After Phase 4)
- [ ] 60% test coverage
- [ ] Crash reporting active
- [ ] Performance metrics < targets
- [ ] Zero critical bugs
- [ ] Full error recovery
- [ ] Documentation complete

---

## DEPENDENCIES & BLOCKERS

### External Dependencies
- MongoDB setup (assumes exists)
- Firebase setup (for notifications)
- ML model for audio detection
- Staging infrastructure

### Internal Blockers
- None at start - all components exist or can be created

### Team Dependencies
- Need backend developer for Phase 1-2
- Need QA for Phase 3
- Need DevOps for Phase 4

---

## DECISION POINTS

### Decision 1: Audio Detection Approach
- **Option A**: Implement ML model (complex, requires training data)
- **Option B**: Use pre-trained model (needs research for size/accuracy)
- **Option C**: Mock for now, implement later (faster MVP)
- **Recommendation**: Option B with Option C fallback

### Decision 2: Offline Strategy
- **Option A**: Full offline SQLite (complex, sync challenges)
- **Option B**: Partial offline (cache recent data, detect connectivity)
- **Option C**: Online-only (simpler but limits usability)
- **Recommendation**: Option B for MVP, upgrade to A later

### Decision 3: Master-Agent Discovery
- **Option A**: Central registry (backend maintains list)
- **Option B**: Bluetooth scanning (limited range)
- **Option C**: QR code pairing (manual but secure)
- **Recommendation**: Option A (simplest for MVP)

---

## DOCUMENTATION TO CREATE

1. **API Documentation** (Swagger/OpenAPI)
2. **NISHA Protocol Specification**
3. **Mode Switching State Machine Diagram**
4. **Architecture Diagram**
5. **Setup & Deployment Guide**
6. **Troubleshooting Guide**
7. **Code Style Guide**
8. **Contributing Guidelines**

---

## NEXT IMMEDIATE STEPS (Start Tomorrow)

### Day 1-2: Planning & Design
- [ ] Finalize NISHA protocol specification
- [ ] Design WebSocket message format
- [ ] Create state machine diagram for mode switching
- [ ] Design master dashboard wireframes
- [ ] Set up backend WebSocket endpoints

### Day 3: Implementation Start
- [ ] Begin StreamManager fix
- [ ] Start backend WebSocket server
- [ ] Begin audio detection service
- [ ] Set up backend detection endpoint

### Day 4-5: First Working Feature
- [ ] Complete video streaming (Phase 1.1 + 1.2)
- [ ] Test end-to-end
- [ ] Fix bugs found in testing

---

## CONCLUSION

The NISHA mobile application has a solid foundation but needs **focused, systematic implementation** to reach production readiness. Follow this roadmap phase by phase, completing each phase's testing before moving to the next. The estimated 3-week timeline is achievable with one dedicated developer and proper testing infrastructure.

**Start with Phase 1 to establish core functionality, then build out remaining features systematically.**

