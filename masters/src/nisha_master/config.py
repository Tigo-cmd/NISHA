"""Pydantic configuration management for the Master Node.

Loads from environment variables with safe defaults for Raspberry Pi 4.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    app_name: str = "NISHA_MASTER"
    master_id: str = "MASTER_001"  # Unique ID for this Pi
    debug: bool = False

    # Interfaces
    agent_ws_port: int = 8082      # Agent inbound
    dashboard_port: int = 8080      # Local UI (FastAPI)

    # Backend Link
    backend_ws_url: str = "wss://api.buildwave.pro/api/v1/ws/realtime"
    backend_http_url: str = "https://api.buildwave.pro/api/v1/master/sync"
    backend_base_url: str = "https://api.buildwave.pro"
    backend_auth_token: str = "NISHA-M1"

    # Hardware & Buffering Targets
    buffer_ram_limit_mb: int = 1024npm config set registry https://registry.npmmirror.com
    buffer_disk_dir: str = "/tmp/nisha_buffer"
    target_latency_ms: int = 50

    # Triangulation
    rssi_path_loss_exponent: float = 2.5
    rssi_reference_power: float = -45.0  # RSSI at 1 meter

    # Hardware Agents (ESP32-CAM, etc)
    # List of dicts: [{"id": "CAM_01", "url": "http://192.168.1.115:81/stream", "type": "VIDEO"}]
    hardware_agents: list[dict] = [
        {"id": "ESP32-CAM-01", "url": "http://192.168.1.115:81/stream", "type": "VIDEO"}
    ]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
