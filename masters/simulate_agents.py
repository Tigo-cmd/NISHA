"""ESP32 Traffic Simulator.

Generates concurrent traffic to test the Master Node's
binary parsing, buffering, and dashboard metrics.
"""
import asyncio
import os
import struct
import time
import random
import websockets

# Format: stream_type(B), priority(B), seq(I), ts(d), rssi(b), battery(B), payload_len(H)
HEADER_FORMAT = "!BBIdbBH"
WS_URL = "ws://localhost:8082"

async def simulate_agent(agent_id: str, fps: int = 30, payload_kb: int = 20):
    """Simulates a single ESP32 agent sending continuous video frames."""
    try:
        async with websockets.connect(WS_URL) as ws:
            print(f"[{agent_id}] Connected.")

            # 1. Simple text handshake
            await ws.send(agent_id)

            seq = 0
            rssi = -50
            battery = 100

            payload_size = payload_kb * 1024
            dummy_payload = os.urandom(payload_size)

            while True:
                # Drift RSSI and battery slightly
                rssi = max(-95, min(-30, rssi + random.randint(-2, 2)))
                if random.random() < 0.05:
                    battery = max(0, battery - 1)

                # Pack the exact 18-byte header
                header = struct.pack(
                    HEADER_FORMAT,
                    0,               # stream_type: 0 (Video)
                    1,               # priority: 1 (High)
                    seq,             # sequence
                    time.time(),     # timestamp
                    rssi,            # rssi
                    battery,         # battery
                    payload_size     # payload_len
                )

                # Send zero-copy binary frame
                frame = header + dummy_payload
                await ws.send(frame)

                seq += 1
                await asyncio.sleep(1.0 / fps)

    except Exception as e:
        print(f"[{agent_id}] Disconnected: {e}")

async def main():
    import os
    print("Starting ESP32 simulation...")
    # Simulate 5 concurrent agents
    agents = [simulate_agent(f"ESP32_{str(i).zfill(3)}", fps=30, payload_kb=50) for i in range(1, 6)]
    await asyncio.gather(*agents)

if __name__ == "__main__":
    import os
    asyncio.run(main())
