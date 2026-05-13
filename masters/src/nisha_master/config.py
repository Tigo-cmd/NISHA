"""Pydantic configuration management for the Master Node.

Loads from environment variables with safe defaults for Raspberry Pi 4.
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    app_name: str = "NISHA_MASTER"
    master_id: str = "MASTER_001"
    debug: bool = False

    # Network Mode: 'LOCAL' or 'TUNNEL'
    nisha_network_mode: str = "TUNNEL"
    nisha_backend_ip: str = "192.168.18.14" # Local IP of the machine running Backend

    # Interfaces
    agent_ws_port: int = 8082      # Agent inbound
    dashboard_port: int = 8080      # Local UI (FastAPI)

    # Backend Config
    backend_tunnel_host: str = "api.buildwave.pro"
    backend_auth_token: str = "NISHA-M1"

    @property
    def backend_base_url(self) -> str:
        if self.nisha_network_mode == "LOCAL":
            return f"http://{self.nisha_backend_ip}:8000"
        return f"https://{self.backend_tunnel_host}"

    @property
    def backend_ws_url(self) -> str:
        if self.nisha_network_mode == "LOCAL":
            return f"ws://{self.nisha_backend_ip}:8000/api/v1/ws/realtime"
        return f"wss://{self.backend_tunnel_host}/api/v1/ws/realtime"

    @property
    def backend_http_url(self) -> str:
        return f"{self.backend_base_url}/api/v1/master/sync"

    @property
    def backend_host(self) -> str:
        """Returns the IP/Host of the laptop running AI/Backend."""
        if self.nisha_network_mode == "LOCAL":
            return self.nisha_backend_ip
        return self.backend_tunnel_host

    @property
    def ai_service_url(self) -> str:
        """Full URL for transcription API."""
        return f"http://{self.backend_host}:8083/api/v1/transcribe"

    @property
    def ai_stream_url(self) -> str:
        """Full URL for real-time transcription stream."""
        return f"ws://{self.backend_host}:8083/api/v1/stream"

    # Hardware & Buffering
    buffer_ram_limit_mb: int = 1024
    buffer_disk_dir: str = "/tmp/nisha_buffer"
    target_latency_ms: int = 50

    # Triangulation
    rssi_path_loss_exponent: float = 2.5
    rssi_reference_power: float = -45.0

    hardware_agents: list[dict] = [
        {"id": "A4CF1208C4BC", "url": "http://192.168.18.20:81/stream", "type": "VIDEO"}
    ]

    # Agora Config
    agora_app_id: str = "8aab67dc71304ae595f064ea51f12082"
    agora_app_certificate: str = "4130348368c94fd2b8a008676187b394"

    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    model_config = SettingsConfigDict(env_file=_env_path, env_file_encoding="utf-8", extra="ignore")


settings = Settings()

# Startup Diagnostic
print(f"\n--- NISHA MASTER STARTUP ---")
print(f"MODE:     {settings.nisha_network_mode}")
print(f"BACKEND:  {settings.backend_base_url}")
print(f"WS URL:   {settings.backend_ws_url}")
print(f"AI URL:   {settings.ai_service_url if hasattr(settings, 'ai_service_url') else 'Default'}")
print(f"----------------------------\n")
