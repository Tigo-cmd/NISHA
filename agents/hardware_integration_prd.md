# NISHA Hardware Integration & Protocol Specification (v2.0)

## 1. Executive Summary
This document defines the integration between NISHA Hardware Agents (ESP32-S3/CAM) and the NISHA Master Node. It serves as the source of truth for both Firmware Engineering (C++) and Backend Engineering (Python) to ensure protocol parity.

---

## 2. Protocol Specification: The NISHA Binary Frame
To minimize overhead on ESP32, all communication (except initial handshake) uses a packed binary frame.

### 2.1 The Fixed Header (24 Bytes)
The header is Big-Endian (`!`) and packed with no padding.

| Offset | Size | Type | Name | Description |
| :--- | :--- | :--- | :--- | :--- |
| 0 | 2 | `char[2]` | Magic | Must be "NI" (0x4E 0x49) |
| 2 | 1 | `uint8` | Version | Protocol version (current: 1) |
| 3 | 1 | `uint8` | Type | 0x01: LITE, 0x02: VIDEO, 0x03: AUDIO, 0x04: GPS |
| 4 | 1 | `uint8` | Priority | 0: Normal, 1: High (Alert) |
| 5 | 1 | `uint8` | Reserved | Padding (set to 0) |
| 6 | 4 | `uint32` | Sequence | Incremental counter for packet loss detection |
| 10 | 8 | `uint64` | Timestamp | Milliseconds since epoch or boot time |
| 18 | 4 | `uint32` | Payload Len | Length of the raw data (bytes) |
| 22 | 2 | `uint16` | Meta Len | Length of the JSON metadata string |

### 2.2 Frame Structure
`[Header (24B)] + [Metadata (JSON String)] + [Payload (Raw Bytes)]`

---

## 3. Integration Lifecycle (Step-by-Step)

### Step 1: Handshake & Identity (TCP/WS)
*   **Endpoint**: `ws://<MASTER_IP>:8082/`
*   **Action**: Hardware agent connects and immediately sends its **Agent ID** (MAC Address, no colons) as a **Plain Text** message.
*   **Master Logic**: The Master maps this WebSocket connection to the Agent ID in its `active_agents` dictionary.

### Step 2: Heartbeat & Telemetry (Stream Type 0x01)
Sent every 5-10 seconds to maintain "ACTIVE" status.
*   **Type**: `0x01`
*   **Priority**: `0`
*   **Payload**: JSON String.
*   **Schema**:
    ```json
    {
      "type": "HEARTBEAT",
      "db": 42.5,
      "battery": 95,
      "rssi": -60
    }
    ```

### Step 3: Threshold Alerting (Acoustic)
Triggered by ESP32-S3 when local DSP detects sound > `ALERT_THRESHOLD`.
*   **Type**: `0x01`
*   **Priority**: `1`
*   **Payload Schema**:
    ```json
    {
      "type": "ALERT",
      "alert": "HARMFUL_SOUND",
      "db": 82.1
    }
    ```

### Step 4: Visual Relay (ESP32-CAM)
The Master Node proactively pulls from the CAM.
*   **Source**: `http://<CAM_IP>:81/stream` (MJPEG)
*   **Relay Action**: Master extracts JPEG frames, wraps them in a NISHA Header (Type `0x02`), and pushes them to the Backend.

---

## 4. Master Node Internal Architecture

### 4.1 Ingestion Workers (`HardwareIngestionWorker`)
*   **Responsibility**: Maintains persistent HTTP connections to CAM agents.
*   **Protocol Conversion**: Transparently converts `multipart/x-mixed-replace` (MJPEG) into NISHA Binary Frames.

### 4.2 WebSocket Server (`AgentWebSocketServer`)
*   **Responsibility**: Manages persistent connections from S3/Sensor agents.
*   **Frame Parsing**: 
    1.  Read 24 bytes.
    2.  Unpack header using `struct.unpack("!2sBBBB I Q I H", header)`.
    3.  Read `meta_len` + `payload_len`.
    4.  Broadcast to Backend Relay Queue.

---

## 5. Endpoints Summary

| Service | Protocol | Endpoint | Direction | Payload |
| :--- | :--- | :--- | :--- | :--- |
| **Agent Auth** | WS | `ws://master:8082/` | Inbound | Text: `AGENT_ID` |
| **Telemetry** | WS | `ws://master:8082/` | Inbound | Binary: NISHA Header + JSON |
| **Video Stream** | HTTP | `http://cam:81/stream`| Outbound | MJPEG Stream |
| **Master Relay** | WS | `ws://backend:8080/ws/realtime` | Outbound | Binary: Encapsulated NISHA |

---

## 6. Implementation Notes for Arduino (C++)
1.  **Memory Management**: Use `static` buffers for the header to avoid fragmentation.
2.  **Packing**: Use `#pragma pack(push, 1)` to ensure the struct matches the Python `struct` format exactly.
3.  **Watchdog**: Implement a connection watchdog that re-runs the Handshake (Step 1) if the WebSocket drops.
