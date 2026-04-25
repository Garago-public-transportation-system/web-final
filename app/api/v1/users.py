from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, User, Driver
from app.schemas.schemas import (
    UserCreate, UserUpdate, UserResponse,
    UserWithDriverCreate, DriverBase
)
from app.core.security import security
from app.services.audit_service import log_action

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN))])

@router.get("", response_model=List[UserResponse])
async def read_users(db: Annotated[AsyncSession, Depends(get_db)], skip: int = 0, limit: int = 100):
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("", response_model=UserResponse)
async def create_user(request: Request, user_in: UserCreate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = security.get_password_hash(user_in.password)
    user_dict = user_in.model_dump(exclude={"password"})
    user_dict["hashed_password"] = hashed_password

    db_user = User(**user_dict)
    db.add(db_user)
    await db.flush()

    ip = request.client.host if request.client else None
    await log_action(db, current_user.id, "CREATE", "User", db_user.id, ip_address=ip)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.put("/{id}", response_model=UserResponse)
async def update_user(request: Request, id: int, user_in: UserUpdate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    result = await db.execute(select(User).where(User.id == id))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = security.get_password_hash(update_data.pop("password"))

    new_email = update_data.get("email")
    if new_email and new_email != db_user.email:
        existing = await db.execute(select(User).where(User.email == new_email, User.id != id))
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Email already in use by another user")

    for key, value in update_data.items():
        setattr(db_user, key, value)

    ip = request.client.host if request.client else None
    await log_action(db, current_user.id, "UPDATE", "User", db_user.id, ip_address=ip)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.delete("/{id}", response_model=UserResponse)
async def delete_user(request: Request, id: int, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    result = await db.execute(select(User).where(User.id == id))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.is_active = False
    ip = request.client.host if request.client else None
    await log_action(db, current_user.id, "DELETE", "User", db_user.id, ip_address=ip)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.post("/with-driver", response_model=UserResponse)
async def create_user_and_driver(
    request: Request,
    composite_in: UserWithDriverCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))
):
    result = await db.execute(select(User).where(User.email == composite_in.user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        hashed_password = security.get_password_hash(composite_in.user.password)
        user_dict = composite_in.user.model_dump(exclude={"password"})
        user_dict["hashed_password"] = hashed_password
        user_dict["role"] = UserRole.DRIVER

        db_user = User(**user_dict)
        db.add(db_user)
        await db.flush()

        driver_dict = composite_in.driver.model_dump()
        driver_dict["user_id"] = db_user.id
        db_driver = Driver(**driver_dict)
        db.add(db_driver)

        ip = request.client.host if request.client else None
        await log_action(db, current_user.id, "CREATE", "User (Driver)", db_user.id, ip_address=ip)
        await db.commit()
        await db.refresh(db_user)
        return db_user

    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create driver record. Please try again.")
