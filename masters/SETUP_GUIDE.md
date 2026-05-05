# NISHA Sentinel: System Setup & Operations Guide

This document outlines the complete procedure to install, configure, and start the NISHA Sentinel system on a fresh environment. It covers both the **Backend API** (Central Server) and the **Master Node** (Edge Relay Hub).

---

## 1. Backend Server Setup
The Backend server processes AI computer vision (YOLO/Torch), handles central routing via WebSockets, and stores telemetry in PostgreSQL & Redis.

### Prerequisites
- Python 3.10 or 3.11
- PostgreSQL (running locally or remotely)
- Redis (running locally or remotely)

### Installation Steps

1. **Clone the repository and navigate to the backend directory:**
   ```bash
   cd path/to/nisha_backend
   ```

2. **Set up a Python Virtual Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```

3. **Install Dependencies:**
   Ensure you have your requirements file or `pyproject.toml` available.
   ```bash
   pip install --upgrade pip
   pip install fastapi uvicorn[standard] psycopg2-binary sqlalchemy redis torch torchvision ultralytics websockets
   # Alternatively: pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the root of the backend directory.
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/nisha_db
   REDIS_URL=redis://localhost:6379/0
   ```

5. **Run Database Migrations:**
   ```bash
   # If using Alembic:
   alembic upgrade head
   ```

### Running the Backend

Start the FastAPI application via Uvicorn:
```bash
# Ensure virtual environment is active
source .venv/bin/activate

# Start the server (assuming main app is in main.py)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*The backend is now listening for incoming Master Node connections at `ws://<backend_ip>:8000/api/v1/ws/realtime`.*

---

## 2. Master Node Setup (Raspberry Pi / Edge Device)
The Master Node receives high-speed binary streams from ESP32 camera agents, buffers data locally if the backend disconnects, and streams telemetry/video up to the central backend.

### Prerequisites
- Python 3.11+

### Installation Steps

1. **Navigate to the Master Node directory:**
   ```bash
   cd path/to/nisha_master
   ```

2. **Set up a Python Virtual Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Dependencies:**
   The project uses `pyproject.toml`. You can install the project in editable mode.
   ```bash
   pip install --upgrade pip
   pip install -e .
   ```

4. **Configure Environment Variables:**
   By default, the Master Node uses `pydantic-settings`. Create a `.env` file (or export variables) to override defaults:
   ```env
   MASTER_ID=MASTER_001
   BACKEND_WS_URL=ws://<BACKEND_IP>:8000/api/v1/ws/realtime
   AGENT_WS_PORT=8081
   DASHBOARD_PORT=80
   ```
   *(Note: Binding to port 80 requires root privileges on Linux. You may want to change `DASHBOARD_PORT` to `8080` if running as a standard user).*

### Running the Master Node

Start the Master Node application:
```bash
# Ensure virtual environment is active
source .venv/bin/activate

# Start the Master Node (it will launch Uvicorn internally)
python -m src.nisha_master.main
```

### Expected Startup Behavior
When the Master Node starts, it will:
1. Start the **Local UI Dashboard** (FastAPI) on the configured `DASHBOARD_PORT` (e.g., `http://localhost:80`).
2. Open the **Agent WebSocket Server** on `AGENT_WS_PORT` (e.g., `ws://0.0.0.0:8081`) to receive ESP32 streams.
3. Automatically connect to the **Backend Server** (e.g., `ws://<BACKEND_IP>:8000/...`).

---

## 3. Simulating Traffic (Optional Testing)
To verify that the Master Node correctly ingests data without needing physical ESP32s:

1. Open a new terminal and activate the Master Node virtual environment.
2. Run the ESP32 Simulator script:
   ```bash
   python simulate_agents.py
   ```
3. Watch the Master Node logs to confirm agents connect and data flows to the Backend. Open the Master Node Local UI to view real-time ingestion metrics.