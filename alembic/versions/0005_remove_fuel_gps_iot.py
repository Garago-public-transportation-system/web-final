"""Remove fuel, GPS and IoT surface area; enrich gate_logs.

Revision ID: 0005_remove_fuel_gps_iot
Revises: 0004_sprint4_p2_and_p3_model_changes
Create Date: 2026-04-25

Rationale:
  The ESP32 hardware never drove any of these pipelines — the only live
  hardware pathway is the gate ANPR camera and the on-bus crowding camera.
  Everything else was phantom surface area.

Changes:
  * DROP TABLE iot_sensor_readings
  * DROP TABLE gps_tracking
  * DROP TYPE iot_sensor_type
  * ALTER vehicles: DROP current_latitude, current_longitude, fuel_level, mileage
  * ALTER gate_logs: ADD ocr_raw_text, match_method (for ANPR debuggability)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0005_remove_fuel_gps_iot"
down_revision: Union[str, None] = "0004_sprint4_p2_and_p3_model_changes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- gate_logs: enrich for OCR traceability ---
    op.add_column("gate_logs", sa.Column("ocr_raw_text", sa.String(100), nullable=True))
    op.add_column("gate_logs", sa.Column("match_method", sa.String(20), nullable=True))

    # --- Drop IoT telemetry ---
    op.drop_index("idx_iot_vehicle_recorded", table_name="iot_sensor_readings")
    op.drop_table("iot_sensor_readings")
    op.execute("DROP TYPE IF EXISTS iot_sensor_type")

    # --- Drop GPS tracking ---
    op.drop_index("idx_gps_vehicle_time", table_name="gps_tracking")
    op.drop_table("gps_tracking")

    # --- Strip GPS + fuel + mileage from vehicles ---
    op.drop_column("vehicles", "current_latitude")
    op.drop_column("vehicles", "current_longitude")
    op.drop_column("vehicles", "fuel_level")
    op.drop_column("vehicles", "mileage")


def downgrade() -> None:
    # --- Restore vehicles columns ---
    op.add_column("vehicles", sa.Column("mileage", sa.Float(), nullable=False, server_default="0"))
    op.add_column("vehicles", sa.Column("fuel_level", sa.Float(), nullable=False, server_default="100"))
    op.add_column("vehicles", sa.Column("current_longitude", sa.Float(), nullable=True))
    op.add_column("vehicles", sa.Column("current_latitude", sa.Float(), nullable=True))

    # --- Restore gps_tracking ---
    op.create_table(
        "gps_tracking",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("speed", sa.Float(), nullable=False, server_default="0"),
        sa.Column("heading", sa.Float(), nullable=False, server_default="0"),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_gps_vehicle_time", "gps_tracking", ["vehicle_id", "recorded_at"])

    # --- Restore iot_sensor_type enum + iot_sensor_readings ---
    op.execute(
        "CREATE TYPE iot_sensor_type AS ENUM "
        "('ENGINE_TEMP', 'OIL_PRESSURE', 'BRAKE_PAD', 'BATTERY_VOLTAGE')"
    )
    op.create_table(
        "iot_sensor_readings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column(
            "sensor_type",
            sa.Enum(
                "ENGINE_TEMP", "OIL_PRESSURE", "BRAKE_PAD", "BATTERY_VOLTAGE",
                name="iot_sensor_type", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_iot_vehicle_recorded", "iot_sensor_readings", ["vehicle_id", "recorded_at"])

    # --- Strip gate_logs enrichment ---
    op.drop_column("gate_logs", "match_method")
    op.drop_column("gate_logs", "ocr_raw_text")
