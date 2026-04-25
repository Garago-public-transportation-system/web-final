"""Add ocr_raw_text and match_method to gate_logs

Revision ID: 0006_add_ocr_fields_to_gate_logs
Revises: 0005_remove_fuel_gps_iot
Create Date: 2026-04-25

The gate_logs table was originally created without ocr_raw_text and
match_method columns. The model and hardware API now write these fields,
causing UndefinedColumnError on every ANPR upload. This migration adds
the two missing columns.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0006_add_ocr_fields_to_gate_logs'
down_revision: Union[str, None] = '0005_remove_fuel_gps_iot'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'gate_logs',
        sa.Column('ocr_raw_text', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'gate_logs',
        sa.Column('match_method', sa.String(length=50), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('gate_logs', 'match_method')
    op.drop_column('gate_logs', 'ocr_raw_text')
