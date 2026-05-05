"""Audio support - audio_events, audio_transcriptions

Revision ID: 002_audio
Revises: 001_initial
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002_audio"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Audio events table
    op.create_table(
        "audio_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agent_id", sa.String(17), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("class_name", sa.String(30), nullable=False),
        sa.Column("confidence", sa.Numeric(4, 3), nullable=False),
        sa.Column("features", postgresql.JSONB(), nullable=True),
        sa.Column("audio_format", sa.String(10), nullable=True),
        sa.Column("sample_rate", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("audio_data_ref", sa.String(255), nullable=True),
        sa.Column("transcription", sa.Text(), nullable=True),
        sa.Column("language", sa.String(5), nullable=True),
        sa.Column("location_zone", sa.String(50), nullable=True),
        sa.Column("confirmed", sa.Boolean(), server_default="false"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audio_events_agent_id", "audio_events", ["agent_id"])
    op.create_index("ix_audio_events_timestamp", "audio_events", ["timestamp"])
    op.create_index("ix_audio_events_priority", "audio_events", ["priority"])
    op.create_index("ix_audio_events_class_name", "audio_events", ["class_name"])

    # Audio transcriptions table
    op.create_table(
        "audio_transcriptions",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("language", sa.String(5), nullable=False),
        sa.Column("confidence", sa.Numeric(4, 3), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audio_transcriptions")
    op.drop_table("audio_events")
