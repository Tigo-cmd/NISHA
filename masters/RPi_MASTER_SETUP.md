# NISHA Sentinel: Raspberry Pi 4 Master Node Setup Guide

This guide provides step-by-step instructions for deploying the **NISHA Master Node** on a Raspberry Pi 4. This setup ensures high-performance relaying of sensor data from ESP32 agents to the central backend.

---

## 1. Hardware Requirements
- **Raspberry Pi 4** (4GB or 8GB RAM recommended).
- **MicroSD Card** (16GB+ Class 10).
- **Power Supply** (Official USB-C 5V 3A).
- **Network**: Ethernet preferred for stability, or 5GHz Wi-Fi.

---

## 2. OS Preparation
1. **Flash OS**: Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
   - **OS**: Raspberry Pi OS (64-bit) **Lite** (No desktop needed).
   - **Settings**: Click the gear icon to:
     - Set hostname: `nisha-master.local`
     - Enable SSH.
     - Set username/password (e.g., `nisha`/`sentinel`).
     - Configure Wi-Fi if necessary.
2. **Boot**: Insert the SD card and power on the Pi.
3. **Connect**: 
   ```bash
   ssh nisha@nisha-master.local
   ```

---

## 3. System Dependencies
Once logged into the Pi, run the following commands to update the system and install Python 3.11+:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git libatlas-base-dev
```
*`libatlas-base-dev` is required for NumPy optimizations on ARM architecture.*

---

## 4. Transferring Code to the Pi
You can transfer the `masters/` directory using `scp` from your local machine:

```bash
# Run this from your local machine (not the Pi)
cd path/to/NISHA/
scp -r masters/ nisha@nisha-master.local:~/nisha_master
```

---

## 5. Project Environment Setup
Back on the Raspberry Pi:

1. **Navigate to the directory**:
   ```bash
   cd ~/nisha_master
   ```

2. **Create Virtual Environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install --upgrade pip
   pip install -e .
   ```

---

## 6. Configuration (.env)
Create a `.env` file to configure the connection to your backend.

```bash
nano .env
```

Paste the following (update the IP addresses to match your setup):

```env
MASTER_ID=MASTER_001
# IP of your Central Backend Server
BACKEND_WS_URL=ws://<BACKEND_IP>:8000/api/v1/ws/realtime
BACKEND_HTTP_URL=http://<BACKEND_IP>:8000/api/v1/master/sync
BACKEND_BASE_URL=http://<BACKEND_IP>:8000
BACKEND_AUTH_TOKEN=NISHA-M1

# Ports for this Pi
AGENT_WS_PORT=8082
DASHBOARD_PORT=8080

# Performance
BUFFER_RAM_LIMIT_MB=1024
```

---

## 7. Persistence (Systemd Service)
To ensure the Master Node starts automatically on boot and restarts if it crashes, create a systemd service.

1. **Create the service file**:
   ```bash
   sudo nano /etc/systemd/system/nisha-master.service
   ```

2. **Paste the configuration**:
   *(Replace `/home/nisha/nisha_master` with your actual path if different)*
   ```ini
   [Unit]
   Description=NISHA Master Node Relay
   After=network.target

   [Service]
   Type=simple
   User=nisha
   WorkingDirectory=/home/nisha/nisha_master
   # Run via uvicorn for production performance
   ExecStart=/home/nisha/nisha_master/.venv/bin/python -m uvicorn nisha_master.main:app --host 0.0.0.0 --port 8080
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and Start**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable nisha-master
   sudo systemctl start nisha-master
   ```

4. **Check Status**:
   ```bash
   sudo systemctl status nisha-master
   # To view live logs:
   journalctl -u nisha-master -f
   ```

---

## 8. Verification
1. **Local UI**: Open your browser and go to `http://nisha-master.local:8080`. You should see the Master Node dashboard.
2. **Backend Connection**: Check the logs (`journalctl -u nisha-master -f`) to ensure it says "Connected to Backend".
3. **Agent Connection**: Point an ESP32 or the simulator to `ws://nisha-master.local:8082`.

---

## 9. Troubleshooting
- **Port Permission**: If you want to use port 80, you must run the service as root or use `setcap` on the python binary. It is recommended to use `8080` and use a reverse proxy (like Nginx) if port 80 is required.
- **Numpy Error**: If you see `ImportError: libatlas.so.3`, run `sudo apt install libatlas-base-dev`.
- **Latency**: Ensure the Pi is connected via Ethernet if processing multiple high-res video streams.

---

## 10. Bonus: Using mDNS (Zero-Config)
By default, Raspberry Pi OS runs `avahi-daemon`. This means you can reach your Pi at `nisha-master.local` without knowing its IP address.
- **From ESP32**: Point your agents to `ws://nisha-master.local:8082`.
- **From Browser**: Visit `http://nisha-master.local:8080`.
- **From Backend**: If the backend is on the same network, it can find the master at the same address.
