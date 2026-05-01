"""drop vehicle fuel_level column

Revision ID: 0008_drop_vehicle_fuel_level
Revises: 0007_add_trip_is_active
Create Date: 2026-05-01

"""
from alembic import op
import sqlalchemy as sa

revision = '0008_drop_vehicle_fuel_level'
down_revision = '0007_add_trip_is_active'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('vehicles', 'fuel_level')


def downgrade():
    op.add_column('vehicles', sa.Column('fuel_level', sa.Float(), nullable=False, server_default='100.0'))
