import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.models import User
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    async with SessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"Email: {u.email} | Role: {u.role.value if hasattr(u.role, 'value') else u.role}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
