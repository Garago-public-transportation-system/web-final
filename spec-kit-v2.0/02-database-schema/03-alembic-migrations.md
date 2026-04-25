# Alembic Async Migrations Guide
> **Cross-Reference**: See `PRD-v2.0.md` Technical Stack (Alembic async setup).

## Thread-Safe Async Architectures
Using `asyncpg` inherently blocks standard synchronous SQLAlchemy `context.run_migrations()`. The Alembic `env.py` has been explicitly configured to wrap execution inside an asyncio loop.

## The Script (`alembic/env.py`)
```python
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from app.core.config import settings
from app.core.database import Base
# MUST explicitly import all models here so Base.metadata populates
from app.models import User, Vehicle, Trip, GPSTracking, TicketScan 

config = context.config
target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    # Use poolclass=NullPool for migrations to prevent stalling
    connectable = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

if context.is_offline_mode():
    print("Offline migrations not supported with AsyncPG. Running Online.")
asyncio.run(run_migrations_online())
```

## Standard Developer Command Flow
1. Add new models to `app/models/` and import them in `env.py`.
2. Generate: `alembic revision --autogenerate -m "Add trips"`
3. Verify output in `alembic/versions/`.
4. Migrate target DB: `alembic upgrade head`.\n