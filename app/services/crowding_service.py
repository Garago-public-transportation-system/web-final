from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Trip, Vehicle, Notification
from app.core.config import settings
from app.services.notification_service import create_notification

async def check_crowding(
    db: AsyncSession,
    trip: Trip,
    vehicle_capacity: int
):
    if not vehicle_capacity:
        return

    score = trip.passenger_count / vehicle_capacity
    trip.crowding_score = score
    
    if score >= settings.CROWDING_THRESHOLD and not trip.is_crowded:
        trip.is_crowded = True
        
        # M3: Notify all managers about crowding
        from sqlalchemy import select
        from app.models.models import User, UserRole
        managers = (await db.execute(
            select(User).where(User.role == UserRole.MANAGER, User.is_active == True)
        )).scalars().all()
        for mgr in managers:
            await create_notification(
                db, mgr.id,
                title="Crowding Alert",
                message=f"Trip {trip.trip_number or trip.id} is at {round(score * 100)}% capacity ({trip.passenger_count} passengers).",
                type="CROWDING"
            )
    
    return trip

async def report_crowding(
    db: AsyncSession,
    trip: Trip,
    driver_id: int
):
    trip.driver_crowding_report = True
    trip.is_crowded = True # Manual override implies crowded
    
    # L5: Notify managers about driver-reported crowding
    from sqlalchemy import select
    from app.models.models import User, UserRole
    managers = (await db.execute(
        select(User).where(User.role == UserRole.MANAGER, User.is_active == True)
    )).scalars().all()
    for mgr in managers:
        await create_notification(
            db, mgr.id,
            title="Driver Crowding Report",
            message=f"Driver #{driver_id} reported crowding on trip {trip.trip_number or trip.id}.",
            type="CROWDING"
        )
    
    return trip
