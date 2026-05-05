# NISHA SENTINEL - API Integration Guide

This document outlines all the REST endpoints and WebSocket events required to connect the Next.js Frontend Dashboard to the FastAPI Backend. The frontend's `apiService.ts` and `websocketService.ts` are already structured to consume these.

## 1. Base Configuration

- **Base URL:** `http://localhost:8000/api/v1` (configurable via `NEXT_PUBLIC_API_URL`)
- **Authentication:** All REST endpoints require an API key passed either as a query parameter `?token=YOUR_API_KEY` or via an `X-API-Key` header (depending on your backend auth middleware setup).
- **Data Format:** `application/json`

---

## 2. REST API Endpoints

### 2.1. System & Health

#### `GET /api/v1/system/status`
Retrieves the global health of the entire NISHA Sentinel deployment.
- **Used in:** `/dashboard/system`
- **Response:**
  ```json
  {
    "status": "operational" | "degraded" | "critical",
    "timestamp": "2026-04-22T10:00:00Z",
    "agents": { "total": 25, "active": 20, "offline": 3, "degraded": 2 },
    "masters": { "total": 3, "online": 3 },
    "websocket_connections": 12
  }
  ```

### 2.2. Master Nodes

#### `GET /api/v1/masters`
Lists all registered Raspberry Pi master nodes.
- **Query Params:** `?status=online|degraded|offline` (optional)
- **Used in:** `/dashboard`, `/dashboard/system`, `/dashboard/maps`
- **Response:** `{ "items": [ { MasterObject } ], "total": 3 }`

#### `GET /api/v1/masters/{master_id}`
Retrieves a specific master node's details and telemetry (CPU, RAM, uptime).

#### `GET /api/v1/masters/{master_id}/agents`
Lists all ESP32 agents currently assigned to and routed through this specific master.

#### `POST /api/v1/masters/{master_id}/rebalance`
Forces the master node to re-evaluate its agent distribution and potentially hand off agents to other masters to balance CPU/Network load.
- **Used in:** `/dashboard/system` (Rebalance button)
- **Response:** `{ "movedAgents": 2, "success": true, "message": "..." }`

### 2.3. Agent Nodes

#### `GET /api/v1/agents`
Lists all ESP32 agent nodes in the network.
- **Query Params:** `?status=active`, `?master_id=M-001`, `?location_zone=Perimeter`
- **Used in:** `/dashboard`, `/dashboard/agents`, `/dashboard/maps`, `/dashboard/analytics`
- **Response:** `{ "items": [ { AgentObject } ], "total": 25, "limit": 50, "offset": 0 }`

#### `GET /api/v1/agents/{agent_id}`
Retrieves detailed telemetry for a single agent (battery, signal, temp, coordinates).
- **Used in:** Agent Drawer (Overview Tab)

#### `GET /api/v1/agents/{agent_id}/logs`
Retrieves historical security events and system logs for a specific agent.
- **Used in:** Agent Drawer (Analytics/History Tab)
- **Response:** `{ "items": [ { "type": "Motion", "time": "14:21", "detail": "..." } ] }`

#### `PUT /api/v1/agents/{agent_id}/config`
Updates the configuration parameters (audio thresholds, motion sensitivity) for an agent.
- **Used in:** `/dashboard/system` (Global Config Panel)
- **Body:** `{ "audio_threshold": 310, "motion_sensitivity": 8 }`

#### `POST /api/v1/agents/{agent_id}/command`
Dispatches an immediate command to an agent (e.g., lockdown, reboot, silent mode).
- **Used in:** `/dashboard/security` (Emergency Protocol)
- **Body:** `{ "command_type": "emergency_lockdown", "params": {} }`

### 2.4. Network Topology & Mesh

#### `GET /api/v1/topology`
Retrieves the complete graph structure of how agents are connected to masters.
- **Used in:** `/dashboard` (NetworkTopology Graph component)
- **Response:** `{ "nodes": [...], "edges": [...] }`

#### `GET /api/v1/topology/summary`
Retrieves high-level mesh network health metrics.
- **Used in:** `/dashboard/system` (Topology stats)
- **Response:** `{ "totalNodes": 28, "totalEdges": 25, "avgSignal": -62, "weakestLink": "A-012" }`

#### `POST /api/v1/topology/optimize`
Triggers a global mesh routing optimization routine across all masters.
- **Used in:** `/dashboard/system` (Optimize Routing button)

---

## 3. WebSocket Integration

For real-time telemetry, video streaming, and instant alert delivery, the frontend connects to the FastAPI WebSocket manager.

- **Endpoint:** `ws://localhost:8000/api/v1/ws`

### Expected Message Types (Server → Client)

1. **`nodeData` / `telemetry`**
   - **Trigger:** Sent every X seconds per agent.
   - **Payload:** Current battery, signal strength (dBm), CPU usage, and GPS coordinates.
   - **Action:** Updates the store, moving agent markers on the Map and updating telemetry bars in the Agent Drawer.

2. **`thresholdAlert` / `securityEvent`**
   - **Trigger:** Immediate push when an agent detects motion, high decibel audio, or intrusion.
   - **Payload:** Alert ID, severity (critical/high), description, timestamp, agent ID.
   - **Action:** Adds to the active alerts list, recalculates Threat Level on the Security page, and triggers UI pulses.

3. **`systemStatus`**
   - **Trigger:** Sent when a node goes offline or a master degrades.
   - **Payload:** Updated connection counts and health indicators.

4. **`processed_frame`** (Video Streaming)
   - **Trigger:** Sent continuously when a video stream is active.
   - **Payload:** Base64 encoded JPEG frame, plus ML labels (`Violence`, `Safe`) and confidence scores.
   - **Action:** Renders in the `/dashboard/perimeter` camera feeds.

---

## 4. Frontend Implementation Status

The frontend is **100% prepared** for this backend. 
- All data interfaces are strictly defined in `src/types/index.ts` to match the FastAPI schemas (e.g., `AgentResponse`, `MasterResponse`).
- `src/services/apiService.ts` contains all the fetching logic with proper URLs, query parameter construction, and error handling.
- Development fallback mocks are currently in place inside `apiService.ts`. Once the `NODE_ENV` is set to production (or you remove the mock condition), the frontend will seamlessly route requests directly to your FastAPI backend.

---

## 5. Backend Implementation Verification

The FastAPI backend in `NISHA_SENTINEL/Backend` has been fully verified and already implements all required endpoints:
- **System Service** (`src/nisha/api/v1/system.py`): Implements `/status` correctly routing through to connection managers and DB for accurate node and websocket counts.
- **Master Service** (`src/nisha/api/v1/masters.py`): All routes including `/rebalance` with agent list hydration are fully functional.
- **Topology Service** (`src/nisha/api/v1/topology.py`): Implements graph generation, summary, and optimization routines.
- **Agent Service** (`src/nisha/api/v1/agents.py`): Implements listing, updates, config injection, logging, and command dispatch perfectly aligning with the dashboard requirements.