# NISHA Master Integration & Relay Guide

This guide details the architecture of the NISHA Master Node and the exact steps required to integrate new agents (Hardware or Mobile) into the ecosystem.

## 1. Architectural Overview

The Master Node acts as a **Protocol Gateway** and **Data Relay**. It shields the Central Backend from raw hardware protocols and provides a local "Point of Presence" for agents in the field.

### Dual-Path Integration
Agents MUST perform two distinct actions to be fully functional:
1.  **Registration (REST/HTTP)**: To create an entry in the Central Database and assign capabilities.
2.  **Telemetry Link (WebSocket)**: To provide real-time status and stream binary data.

---

## 2. Step 1: Registration (HTTP Relay)

New agents must register via the Master's REST API. The Master proxies this request to the Central Backend and injects the necessary Authorization tokens.

- **Endpoint**: `POST http://<master-ip>:8080/api/v1/agents`
- **Payload**:
```json
{
  "agent_id": "YOUR_UNIQUE_ID",
  "master_id": "MASTER_001",
  "hardware_type": "ESP32-S3",
  "capabilities": {
    "audio": true,
    "video": false,
    "gps": true
  }
}
```
- **Relay Logic**: The Master captures this, adds `Authorization: Bearer NISHA-M1`, and sends it to the central backend. The agent receives a `201 Created` response.

---

## 3. Step 2: Telemetry Link (WebSocket)

Once registered, the agent connects to the Master's high-speed ingestion port.

- **URL**: `ws://<master-ip>:8082/` (Note: Connect to the root path).
- **Mandatory Handshake**: Immediately after connecting, send this JSON:
```json
{
  "type": "HANDSHAKE",
  "agent_id": "YOUR_UNIQUE_ID",
  "mode": "AGENT"
}
```

---

## 4. Step 3: Staying Online (Heartbeats)

To prevent the Backend's `HeartbeatMonitor` from marking the agent as `DEGRADED` or `OFFLINE`, you MUST:

1.  **Sync Time (NTP)**: Ensure your agent's internal clock is synced via NTP. Frames with `1970-01-01` timestamps are rejected by the backend.
2.  **Send JSON Heartbeats**: Every 20-30 seconds, send:
```json
{
  "type": "HEARTBEAT",
  "agent_id": "YOUR_UNIQUE_ID",
  "battery": 95,
  "rssi": -60
}
```

---

## 5. Step 4: Binary Data (Enrichment Relay)

When the Master receives a Binary Frame, it performs **Relay Enrichment**:

1.  **Extraction**: It reads the 24-byte header.
2.  **Injection**: It parses the metadata and injects the `agent_id` into it.
3.  **Relay**: It re-packs the frame and sends it over the Master's persistent link to the Backend.

**Stream Priorities**:
- `0x01` (LITE): Telemetry/Alerts.
- `0x02` (VIDEO): H.264/JPEG Clips.
- `0x03` (AUDIO): **Continuous Stream**. (Master wraps raw PCM in WAV for the dashboard).
- `0x04` (LOCATION): GPS JSON.

---

## 6. Common Issues & Critical Fixes

### 6.1 The "Scope Crash" Fix
**Issue**: Master disconnects agents immediately after handshake with error: `cannot access local variable 'json'`.
**Fix**: Ensure `import json` is at the **top** of the file, not inside functions. Python's compiler treats any name assigned inside a function as local for the entire scope, which "shadows" the global import if it appears later in the code.

### 6.2 The "Jump to Case" Error
**Issue**: Arduino IDE fails to compile `switch` statements with variable declarations.
**Fix**: Wrap the content of the `case` block in curly braces `{ }` to define a local scope for variables like `String handshake`.

### 6.3 The "Degraded" State
**Issue**: Agent shows up but status is red/yellow.
**Fix**: Verify NTP sync. The Backend calculates "Missed Heartbeats" based on the timestamp *inside* the binary frames. If the timestamp is wrong, the backend thinks the agent is silent.
