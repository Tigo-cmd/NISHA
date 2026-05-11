"""NISHA Agent Traffic Simulator.

Generates concurrent traffic to test the Master Node's 
binary parsing, buffering, and dashboard metrics.
Updated for the 24-byte header and JSON handshakes.
"""
import asyncio
import os
import struct
import time
import random
import json
import websockets

# NISHA 24-byte Header Format:
# magic(2s), ver(B), type(B), prio(B), res(B), seq(I), ts(Q), payload_len(I), meta_len(H)
FRAME_HEADER_FORMAT = "!2sBBBB I Q I H"
WS_URL = "ws://localhost:8082"

async def simulate_agent(agent_id: str, agent_type: str = "MOBILE", fps: int = 5, payload_kb: int = 50):
    """Simulates a single agent sending periodic frames."""
    try:
        async with websockets.connect(WS_URL) as ws:
            print(f"[{agent_id}] Connected as {agent_type}.")

            # 1. JSON Handshake
            handshake = {
                "type": "HANDSHAKE",
                "agent_id": agent_id,
                "agent_type": agent_type,
                "mode": "AGENT",
                "device_info": {
                    "model": "Simulated Device",
                    "os_version": "v1.0"
                }
            }
            await ws.send(json.dumps(handshake))

            seq = 0
            rssi = -50
            battery = 100

            while True:
                # Drift RSSI and battery slightly
                rssi = max(-95, min(-30, rssi + random.randint(-2, 2)))
                if random.random() < 0.05:
                    battery = max(0, battery - 1)

                # Prepare payload and metadata
                payload_size = payload_kb * 1024
                dummy_payload = os.urandom(payload_size)
                
                meta = {"format": "jpeg", "simulated": True}
                meta_bytes = json.dumps(meta).encode('utf-8')
                meta_len = len(meta_bytes)

                # Pack the 24-byte header
                header = struct.pack(
                    FRAME_HEADER_FORMAT,
                    b"NI",           # magic
                    0x01,            # version
                    0x02,            # stream_type: 0x02 (Video)
                    0x01,            # priority: 1 (High)
                    0x00,            # reserved
                    seq,             # sequence
                    int(time.time() * 1000), # timestamp (ms)
                    payload_size,    # payload_len
                    meta_len         # meta_len
                )

                # Send binary frame
                frame = header + meta_bytes + dummy_payload
                await ws.send(frame)

                # Send a separate location frame occasionally (0x04)
                if seq % 10 == 0:
                    loc = {"lat": 6.45, "lng": 3.39} # Lagos, Nigeria
                    loc_payload = json.dumps(loc).encode('utf-8')
                    loc_header = struct.pack(
                        FRAME_HEADER_FORMAT,
                        b"NI", 0x01, 0x04, 0x00, 0x00, seq, int(time.time() * 1000), len(loc_payload), 0
                    )
                    await ws.send(loc_header + b"" + loc_payload)

                seq += 1
                await asyncio.sleep(1.0 / fps)

    except Exception as e:
        print(f"[{agent_id}] Disconnected: {e}")

async def main():
    print("Starting NISHA simulation...")
    # Simulate a mix of mobile and hardware agents
    agents = [
        simulate_agent("SIM_MOBILE_001", "MOBILE", fps=2, payload_kb=30),
        simulate_agent("SIM_HARDWARE_001", "HARDWARE", fps=10, payload_kb=50),
        simulate_agent("SIM_LEGACY_001", "LEGACY", fps=1, payload_kb=10)
    ]
    await asyncio.gather(*agents)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
