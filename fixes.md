# System Fixes Log - May 9, 2024

## 1. Agora Video Pipeline Stability
- **Issue**: `INVALID_OPERATION: Can't subscribe stream in CONNECTING state` and `WS_ABORT: LEAVE`.
- **Fix**: 
    - Implemented an `isMounted` guard in `AgoraVideoPlayer.tsx` to ensure async operations stop if the component unmounts.
    - Added a `connection-state-change` listener to handle auto-subscription of users who were already in the channel before the client fully connected.
    - Wrapped Agora `subscribe` calls in try/catch blocks to gracefully handle remote users leaving mid-handshake.

## 2. API connectivity & CORS Resolution
- **Issue**: "Failed to fetch" errors on the Frontend dashboard when calling `https://api.buildwave.pro`.
- **Fix**:
    - **Frontend**: Updated `src/services/apiService.ts` to use the correct `API_BASE_URL` from environment variables, defaulting to the production API.
    - **Backend**: Modified `Backend/src/nisha/main.py` to allow `allow_origins=["*"]`. Previously, it was blocking non-development origins, which included `localhost:3000` when the backend was in production mode.

## 3. Database Schema Mismatch (Audio Events)
- **Issue**: `asyncpg.exceptions.UndefinedColumnError: column audio_events.audio_data does not exist` causing 500 errors on audio telemetry.
- **Fix**:
    - Identified that the ORM model in `models.py` included `audio_data`, but the previous migration (`002_audio_support`) omitted it.
    - Generated a new Alembic migration `cd0de5acf638` (`add_audio_data_to_audio_events`).
    - Successfully ran `alembic upgrade head` to sync the physical database schema with the application models.
    - Added `video_data` to the `video_events` table as well to prevent similar future errors.

## 4. Multi-Master Routing
- **Issue**: Frontend was hardcoded to a single master node for Agora tokens.
- **Fix**: 
    - Updated `apiService.ts`, `VideoStream.tsx`, and `AgentDrawer.tsx` to dynamically resolve the `masterUrl` based on the agent's `masterId`.

## 5. Agora Stream Toggling (Mobile Agent)
- **Issue**: Mobile agent was publishing audio/video even when toggled off, consuming battery and bandwidth.
- **Fix**:
    - Modified `HiddenCamera.tsx` to use `enableLocalVideo(sensors.video)` and `enableLocalAudio(sensors.audio)`.
    - This releases hardware resources when sensors are disabled.
    - Updated `joinChannel` logic to respect initial sensor state for publishing tracks.

## 6. Dashboard UI Cleanup & Audio Control
- **Issue**: Mock alerts were cluttering the main dashboard and drawer; no user control for Agora audio.
- **Fix**:
    - **UI Cleanup**: Removed mock "Recent Events" and "Event History" from `AgentDrawer.tsx` to leave space for real AI events.
    - **Audio Control**: Added a mute/unmute toggle button to `AgoraVideoPlayer.tsx`.
    - **Reliability**: Implemented a side-effect in `AgoraVideoPlayer` to ensure remote audio tracks are played/stopped immediately when the user toggles the mute button, bypassing browser auto-play restrictions.
