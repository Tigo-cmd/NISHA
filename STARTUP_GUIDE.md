# NISHA SENTINEL - Startup Guide

This document contains all the commands required to start the various components of the NISHA Telemetry and Surveillance system.

## 1. Central Backend (FastAPI)
The backend manages the database, WebSocket routing, and AI processing logic.

```bash
cd Backend
# Activate virtual environment
source .venv/bin/bin/activate  # Adjust path if needed
# Run the server with reload enabled
python3 -m uvicorn nisha.main:app --host 0.0.0.0 --port 8080 --reload
```
*   **URL**: `http://localhost:8080`
*   **API Docs**: `http://localhost:8080/docs`

---

## 2. Tactical Dashboard (Next.js)
The frontend visualization for real-time telemetry, mapping, and topology.

```bash
cd Frontend
# Install dependencies (if first time)
npm install
# Start development server
npm run dev
```
*   **URL**: `http://localhost:3000`

---

## 3. NISHA Master Node
The Master Node acts as a bridge between agents and the backend.

```bash
cd masters
# Activate virtual environment
source .venv/bin/activate
# Run the master node
python3 src/main.py
```
*   **Note**: Ensure the Backend is running first so the Master can establish a WSS link.

---

## 4. NISHA Mobile Agent (Expo)
The agent software running on mobile devices or simulated environments.

```bash
cd Nisha-mobile-agent/frontend
# Start Expo development server
npx expo start
```
*   **Note**: Use the Expo Go app on your phone to scan the QR code, or press `a` for Android / `i` for iOS simulators.

---

## Service Dependencies & Port Mapping
| Service | Port | Description |
| :--- | :--- | :--- |
| Backend | 8080 | Core API & WS Hub |
| Frontend | 3000 | Main Dashboard UI |
| Master (Agent Port) | 8888 | Inbound Agent WebSocket |
| Master (Dashboard) | 5000 | Local Master UI (Optional) |
| Expo Metro | 8081 | Mobile Bundler |

## Environment Variables
Ensure the following files are configured with correct API keys and URLs:
- `Backend/.env`: Database URLs and JWT secrets.
- `Frontend/.env.local`: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.
- `Nisha-mobile-agent/frontend/.env`: `BACKEND_URL` (pointing to Master Node IP).
