"""Add gate_logs and camera_readings tables

Revision ID: 0003_add_gate_logs_and_camera_readings
Revises: 0002_add_fatigue_score
Create Date: 2026-03-16

These tables persist ANPR gate events and YOLOv8 camera readings respectively.
They were added to models.py in Phase 2 but no migration existed, causing
'relation does not exist' errors on any fresh or existing database.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_add_gate_logs_and_camera_readings'
down_revision: Union[str, None] = '0002_add_fatigue_score'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # gate_logs — persists every ANPR webhook event (GRANTED / DENIED / IGNORED)
    op.create_table(
        'gate_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('gate_id', sa.String(length=50), nullable=False),
        sa.Column('plate_number', sa.String(length=50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('event', sa.String(length=50), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name='fk_gate_logs_vehicle'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_gate_logs_gate_id', 'gate_logs', ['gate_id'], unique=False)
    op.create_index('idx_gate_logs_created_at', 'gate_logs', ['created_at'], unique=False)
    op.create_index('idx_gate_logs_vehicle_id', 'gate_logs', ['vehicle_id'], unique=False)

    # camera_readings — persists every YOLOv8 passenger-count reading
    op.create_table(
        'camera_readings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.Column('passenger_count', sa.Integer(), nullable=False),
        sa.Column('crowding_score', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name='fk_camera_readings_trip'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name='fk_camera_readings_vehicle'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_camera_readings_trip_id', 'camera_readings', ['trip_id'], unique=False)
    op.create_index('idx_camera_readings_vehicle_id', 'camera_readings', ['vehicle_id'], unique=False)
    op.create_index('idx_camera_readings_created_at', 'camera_readings', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_camera_readings_created_at', table_name='camera_readings')
    op.drop_index('idx_camera_readings_vehicle_id', table_name='camera_readings')
    op.drop_index('idx_camera_readings_trip_id', table_name='camera_readings')
    op.drop_table('camera_readings')

    op.drop_index('idx_gate_logs_vehicle_id', table_name='gate_logs')
    op.drop_index('idx_gate_logs_created_at', table_name='gate_logs')
    op.drop_index('idx_gate_logs_gate_id', table_name='gate_logs')
    op.drop_table('gate_logs')
