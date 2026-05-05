import cv2
import time
import base64
import json
import asyncio
import aiohttp
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Master-Ingestion-Manager")

class ESP32Worker:
    def __init__(self, agent_id, stream_url, master_ws_url):
        self.agent_id = agent_id
        self.stream_url = stream_url
        self.master_ws_url = master_ws_url
        self.is_running = False

    async def start(self):
        self.is_running = True
        logger.info(f"Connecting to ESP32: {self.agent_id} at {self.stream_url}")
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.ws_connect(self.master_ws_url) as ws:
                    # Identify to master
                    await ws.send_str(self.agent_id)
                    
                    cap = cv2.VideoCapture(self.stream_url)
                    while self.is_running:
                        ret, frame = cap.read()
                        if not ret:
                            await asyncio.sleep(1)
                            continue

                        # Encode JPEG for NISHA Pipeline
                        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                        jpg_text = base64.b64encode(buffer).decode('utf-8')

                        await ws.send_json({
                            "type": "VIDEO_FRAME",
                            "agent_id": self.agent_id,
                            "data": jpg_text,
                            "timestamp": time.time()
                        })
                        await asyncio.sleep(0.1) # 10 FPS
                    cap.release()
            except Exception as e:
                logger.error(f"Worker for {self.agent_id} failed: {e}")

class IngestionManager:
    def __init__(self, backend_url, master_id, master_ws_url):
        self.backend_url = backend_url
        self.master_id = master_id
        self.master_ws_url = master_ws_url
        self.active_workers = {}

    async def discover_and_run(self):
        logger.info(f"Manager started. Searching for agents assigned to {self.master_id}...")
        async with aiohttp.ClientSession() as session:
            while True:
                try:
                    # Query backend for ESP32 agents assigned to this master
                    async with session.get(f"{self.backend_url}/agents?master_id={self.master_id}") as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            agents = data.get("items", [])
                            
                            for agent in agents:
                                agent_id = agent["agent_id"]
                                stream_url = agent.get("stream_url")
                                
                                if agent.get("hardware_type") == "ESP32-CAM" and stream_url:
                                    if agent_id not in self.active_workers:
                                        worker = ESP32Worker(agent_id, stream_url, self.master_ws_url)
                                        self.active_workers[agent_id] = asyncio.create_task(worker.start())
                                        logger.info(f"Found and started new worker for {agent_id}")
                except Exception as e:
                    logger.error(f"Discovery failed: {e}")
                
                await asyncio.sleep(10) # Poll for new hardware every 10s

if __name__ == "__main__":
    # CONFIGURATION
    BACKEND = "http://192.168.1.155:8081/api/v1"
    MASTER_ID = "MASTER_001"
    MASTER_WS = "ws://localhost:8082" # Local Master WebSocket Port
    
    manager = IngestionManager(BACKEND, MASTER_ID, MASTER_WS)
    asyncio.run(manager.discover_and_run())

