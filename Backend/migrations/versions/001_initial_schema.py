"""Initial schema - agents, masters, commands, mesh routes, history

Revision ID: 001_initial
Revises: None
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Masters table
    op.create_table(
        "masters",
        sa.Column("master_id", sa.String(10), primary_key=True),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("max_agents", sa.Integer(), server_default="50"),
        sa.Column("current_agent_count", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="ONLINE"),
        sa.Column("location_zone", sa.String(50), nullable=True),
        sa.Column("gps_lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("gps_lng", sa.Numeric(10, 8), nullable=True),
        sa.Column("mesh_neighbors", postgresql.JSONB(), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_masters_status", "masters", ["status"])

    # Agents table
    op.create_table(
        "agents",
        sa.Column("agent_id", sa.String(17), primary_key=True),
        sa.Column("short_id", sa.String(10), unique=True, nullable=False),
        sa.Column("master_id", sa.String(10), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="NEW",
        ),
        sa.Column("capabilities", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("location_zone", sa.String(50), nullable=True),
        sa.Column("gps_lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("gps_lng", sa.Numeric(10, 8), nullable=True),
        sa.Column("firmware_version", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_heartbeat", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_agents_status", "agents", ["status"])
    op.create_index("ix_agents_master_id", "agents", ["master_id"])
    op.create_index("ix_agents_location_zone", "agents", ["location_zone"])
    op.create_index("ix_agents_status_master", "agents", ["status", "master_id"])

    # Agent history table
    op.create_table(
        "agent_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("agent_id", sa.String(17), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=True),
        sa.Column("server_received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_agent_history_agent_id", "agent_history", ["agent_id"])
    op.create_index("ix_agent_history_event_type", "agent_history", ["event_type"])
    op.create_index("ix_agent_history_agent_time", "agent_history", ["agent_id", "timestamp"])

    # Mesh routes table
    op.create_table(
        "mesh_routes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_node", sa.String(17), nullable=False),
        sa.Column("target_node", sa.String(17), nullable=False),
        sa.Column("next_hop", sa.String(17), nullable=True),
        sa.Column("hop_count", sa.Integer(), server_default="1"),
        sa.Column("signal_strength", sa.Integer(), nullable=True),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("active", sa.Boolean(), server_default="true"),
    )
    op.create_index("ix_mesh_routes_source", "mesh_routes", ["source_node"])
    op.create_index("ix_mesh_routes_target", "mesh_routes", ["target_node"])
    op.create_index("ix_mesh_routes_source_target", "mesh_routes", ["source_node", "target_node"])

    # Commands table
    op.create_table(
        "commands",
        sa.Column("cmd_id", sa.String(36), primary_key=True),
        sa.Column("agent_id", sa.String(17), nullable=False),
        sa.Column("command_type", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(10), server_default="MEDIUM"),
        sa.Column("status", sa.String(20), server_default="PENDING"),
        sa.Column("params", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("requires_ack", sa.Boolean(), server_default="true"),
        sa.Column("max_retries", sa.Integer(), server_default="3"),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("issued_by", sa.String(100), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
    )
    op.create_index("ix_commands_agent_id", "commands", ["agent_id"])
    op.create_index("ix_commands_status", "commands", ["status"])
    op.create_index("ix_commands_agent_status", "commands", ["agent_id", "status"])


def downgrade() -> None:
    op.drop_table("commands")
    op.drop_table("mesh_routes")
    op.drop_table("agent_history")
    op.drop_table("agents")
    op.drop_table("masters")
