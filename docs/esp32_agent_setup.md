# NISHA ESP32 Agent - Git Configuration

## Repository: agents/esp32_s3_agent/

### .gitignore for ESP32 Firmware

```
# Arduino/PlatformIO
.pio/
.vscode/
.idea/
*.swp
*.swo
*.sublime-workspace
*.sublime-project

# Build artifacts
build/
firmware/
*.bin
*.hex
*.elf
*.map
*.sym
*.ld
*.eep

# Debug
debug/
*.log
*.out

# OS
.DS_Store
Thumbs.db

# User secrets (WiFi credentials in source - BAD)
# NOTE: Move these to config.h or env vars before committing!
secrets.h
config_local.h

# Temporary
tmp/
temp/
*.tmp
```

### Commit Message Template for ESP32 Firmware

```
type: scope (short description)

Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:    Code formatting (no logic change)
refactor: Restructuring
perf:     Performance/power optimization
test:     Test addition
chore:    Build system, PlatformIO config

Scopes:
i2s, wifi, ws, audio, sensor, protocol, power, ota
```

### Example Commits

```
feat(audio): implement I2S microphone capture with RMS detection
- Configures I2S driver (16kHz, 32-bit, DMA 8×512)
- Blocking read with portMAX_DELAY
- RMS calculation + dB conversion (20*log10)
- Threshold alert: >70dB sends LITE frame with "HARMFUL_SOUND"

fix(ws): improve WebSocket reconnection robustness
- Increase reconnect interval to 5s (was 1s flooding)
- Add isConnected guard before sendNishaFrame
- Prevents crash on send during disconnect window

refactor(protocol): pack NISHA header with pragma pack(1)
- Ensures no padding bytes between struct fields
- Matches Python struct.pack('!2sBBBB I Q I H') format
- Big-endian network byte order for all multi-byte fields

perf(power): add WiFi power save mode (WIFI_PS_MIN_MODEM)
- Reduces power draw by ~30% during idle
- Trade-off: slightly higher latency on send
- Requires testing on actual hardware

docs: add pinout diagram and I2S wiring guide
- WS → GPIO15, SD → GPIO13, SCK → GPIO14
- Compatible with MAX9814, INMP441, SPH0645LM4H
- 3.3V power, I2S standard mode
```

### PlatformIO Configuration (`platformio.ini`)

```ini
[env:esp32-s3-box]
platform = espressif32
board = esp32-s3-box
framework = arduino

; ESP32-S3 Box specific
board_build.arduino.memory_type = qio_opi
board_build.flash_mode = qio
board_build.flash_size = 16MB

; USB CDC (Serial)
monitor_port = /dev/ttyUSB0
monitor_speed = 115200
monitor_filters = default,esp32_exception_decoder

; Build flags
build_flags =
    -DCORE_DEBUG_LEVEL=0
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue

; Libraries
lib_deps =
    ArduinoJson @ ^6.21.3
    WebSockets @ ^2.4.1

; Upload
upload_protocol = esptool
upload_speed = 921600
```

### Required Libraries (`lib/`)

Place `.json` dependency files in `lib/` folder if using PlatformIO:

```
lib/
├── ArduinoJson/
│   └── library.json  (version: 6.21.3)
└── WebSockets/
    └── library.json  (version: 2.4.1)
```

### Wiring Diagram

```
ESP32-S3-Box Pinout:
┌─────────────────────────────────────┐
│  MICROPHONE (I2S)                   │
│  ┌─────────────┐  ┌─────────────┐   │
│  │  MAX9814    │  │  ESP32-S3   │   │
│  │  (or similar)│  │  Box        │   │
│  ├──────┬──────┤  ├──────┬──────┤   │
│  │  VCC │ 3.3V │  │       │      │   │
│  │  GND │ GND  │  │       │      │   │
│  │  SD  │ ---> │───► GPIO13 (I2S_SD) │
│  │  WS  │ ---> │───► GPIO15 (I2S_WS) │
│  │  SCK │ ---> │───► GPIO14 (I2S_SCK)│
│  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────┘
```

### Flashing Instructions

```bash
# 1. Install PlatformIO Core
pip install platformio

# 2. Build and upload
cd agents/esp32_s3_agent
pio run -e esp32-s3-box -t upload
pio run -e esp32-s3-box -t monitor  # Serial monitor at 115200

# OR using Arduino IDE:
# - Open main.cpp in Arduino IDE
# - Select board: ESP32-S3 Box
# - Select port: /dev/ttyUSB0
# - Upload
```

### Environment Configuration (BEFORE COMMIT)

**IMPORTANT**: Do NOT commit hardcoded WiFi credentials and API keys!

Create `config.h` (gitignored) or use define overrides:

```cpp
// config.h (NOT committed)
#pragma once

// WiFi
#define WIFI_SSID "your-network"
#define WIFI_PASSWORD "your-password"

// Master Node
#define MASTER_HOST "192.168.1.155"
#define MASTER_PORT 8082

// Security
#define API_KEY "change-me-to-secure-key"

// Agent identity
#define AGENT_ZONE "Perimeter North"
```

Then in `main.cpp`:

```cpp
#include "config.h"  // Local overrides, not in repo
#ifndef WIFI_SSID
  #define WIFI_SSID "CLICKNETWORKS"
  #define WIFI_PASSWORD "hotguy112345"
#endif
```

### Future Enhancements (TODO)

- [ ] **OTA Updates**: HTTP(S) firmware download + ESP32 OTA partition
- [ ] **Command handling**: Parse inbound JSON (REBOOT, UPDATE_CONFIG, FLIP_CAMERA)
- [ ] **Power management**: Deep sleep between audio samples, WiFi power save
- [ ] **Battery monitoring**: ADC reads on voltage divider (if battery-powered)
- [ ] **TLS encryption**: WSS instead of WS (bearssl or mbedtls)
- [ ] **Configuration API**: Fetch config from master on connect
- [ ] **Calibration**: Audio dB offset calibration per microphone
- [ ] **Multi-sensor**: Add PIR motion, temperature, humidity (DHT22)
- [ ] **Mesh networking**: ESP-NOW for agent-to-agent relay
- [ ] **GPSmodule**: NEO-6M/8M integration for standalone location

---

Generated by Kilo CLI analysis. Source: `agents/esp32_s3_agent/src/main.cpp`

Binary Protocol Reference: `Backend/src/nisha/infrastructure/websocket/protocol.py`
