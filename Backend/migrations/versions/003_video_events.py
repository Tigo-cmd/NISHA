"""Video events support

Revision ID: 003_video
Revises: 002_audio, 002_phase2
Create Date: 2026-04-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003_video"
down_revision: Union[str, Sequence[str]] = ("002_audio", "002_phase2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "video_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agent_id", sa.String(17), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False),
        sa.Column("behavior", sa.String(20), nullable=False),
        sa.Column("confidence", sa.Numeric(4, 3), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column("keypoints", postgresql.JSONB(), nullable=True),
        sa.Column("frame_index", sa.Integer(), nullable=True),
        sa.Column("location_zone", sa.String(50), nullable=True),
        sa.Column("confirmed", sa.Boolean(), server_default="false"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_video_events_agent_id", "video_events", ["agent_id"])
    op.create_index("ix_video_events_timestamp", "video_events", ["timestamp"])
    op.create_index("ix_video_events_priority", "video_events", ["priority"])
    op.create_index("ix_video_events_behavior", "video_events", ["behavior"])


def downgrade() -> None:
    op.drop_table("video_events")
