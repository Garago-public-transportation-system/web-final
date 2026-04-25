import os

# Alembic migration script for initial schema creation
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    """Create all tables as defined in the SQLAlchemy models."""
    pass

def downgrade():
    """Drop all tables (reverse of upgrade)."""
    pass
