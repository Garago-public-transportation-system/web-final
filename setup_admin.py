import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.models import User, UserRole
from app.core.security import security
from app.core.config import settings

async def main():
    # Use the DB URL from settings
    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    async with SessionLocal() as session:
        stmt = select(User).where(User.email == "admin@garago.com")
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        hashed_pw = security.get_password_hash("admin")
        
        if user:
            user.hashed_password = hashed_pw
            print("Admin user found. Password updated to 'admin'.")
        else:
            user = User(
                email="admin@garago.com",
                full_name="System Admin",
                hashed_password=hashed_pw,
                role=UserRole.ADMIN,
                is_active=True
            )
            session.add(user)
            print("Admin user created with password 'admin'.")
            
        await session.commit()
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
