# NISHA Mobile Agent - Git Configuration

## Repository: Nisha-mobile-agent/

### .gitignore for Mobile Agent

```
# Dependencies
node_modules/
.expo/
.expo-shared/

# Build outputs
*.jsbundle
*.ipa
*.apk
*.aab
app.*.js
web-build/

# Metro
.metro-health-check*

# Debug
npm-debug.*
yarn-debug.*
yarn-error.*

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Expo
.expo/
dist/
web-doc/
.expo-shared/

# Cache
.expo-cached/

# Temporary files
tmp/
temp/
*.tmp

# Android
android/.gradle/
android/.idea/
android/build/
android/captures/
android/.cxx/
android/local.properties
android/*.iml
android/*.keystore
!android/**/*.gradle

# iOS
ios/build/
ios/Pods/
ios/*.xcworkspace
ios/*.xcodeproj
ios/*.mode1v3
ios/*.mode2v3
ios/*.moved-aside
ios/*.pbxuser
ios/*.perspectivev3
ios/*sync/
ios/.sconsign.dblite
ios/*.hmap
ios/*.ipa
ios/.xcode.env

# TypeScript
*.tsbuildinfo

# EAS
.eas/
```

### Commit Message Template for Mobile Agent

```
type: scope (short description)

Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:     (UI/styling only)
refactor:  Code restructuring
perf:     Performance optimization
test:     Tests
chore:    Build, CI, dependencies
infra:    EAS Build, deployment config

Scopes:
camera, audio, location, stream, ws, sensor, ui, navigation,
store, permissions, background, protocol
```

### Example Commits

```
feat(stream): implement continuous video clip streaming
- Adds StreamManager singleton with exponential reconnection
- HiddenCamera component (off-screen CameraView)
- 3-second MP4 clips, base64 encoded, binary WS send
- NISHAFrame protocol implementation (TypeScript)

fix(permissions): request camera/mic on first toggle
- Previously crashed if permission denied on app start
- Now lazy-requests on first sensor enable
- Handles denial gracefully (shows rationale dialog)

feat(location): background GPS tracking with foreground service
- Uses expo-task-manager for Android background updates
- Foreground service notification required
- Sends location every 2s while foreground, 5-10s background
- Respects "Always Allow" permission

refactor(store): consolidate agent and mode stores
- useAgentStore: agentId, status, sensors, detections, battery
- useModeStore: fixed to AGENT mode (master mode disabled)
- Hydration from AsyncStorage before mode selection

perf(audio): optimize AAC encoding, reduce file size
- Lower bitrate from 128kbps → 64kbps
- Mono channel (was stereo)
- 22kHz sample rate (still clear for speech)
- Reduces upload time by ~40%
```

### Branch Strategy

```
main      → Production releases (Expo EAS)
develop   → Integration
feature/* → feat/background-location, feat/audio-streaming
bugfix/*  → fix/camera-permissions
release/* → Release candidates
```

