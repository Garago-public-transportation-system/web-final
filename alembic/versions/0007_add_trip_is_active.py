"""Add is_active column to trips

Revision ID: 0007_add_trip_is_active
Revises: 1e7de45c5093
Create Date: 2026-04-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0007_add_trip_is_active"
down_revision: Union[str, None] = "1e7de45c5093"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "trips",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_trips_is_active", "trips", ["is_active"])

    # Backfill: any trip whose scheduled_start date is before today is inactive.
    op.execute(
        "UPDATE trips SET is_active = FALSE WHERE scheduled_start::date < CURRENT_DATE"
    )

    # Drop the server_default after backfill so application-level default takes over.
    op.alter_column("trips", "is_active", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_trips_is_active", table_name="trips")
    op.drop_column("trips", "is_active")
