from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, MaintenanceRequest, Trip, Vehicle, Driver, Notification, MaintenanceStatus, TripStatus, NotificationStatus, Route
from app.schemas.schemas import (
    MaintenanceResponse, MaintenanceRejectRequest, TripResponse, ManagerDashboardStats, NotificationResponse, VehicleResponse, DriverResponse, RouteResponse
)
from app.services.maintenance_service import approve_maintenance_request, reject_maintenance_request

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.MANAGER))])

# --- Dashboard ---
@router.get("/dashboard/stats", response_model=ManagerDashboardStats)
async def get_dashboard_stats(db: Annotated[AsyncSession, Depends(get_db)]):
    from sqlalchemy import func
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date()
    
    # Trips today
    trips_today = await db.scalar(select(func.count(Trip.id)).where(func.date(Trip.scheduled_start) == today))
    # Revenue
    revenue = await db.scalar(select(func.sum(Trip.fare_collected)).where(func.date(Trip.scheduled_start) == today))
    
    # On Time % — real calculation from is_late field
    total_completed = await db.scalar(
        select(func.count(Trip.id)).where(func.date(Trip.scheduled_start) == today, Trip.status == TripStatus.COMPLETED)
    )
    on_time_count = await db.scalar(
        select(func.count(Trip.id)).where(func.date(Trip.scheduled_start) == today, Trip.status == TripStatus.COMPLETED, Trip.is_late == False)
    )
    on_time_pct = (on_time_count / total_completed * 100) if total_completed and total_completed > 0 else 100.0
    
    # Crowding alerts — trips with crowding_score > 0.8
    crowding = await db.scalar(
        select(func.count(Trip.id)).where(func.date(Trip.scheduled_start) == today, Trip.crowding_score > 0.8)
    )
    
    # Pending maintenance — real count
    pending_maint = await db.scalar(
        select(func.count(MaintenanceRequest.id)).where(MaintenanceRequest.status == MaintenanceStatus.PENDING)
    )
    
    return {
        "trips_today": trips_today or 0,
        "total_revenue": revenue or 0.0,
        "on_time_percentage": round(on_time_pct, 1),
        "crowding_alerts": crowding or 0,
        "pending_maintenance": pending_maint or 0
    }

# --- Fleet ---
@router.get("/fleet", response_model=List[VehicleResponse])
async def get_fleet(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Vehicle))
    return result.scalars().all()

@router.get("/drivers", response_model=List[DriverResponse])
async def get_drivers(db: Annotated[AsyncSession, Depends(get_db)]):
    from sqlalchemy.orm import selectinload
    stmt = select(Driver).options(selectinload(Driver.user))
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/routes", response_model=List[RouteResponse])
async def get_routes(db: Annotated[AsyncSession, Depends(get_db)]):
    from sqlalchemy.orm import selectinload
    stmt = select(Route).options(selectinload(Route.stops))
    result = await db.execute(stmt)
    return result.scalars().all()

# --- Maintenance ---
@router.get("/maintenance/pending", response_model=List[MaintenanceResponse])
async def get_pending_maintenance(db: Annotated[AsyncSession, Depends(get_db)]):
    stmt = select(MaintenanceRequest).where(MaintenanceRequest.status == MaintenanceStatus.PENDING)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.patch("/maintenance/{id}/approve", response_model=MaintenanceResponse)
async def approve_request(id: int, db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.MANAGER))):
    from sqlalchemy.orm import selectinload
    stmt = select(MaintenanceRequest).options(selectinload(MaintenanceRequest.vehicle)).where(MaintenanceRequest.id == id)
    result = await db.execute(stmt)
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    updated = await approve_maintenance_request(db, request, current_user.id)
    await db.commit()
    await db.refresh(updated)
    return updated

@router.patch("/maintenance/{id}/reject", response_model=MaintenanceResponse)
async def reject_request(id: int, rejection: MaintenanceRejectRequest, db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.MANAGER))):
    request = await db.get(MaintenanceRequest, id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    updated = await reject_maintenance_request(db, request, current_user.id, rejection.reason)
    await db.commit()
    await db.refresh(updated)
    return updated

# --- Notifications ---
@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.MANAGER))):
    stmt = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.MANAGER)),
):
    """Mark a single notification as READ. Ignores if already READ."""
    notif = await db.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.status != NotificationStatus.READ:
        notif.status = NotificationStatus.READ
        await db.commit()
        await db.refresh(notif)
    return notif
