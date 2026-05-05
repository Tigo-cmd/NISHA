"""Add hardware_type and stream_url to agents

Revision ID: 4f1c57c0fe38
Revises: 003_video
Create Date: 2026-05-05 14:28:35.060305
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4f1c57c0fe38'
down_revision: Union[str, None] = '003_video'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("hardware_type", sa.String(length=50), nullable=True))
    op.add_column("agents", sa.Column("stream_url", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "stream_url")
    op.drop_column("agents", "hardware_type")

