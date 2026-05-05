# NISHA Sentinel: System Operations & Orchestration Guide

This guide provides the exact steps to start the complete NISHA Sentinel ecosystem. Follow these steps in order to ensure stable data flow through the hierarchy.

## 1. System Hierarchy
Data flows through the following pipeline:
**Mobile Agent** (Port 8081) → **Master Node** (Port 8000) → **Sentinel Backend** (Port 3000) → **Web Dashboard**

---

## 2. Startup Sequence

### Step 1: Central Sentinel Backend
The backend must start first to receive Master connections.
- **Location**: `Backend/`
- **Setup**: Ensure `.venv` is installed.
- **Command**:
  ```bash
  cd Backend
  export PYTHONPATH=$PYTHONPATH:$(pwd)/src
  .venv/bin/python3 -m uvicorn nisha.main:app --host 0.0.0.0 --port 8000
  ```
- **Verification**: Look for `nisha_sentinel.started` and "Started 4 priority queue workers" in the logs.

### Step 2: Master Node (Edge Relay)
Connects to the Backend and waits for Agent binary streams.
- **Location**: `masters/`
- **Setup**: Ensure `.venv` is installed.
- **Command**:
  ```bash
  cd masters
  export PYTHONPATH=$PYTHONPATH:$(pwd)/src
  .venv/bin/python3 -m nisha_master.main
  ```
- **Verification**: Look for "Connected to Backend successfully" and "Agent WS Server listening on port 8081".

### Step 3: Web Dashboard (Frontend)
Displays the real-time intelligence gathered by the Sentinel.
- **Location**: `Frontend/`
- **Setup**: Requires `node_modules`.
- **Command**:
  ```bash
  cd Frontend
  npm run dev
  ```
- **Access**: Visit `http://localhost:3000/dashboard` in your browser.
- **Note**: Ensure `.env.local` has `NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/ws/realtime`.

### Step 4: Mobile Agent (Sensor)
The source of video, audio, and telemetry data.
- **Location**: `Nisha-mobile-agent/frontend/`
- **Command**:
  ```bash
  cd Nisha-mobile-agent/frontend
  npx expo start
  ```
- **Connection**: It will automatically connect to the Master on port `8081` using the `EXPO_PUBLIC_BACKEND_URL` hostname.

---

## 3. Key Configuration Points

| Component | Setting File | Key Variable | Value |
|-----------|--------------|--------------|-------|
| **Backend** | `src/nisha/config.py` | `server_port` | `8000` |
| **Master** | `src/nisha_master/config.py` | `backend_ws_url` | `ws://localhost:8000/api/v1/ws/realtime` |
| **Master** | `src/nisha_master/config.py` | `agent_ws_port` | `8081` |
| **Mobile** | `.env` | `EXPO_PUBLIC_BACKEND_URL` | `http://<MASTER_IP>:8000` |

---

## 4. Protocol Specifics
- **Handshake**: The Mobile Agent sends a simple string (its `agent_id`) upon connecting to the Master.
- **Binary Format**: 22-byte `NISHAFrame` header + JSON metadata + Data Payload.

## 5. Troubleshooting
- **Handshake Timeout**: Usually means the Master isn't running or the IP is incorrect in the Mobile Agent's `.env`.
- **WebSocket Error {}**: Check that the `NEXT_PUBLIC_WS_URL` in the Dashboard Exactly matches the Backend endpoint (`/api/v1/ws/realtime`).
- **Python Module Errors**: Always ensure `PYTHONPATH` includes the `src` directory of the respective service.
