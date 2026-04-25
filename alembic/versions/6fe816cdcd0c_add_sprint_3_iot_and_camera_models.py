"""Add Sprint 3 IoT and Camera Models

Revision ID: 6fe816cdcd0c
Revises: e4c72e85d44d
Create Date: 2026-03-09 04:11:39.111372

NOTE: This migration is a no-op. The tables it originally tried to create
(daily_reports, etc.) already exist because the DB was bootstrapped via
scripts/reset_db.py (SQLAlchemy create_all). Running this on a fresh DB
that was set up with create_all + alembic stamp head is safe.
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '6fe816cdcd0c'
down_revision: Union[str, None] = 'e4c72e85d44d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
