"""Phase 2: Mesh, resilience, config versioning, audio events

Revision ID: 002_phase2
Revises: 001_initial
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002_phase2"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Config versions table
    op.create_table(
        "config_versions",
        sa.Column("version_id", sa.String(36), primary_key=True),
        sa.Column("agent_id", sa.String(17), nullable=False),
        sa.Column("config_hash", sa.String(16), nullable=False),
        sa.Column("config_data", postgresql.JSONB(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("change_type", sa.String(20), nullable=False, server_default="FULL_REPLACE"),
        sa.Column("changed_keys", postgresql.JSONB(), nullable=True),
        sa.Column("previous_version_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rolled_back", sa.Boolean(), server_default="false"),
    )
    op.create_index("ix_config_versions_agent", "config_versions", ["agent_id"])
    op.create_index("ix_config_versions_hash", "config_versions", ["config_hash"])

    # Handoff history table
    op.create_table(
        "handoff_history",
        sa.Column("handoff_id", sa.String(36), primary_key=True),
        sa.Column("agent_id", sa.String(17), nullable=False),
        sa.Column("from_master_id", sa.String(10), nullable=False),
        sa.Column("to_master_id", sa.String(10), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("trigger_reason", sa.String(50), nullable=True),
        sa.Column("current_signal", sa.Integer(), nullable=True),
        sa.Column("target_signal", sa.Integer(), nullable=True),
        sa.Column("offers_count", sa.Integer(), server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Numeric(8, 2), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_handoff_history_agent", "handoff_history", ["agent_id"])
    op.create_index("ix_handoff_history_status", "handoff_history", ["status"])
    op.create_index("ix_handoff_history_time", "handoff_history", ["started_at"])



def downgrade() -> None:
    op.drop_table("handoff_history")
    op.drop_table("config_versions")