### EAS Build Configuration (`eas.json`)

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production": {
      "ios": {
        "workflow": "generic"
      },
      "android": {
        "gradleCommand": ":app:assembleRelease"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### app.json (Expo Configuration)

```json
{
  "expo": {
    "name": "NISHA Sentinel Agent",
    "slug": "nisha-agent",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0A0F"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "bundleIdentifier": "com.nisha.sentinel.agent",
      "infoPlist": {
        "UIBackgroundModes": ["audio", "location"],
        "NSCameraUsageDescription": "NISHA Sentinel uses camera for visual threat detection.",
        "NSMicrophoneUsageDescription": "NISHA Sentinel uses microphone for audio threat detection.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "NISHA Sentinel uses location for geofencing and agent positioning."
      },
      "supportsTablet": true
    },
    "android": {
      "package": "com.nisha.sentinel.agent",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A0A0F"
      },
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ],
      "usesCleartextTraffic": true  // For local dev (WS not WSS)
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-camera",
        { "cameraPermission": "Allow NISHA to use your camera for surveillance." }
      ],
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow NISHA to use your location."
        }
      ]
    ],
    "newArchEnabled": true
  }
}
```

### Environment Variables

`.env`:

```bash
# Backend Master Node URL (HTTP API)
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.155:8000

# Optional: Override WebSocket URL (auto-derived from BACKEND_URL)
# EXPO_PUBLIC_WS_URL=ws://192.168.1.155:8082
```

### Development Setup

```bash
cd Nisha-mobile-agent/frontend
npm install
npx expo start  # Scan QR with Expo Go, or press a/i for simulator
```

### Architecture Notes

- **Framework**: React Native via Expo SDK 54
- **Router**: expo-router (file-based, Stack navigator)
- **State**: Zustand (persisted with AsyncStorage)
- **Streaming**: WebSocket binary with NISHAFrame protocol
- **Camera**: expo-camera (hidden off-screen, continuous 3s clips)
- **Audio**: expo-av (AAC 22kHz, 64kbps, looping 10s recordings)
- **Location**: expo-location with background task (Android foreground service)
- **Permissions**: Lazy request on first sensor toggle
- **Platform**: iOS + Android (managed workflow, no custom native code)

### Important Files

```
app/
├── _layout.tsx          Root Stack Navigator
├── index.tsx            Splash → mode selection
├── agent.tsx            Main dashboard (sensor controls, stats)
├── activity.tsx         Detection history list
└── settings.tsx         Configuration, device info

src/
├── services/
│   ├── StreamManager.ts    # WebSocket connection, video loop, reconnection
│   ├── AudioManager.ts     # Audio recording (10s AAC clips)
│   └── LocationManager.ts  # GPS + background task
├── store/
│   ├── useAgentStore.ts    # agentId, status, sensors, detections, battery
│   └── useModeStore.ts     # AppMode (AGENT only currently)
├── components/
│   ├── HiddenCamera.tsx    # Off-screen CameraView
│   ├── SensorRow.tsx       # Toggleable sensor control
│   ├── TopBar.tsx          # Header with battery/master
│   ├── BottomNav.tsx       # Tab navigation
│   ├── DetectionRow.tsx    # Event history item
│   └── ConfigOverlay.tsx   # Master URL config modal
├── utils/
│   └── protocol.ts         # NISHAFrame encoder (TypeScript)
└── config/theme.ts         # Dark cyberpunk color scheme
```

### NISHA Protocol (TypeScript)

`src/utils/protocol.ts`:

```typescript
export const StreamType = { TELEMETRY: 0x01, VIDEO: 0x02, AUDIO: 0x03, LOCATION: 0x04 };
export const Priority = { LOW: 0, HIGH: 1 };

export interface NISHAFrame {
  magic: string;        // "NI"
  version: number;      // 1
  streamType: number;
  priority: number;
  sequence: number;
  timestamp: number;
  payloadLen: number;
  metaLen: number;
  metadata: Record<string, any>;
  payload: Uint8Array;
}

export class NISHAFrame {
  static encode(type, priority, seq, rssi, battery, payload, metadata = {}): Uint8Array {
    // 24-byte header + JSON metadata + raw payload
    // Big-endian packing using DataView
  }
}
```

### WebSocket Connection Flow

```
1. initialize(backendUrl): wsUrl = ws://<host>:8082
2. connect(agentId):
   - new WebSocket(wsUrl)
   - onopen → send(agentId)  // Text handshake
   - Start clipLoop() if videoEnabled
   - Start locationInterval (2s)
3. clipLoop():
   while (videoEnabled && isStreaming) {
     recordClip(3s) → file URI
     readAsStringAsync(base64) → Uint8Array
     sendFrame(VIDEO, HIGH, payload)
     delete temp file
   }
4. onclose → scheduleReconnect() (exponential backoff: 1s → 16s)
```

### Limitations & TODOs

- RSSI placeholder (-50): actual WiFi signal not captured
- No accelerometer/gyroscope data
- Background video recording restricted by OS (iOS/Android)
- No mesh networking (agents talk directly to master only)
- Master mode UI exists but disabled (useModeStore forces AGENT)
- No on-device AI inference (streams raw to master for processing)

---

Generated by Kilo CLI analysis. Source: `Nisha-mobile-agent/frontend/`
