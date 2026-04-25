import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from alembic import context

# Add current directory to path to find the 'app' module
sys.path.append(os.getcwd())

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from app.core.config import settings
from app.core.database import Base
from app.models import models # Ensure models are loaded
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = context.config.attributes.get("connection", None)
    if connectable is None:
        from sqlalchemy.ext.asyncio import create_async_engine
        engine = create_async_engine(
            settings.DATABASE_URL,
            poolclass=pool.NullPool,
            future=True,
        )
        async def run_async_migrations():
            async with engine.connect() as conn:
                await conn.run_sync(do_run_migrations)
        asyncio.run(run_async_migrations())
    else:
        do_run_migrations(connectable)

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
