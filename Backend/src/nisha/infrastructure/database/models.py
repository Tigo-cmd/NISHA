"""SQLAlchemy ORM models mapping to PostgreSQL schema."""

from datetime import datetime, timezone

from sqlalchemy import (
    ForeignKey,
    Boolean,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AgentModel(Base):
    __tablename__ = "agents"

    agent_id: Mapped[str] = mapped_column(String(17), primary_key=True)
    short_id: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    master_id: Mapped[str | None] = mapped_column(
        String(10), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="NEW", index=True
    )
    capabilities: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    location_zone: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    gps_lat: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    gps_lng: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hardware_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    stream_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_heartbeat: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)

    history: Mapped[list["AgentHistoryModel"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_agents_status_master", "status", "master_id"),
    )


class MasterModel(Base):
    __tablename__ = "masters"

    master_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    max_agents: Mapped[int] = mapped_column(Integer, default=50)
    current_agent_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="ONLINE", index=True)
    location_zone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gps_lat: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    gps_lng: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    mesh_neighbors: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AgentHistoryModel(Base):
    __tablename__ = "agent_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[str] = mapped_column(
        String(17), ForeignKey("agents.agent_id", ondelete="CASCADE"), nullable=False, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    server_received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    agent: Mapped["AgentModel"] = relationship(back_populates="history")

    __table_args__ = (
        Index("ix_agent_history_agent_time", "agent_id", "timestamp"),
    )


class MeshRouteModel(Base):
    __tablename__ = "mesh_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_node: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    target_node: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    next_hop: Mapped[str | None] = mapped_column(String(17), nullable=True)
    hop_count: Mapped[int] = mapped_column(Integer, default=1)
    signal_strength: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        Index("ix_mesh_routes_source_target", "source_node", "target_node"),
    )


class CommandModel(Base):
    __tablename__ = "commands"

    cmd_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    command_type: Mapped[str] = mapped_column(String(30), nullable=False)
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    requires_ack: Mapped[bool] = mapped_column(Boolean, default=True)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    issued_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    dispatched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_commands_agent_status", "agent_id", "status"),
    )


class AudioEventModel(Base):
    __tablename__ = "audio_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    priority: Mapped[str] = mapped_column(String(10), index=True)
    event_type: Mapped[str] = mapped_column(String(30))  # HARMFUL_SOUND, etc.
    class_name: Mapped[str] = mapped_column(String(30), index=True)  # gunshot, etc.
    confidence: Mapped[float] = mapped_column(Numeric(4, 3))
    features: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    audio_format: Mapped[str | None] = mapped_column(String(10), nullable=True)
    sample_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_data_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Path to file or blob storage key
    audio_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # Base64 encoded audio
    transcription: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(5), nullable=True)
    location_zone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class VideoEventModel(Base):
    __tablename__ = "video_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    priority: Mapped[str] = mapped_column(String(10), index=True)
    behavior: Mapped[str] = mapped_column(String(20), index=True)
    confidence: Mapped[float] = mapped_column(Numeric(4, 3))
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    keypoints: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    frame_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location_zone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    video_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AudioTranscriptionModel(Base):
    __tablename__ = "audio_transcriptions"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(5), nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(4, 3))
    model_version: Mapped[str] = mapped_column(String(50))
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
