from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, User, Driver, DriverStatus
from app.schemas.schemas import DriverCreate, DriverUpdate, DriverResponse
from app.core.security import security
from app.services.audit_service import log_action

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN))])

@router.get("", response_model=List[DriverResponse])
async def read_drivers(db: Annotated[AsyncSession, Depends(get_db)], skip: int = 0, limit: int = 100):
    from sqlalchemy.orm import selectinload
    stmt = select(Driver).options(selectinload(Driver.user)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=DriverResponse)
async def create_driver(driver_in: DriverCreate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    stmt = select(Driver).where(Driver.license_number == driver_in.license_number)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="License number already exists")
    
    driver = Driver(
        user_id=driver_in.user_id,
        license_number=driver_in.license_number,
        license_expiry=driver_in.license_expiry,
        garage_id=driver_in.garage_id,
        status=DriverStatus.ACTIVE
    )
    db.add(driver)
    await db.flush()
    await log_action(db, current_user.id, "CREATE", "Driver", driver.id)
    await db.commit()
    await db.refresh(driver)
    return driver

@router.put("/{id}", response_model=DriverResponse)
async def update_driver(id: int, driver_in: DriverUpdate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    driver = await db.get(Driver, id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    update_data = driver_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(driver, key, value)
        
    await log_action(db, current_user.id, "UPDATE", "Driver", driver.id)
    await db.commit()
    await db.refresh(driver)
    return driver

@router.patch("/{id}/deactivate")
async def deactivate_driver(id: int, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    """Soft-deactivate a driver by setting their status to OFF_DUTY and the linked user to inactive."""
    driver = await db.get(Driver, id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    driver.status = DriverStatus.OFF_DUTY
    # Also deactivate the linked user account so they can't log in
    user = await db.get(User, driver.user_id)
    if user:
        user.is_active = False
    await log_action(db, current_user.id, "DEACTIVATE", "Driver", driver.id)
    await db.commit()
    return {"message": "Driver deactivated"}


@router.patch("/{id}/activate")
async def activate_driver(id: int, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    """Re-activate a previously deactivated driver."""
    driver = await db.get(Driver, id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    driver.status = DriverStatus.OFF_DUTY  # Ready to check-in
    user = await db.get(User, driver.user_id)
    if user:
        user.is_active = True
    await log_action(db, current_user.id, "ACTIVATE", "Driver", driver.id)
    await db.commit()
    return {"message": "Driver activated"}


@router.delete("/{id}")
async def delete_driver(id: int, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    """Permanently delete a driver record. Blocked if the driver has active trips."""
    from app.models.models import Trip, TripStatus, RotationAssignment
    driver = await db.get(Driver, id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Safety: block deletion if the driver has any ACTIVE or SCHEDULED trips
    active_trips = await db.scalar(
        select(func.count(Trip.id)).where(
            Trip.driver_id == id,
            Trip.status.in_([TripStatus.ACTIVE, TripStatus.SCHEDULED])
        )
    )
    if active_trips:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete driver with {active_trips} active/scheduled trip(s). Cancel or complete them first."
        )
    
    await log_action(db, current_user.id, "DELETE", "Driver", driver.id)
    await db.delete(driver)
    await db.commit()
    return {"message": "Driver permanently deleted"}
