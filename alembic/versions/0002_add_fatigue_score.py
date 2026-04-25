"""Add fatigue_score to drivers

Revision ID: 0002_add_fatigue_score
Revises: 6fe816cdcd0c
Create Date: 2026-03-15

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_add_fatigue_score'
down_revision: Union[str, None] = '6fe816cdcd0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('drivers',
        sa.Column('fatigue_score', sa.Float(), nullable=False, server_default='0.0')
    )


def downgrade() -> None:
    op.drop_column('drivers', 'fatigue_score')
