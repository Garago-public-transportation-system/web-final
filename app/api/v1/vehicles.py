from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, User, Vehicle, VehicleStatus
from app.schemas.schemas import VehicleCreate, VehicleUpdate, VehicleResponse
from app.services.audit_service import log_action

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN))])

@router.get("", response_model=List[VehicleResponse])
async def read_vehicles(db: Annotated[AsyncSession, Depends(get_db)], skip: int = 0, limit: int = 100):
    result = await db.execute(select(Vehicle).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("", response_model=VehicleResponse)
async def create_vehicle(vehicle_in: VehicleCreate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    # Check if plate already exists
    stmt = select(Vehicle).where(Vehicle.plate_number == vehicle_in.plate_number)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Vehicle with this plate number already exists")

    vehicle = Vehicle(**vehicle_in.model_dump())
    db.add(vehicle)
    await db.flush()
    await log_action(db, current_user.id, "CREATE", "Vehicle", vehicle.id)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle

@router.put("/{id}", response_model=VehicleResponse)
async def update_vehicle(id: int, vehicle_in: VehicleUpdate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    vehicle = await db.get(Vehicle, id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = vehicle_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vehicle, key, value)
        
    await log_action(db, current_user.id, "UPDATE", "Vehicle", vehicle.id)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle

@router.delete("/{id}")
async def delete_vehicle(id: int, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    vehicle = await db.get(Vehicle, id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle.status = VehicleStatus.OUT_OF_SERVICE
    await log_action(db, current_user.id, "DELETE", "Vehicle", vehicle.id)
    await db.commit()
    return {"message": "Vehicle marked as Out of Service"}
