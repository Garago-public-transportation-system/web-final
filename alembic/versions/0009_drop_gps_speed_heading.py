"""drop gps_tracking speed and heading columns

Revision ID: 0009_drop_gps_speed_heading
Revises: 0008_drop_vehicle_fuel_level
Create Date: 2026-05-01

"""
from alembic import op
import sqlalchemy as sa


revision = '0009_drop_gps_speed_heading'
down_revision = '0008_drop_vehicle_fuel_level'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('gps_tracking', 'speed')
    op.drop_column('gps_tracking', 'heading')


def downgrade():
    op.add_column('gps_tracking', sa.Column('heading', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('gps_tracking', sa.Column('speed', sa.Float(), nullable=False, server_default='0.0'))
