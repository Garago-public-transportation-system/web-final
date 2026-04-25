"""Sprint 4 P2 + P3 model changes

Revision ID: 0004_sprint4_p2_and_p3_model_changes
Revises: 0003_add_gate_logs_and_camera_readings
Create Date: 2026-04-05

Changes:
  P2 — New tables: iot_sensor_readings, crowding_events, reroute_logs, gate_cameras
  P3 — User.preferred_language column added
  P3 — Notification.is_read (bool) replaced by Notification.status (enum)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004_sprint4_p2_and_p3_model_changes'
down_revision: Union[str, None] = '0003_add_gate_logs_and_camera_readings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- P3: new enum types ---
    op.execute("CREATE TYPE notification_status AS ENUM ('PENDING', 'DELIVERED', 'READ')")
    op.execute("CREATE TYPE iot_sensor_type AS ENUM ('ENGINE_TEMP', 'OIL_PRESSURE', 'BRAKE_PAD', 'BATTERY_VOLTAGE')")
    op.execute("CREATE TYPE reroute_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED')")

    # --- P3: User.preferred_language ---
    op.add_column('users', sa.Column('preferred_language', sa.String(5), nullable=False, server_default='en'))

    # --- P3: Notification.is_read → status ---
    op.add_column('notifications', sa.Column(
        'status',
        sa.Enum('PENDING', 'DELIVERED', 'READ', name='notification_status', create_type=False),
        nullable=False,
        server_default='PENDING'
    ))
    op.drop_column('notifications', 'is_read')

    # --- P2: iot_sensor_readings ---
    op.create_table(
        'iot_sensor_readings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.Column('sensor_type', sa.Enum(
            'ENGINE_TEMP', 'OIL_PRESSURE', 'BRAKE_PAD', 'BATTERY_VOLTAGE',
            name='iot_sensor_type', create_type=False
        ), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name='fk_iot_readings_vehicle'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_iot_vehicle_recorded', 'iot_sensor_readings', ['vehicle_id', 'recorded_at'])

    # --- P2: crowding_events ---
    op.create_table(
        'crowding_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.Column('crowding_score', sa.Float(), nullable=False),
        sa.Column('passenger_count', sa.Integer(), nullable=False),
        sa.Column('auto_dispatch_triggered', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name='fk_crowding_events_trip'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name='fk_crowding_events_vehicle'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_crowding_trip', 'crowding_events', ['trip_id'])

    # --- P2: reroute_logs ---
    op.create_table(
        'reroute_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('driver_id', sa.Integer(), nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=True),
        sa.Column('original_route_id', sa.Integer(), nullable=True),
        sa.Column('new_route_id', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum(
            'PENDING', 'APPROVED', 'REJECTED',
            name='reroute_status', create_type=False
        ), nullable=False, server_default='PENDING'),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['driver_id'], ['drivers.id'], name='fk_reroute_logs_driver'),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name='fk_reroute_logs_trip'),
        sa.ForeignKeyConstraint(['original_route_id'], ['routes.id'], name='fk_reroute_logs_original_route'),
        sa.ForeignKeyConstraint(['new_route_id'], ['routes.id'], name='fk_reroute_logs_new_route'),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], name='fk_reroute_logs_approver'),
        sa.PrimaryKeyConstraint('id'),
    )

    # --- P2: gate_cameras ---
    op.create_table(
        'gate_cameras',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_name', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(50), nullable=False),
        sa.Column('gate_type', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('ip_address', name='uix_gate_cameras_ip'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('gate_cameras')
    op.drop_table('reroute_logs')
    op.drop_index('idx_crowding_trip', table_name='crowding_events')
    op.drop_table('crowding_events')
    op.drop_index('idx_iot_vehicle_recorded', table_name='iot_sensor_readings')
    op.drop_table('iot_sensor_readings')

    op.add_column('notifications', sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'))
    op.drop_column('notifications', 'status')

    op.drop_column('users', 'preferred_language')

    op.execute("DROP TYPE IF EXISTS reroute_status")
    op.execute("DROP TYPE IF EXISTS iot_sensor_type")
    op.execute("DROP TYPE IF EXISTS notification_status")
