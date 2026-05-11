# NISHA Agent Integration Guide

This guide describes how to integrate a new agent (Mobile, Hardware, or AI) into the NISHA mesh network.

## 1. Protocol Architecture (Agora vs. Hyper-Relay)

NISHA uses two distinct protocols to handle the diverse needs of mobile and hardware agents:

- **Agora SDK (Mobile Only)**: Used by Mobile Agents for high-performance, low-latency RTC video/audio. Best for devices with high processing power (iOS/Android).
- **Hyper-Relay Binary Protocol (Hardware Only)**: A custom WebSocket-based binary relay. The Master Node "pulls" MJPEG frames from hardware and broadcasts them directly to the local dashboard via WebSockets.
    - **Performance**: <100ms latency on local networks.
    - **Benefit**: Bypasses browser Mixed Content (HTTPS/HTTP) blocks.

---

## 2. Dashboard Identification Logic

The system automatically routes traffic based on the Agent ID. To ensure your agent uses the correct protocol, follow these naming conventions:

| Agent Type | Identification Rule | Protocol Used |
| :--- | :--- | :--- |
| **HARDWARE** | ID is a 12-char MAC address (e.g., `A4CF12...`) | Hyper-Relay (WebSocket) |
| **HARDWARE** | ID contains `NODE`, `ESP`, or `CAM` | Hyper-Relay (WebSocket) |
| **MOBILE** | Any other ID format (e.g., `SENTINEL-1507`) | Agora RTC |

---

## 3. Connection Lifecycle

### 3.1 Handshake (JSON)
Immediately after connecting, the agent SHOULD send a JSON handshake. For hardware agents, including a `stream_url` allows the Master Node to start the Hyper-Relay immediately.

```json
{
  "type": "HANDSHAKE",
  "agent_id": "CAM-NODE-01",
  "agent_type": "HARDWARE", 
  "mode": "AGENT",
  "stream_url": "http://192.168.1.50/mjpeg",
  "device_info": { "model": "ESP32-CAM", "os": "FreeRTOS" }
}
```

---

## 4. Binary Data Schema (NISHA Protocol)

All binary data sent via WebSockets (from Agent to Master or Master to Backend) must be wrapped in the **24-byte NISHA Header**.

| Offset | Field | Size | Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| 0 | Magic | 2 | `char[2]` | Always `NI` |
| 2 | Version | 1 | `uint8` | Always `0x01` |
| 3 | Stream Type | 1 | `uint8` | `0x02`: VIDEO, `0x03`: AUDIO |
| 4 | Priority | 1 | `uint8` | `0x01`: High, `0x00`: Low |
| 6 | Sequence | 4 | `uint32` | Incrementing counter |
| 10 | Timestamp | 8 | `uint64` | Milliseconds since Epoch |
| 18 | Payload Len | 4 | `uint32` | Length of raw binary (JPEG/PCM) |
| 22 | Meta Len | 2 | `uint16` | Length of JSON metadata |

---

## 5. Troubleshooting Common Issues

### 5.1 "Awaiting Web Stream" (Mobile)
- Ensure the Mobile Agent has successfully joined the Agora channel `nisha_stream_{AGENT_ID}`.
- Check if the Agora App ID and Certificate are correctly set in the Master Node's `.env`.

### 5.2 Stream Not Visible (Hardware)
- **Check Cache**: Browsers aggressively cache the dashboard's `dashboard.js`. Increment the `?v=X` version in `index.html` to force a reload.
- **Local IP**: Ensure the Master Node can reach the hardware agent's IP over the local network.
- **Mixed Content**: Never try to load an `http` stream directly in the dashboard `img` tag if the dashboard is served over `https`. Use the WebSocket relay (`LIVE_FRAME`).
