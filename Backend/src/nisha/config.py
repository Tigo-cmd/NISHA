from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": False}

    # Application
    app_name: str = "NISHA_SENTINEL"
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"
    secret_key: str = "change-me-to-a-random-secret-key"

    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 8000
    workers: int = 1

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://nisha:nisha_secret@127.0.0.1:5432/nisha_sentinel"
    database_pool_size: int = 20
    database_max_overflow: int = 10

    # Redis
    redis_url: str = "redis://127.0.0.1:6379/0"
    redis_heartbeat_db: int = 1

    # Authentication
    api_key: str = "change-me-to-a-secure-api-key"
    jwt_secret_key: str = "change-me-jwt-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    # Agent Defaults
    heartbeat_interval_seconds: int = 30
    heartbeat_timeout_seconds: int = 90
    max_agents_per_master: int = 50

    # WebSocket
    ws_ping_interval: int = 30
    ws_ping_timeout: int = 10

    # Agora
    agora_app_id: str = "8aab67dc71304ae595f064ea51f12082"
    agora_app_certificate: str = "4130348368c94fd2b8a008676187b394"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "")


settings = Settings()
