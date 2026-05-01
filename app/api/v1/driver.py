from typing import Annotated, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, Driver, Trip, BreakLog, DriverStatus, TripStatus, Ticket, Vehicle, VehicleStatus, RerouteLog, RerouteStatus, Notification, NotificationStatus, Route, GpsTracking
from app.schemas.schemas import DriverResponse, TripResponse, BreakLogResponse, RerouteRequest, RerouteLogResponse, NotificationResponse, DriverTicketIssueRequest, TicketResponse, DriverGpsIngest
from app.services.break_service import start_break, end_break, get_break_status

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.DRIVER))])

@router.get("/me", response_model=DriverResponse)
async def get_my_driver_profile(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER))):
    stmt = select(Driver).where(Driver.user_id == current_user.id)
    driver = (await db.execute(stmt)).scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    # Populate user data manually if needed or rely on loading
    driver.user = current_user
    return driver

@router.get("/me/trips", response_model=List[TripResponse])
async def get_my_trips(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER)), skip: int = 0, limit: int = 50):
    # Get driver id
    driver_res = await db.execute(select(Driver).where(Driver.user_id == current_user.id))
    driver = driver_res.scalar_one()
    
    from sqlalchemy.orm import selectinload
    from app.models.models import Route
    stmt = select(Trip).options(
        selectinload(Trip.route).selectinload(Route.stops),
        selectinload(Trip.vehicle),
        selectinload(Trip.driver).selectinload(Driver.user)
    ).where(Trip.driver_id == driver.id).order_by(Trip.scheduled_start.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/me/trips/{trip_id}", response_model=dict)
async def get_my_trip_details(
    trip_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user = Depends(get_current_user_with_role(UserRole.DRIVER))
):
    from app.services.trip_service import build_trip_detail

    # Verify ownership before loading full detail
    driver_res = await db.execute(select(Driver).where(Driver.user_id == current_user.id))
    driver = driver_res.scalar_one()

    trip = await db.get(Trip, trip_id)
    if not trip or trip.driver_id != driver.id:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to you")

    detail = await build_trip_detail(trip_id, db)
    if not detail:
        raise HTTPException(status_code=404, detail="Trip not found")
    return detail

@router.post("/me/trips/{trip_id}/start", response_model=TripResponse)
async def start_trip(
    trip_id: int, 
    db: Annotated[AsyncSession, Depends(get_db)], 
    current_user = Depends(get_current_user_with_role(UserRole.DRIVER))
):
    driver_res = await db.execute(select(Driver).where(Driver.user_id == current_user.id))
    driver = driver_res.scalar_one()
    
    # F3: Must be checked in (not OFF_DUTY)
    if driver.status == DriverStatus.OFF_DUTY:
        raise HTTPException(status_code=400, detail="You must check in before starting a trip.")
    
    # F1: No concurrent active trips
    active_trip = await db.scalar(
        select(Trip).where(Trip.driver_id == driver.id, Trip.status == TripStatus.ACTIVE)
    )
    if active_trip:
        raise HTTPException(
            status_code=400, 
            detail=f"You already have an active trip (#{active_trip.trip_number or active_trip.id}). End it before starting another."
        )
    
    trip = await db.get(Trip, trip_id)
    if not trip or trip.driver_id != driver.id:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to you")
    
    if trip.status != TripStatus.SCHEDULED:
        raise HTTPException(status_code=400, detail=f"Trip cannot be started. Current status is {trip.status}")
    
    # L14: Enforce Trip Chronology (cannot start this trip if an earlier one is still SCHEDULED)
    earlier_trip = await db.scalar(
        select(Trip).where(
            Trip.driver_id == driver.id,
            Trip.status == TripStatus.SCHEDULED,
            Trip.scheduled_start < trip.scheduled_start
        ).limit(1)
    )
    if earlier_trip:
        raise HTTPException(
            status_code=400, 
            detail=f"You have an earlier trip scheduled at {earlier_trip.scheduled_start.strftime('%H:%M')} that must be started first."
        )

    # L15: Enforce Pre-Trip Barrier (cannot start > 15 mins early)
    now = datetime.now(timezone.utc)
    fifteen_mins_before = trip.scheduled_start - timedelta(minutes=15)
    if now < fifteen_mins_before:
        raise HTTPException(
            status_code=400, 
            detail=f"Too early. You can only start this trip up to 15 minutes before its scheduled time ({trip.scheduled_start.strftime('%H:%M')})."
        )
    
    # F2: Sync driver status
    trip.status = TripStatus.ACTIVE
    trip.actual_start = datetime.now(timezone.utc)
    driver.status = DriverStatus.ON_TRIP
    
    # C4: Sync vehicle status
    vehicle = await db.get(Vehicle, trip.vehicle_id)
    if vehicle:
        vehicle.status = VehicleStatus.EN_ROUTE
    
    await db.commit()
    
    # Re-query with eager loading for TripResponse serialization
    from sqlalchemy.orm import selectinload
    from app.models.models import Route
    stmt = select(Trip).options(
        selectinload(Trip.route).selectinload(Route.stops),
        selectinload(Trip.vehicle),
        selectinload(Trip.driver).selectinload(Driver.user)
    ).where(Trip.id == trip_id, Trip.driver_id == driver.id)
    result = await db.execute(stmt)
    trip = result.scalars().first()
    return trip

@router.post("/me/trips/{trip_id}/end", response_model=TripResponse)
async def end_trip(
    trip_id: int, 
    db: Annotated[AsyncSession, Depends(get_db)], 
    current_user = Depends(get_current_user_with_role(UserRole.DRIVER))
):
    driver_res = await db.execute(select(Driver).where(Driver.user_id == current_user.id))
    driver = driver_res.scalar_one()
    
    trip = await db.get(Trip, trip_id)
    if not trip or trip.driver_id != driver.id:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to you")
    
    if trip.status != TripStatus.ACTIVE:
        raise HTTPException(status_code=400, detail=f"Trip cannot be ended. Current status is {trip.status}")
    
    # L1: Minimum trip duration based on route estimated time (at least 50%)
    if trip.actual_start:
        from app.models.models import Route
        route = await db.get(Route, trip.route_id)
        min_duration = max(5, (route.estimated_time_minutes * 0.5) if route and route.estimated_time_minutes else 5)
        elapsed = (datetime.now(timezone.utc) - trip.actual_start).total_seconds() / 60.0
        if elapsed < min_duration:
            remaining = round(min_duration - elapsed, 1)
            raise HTTPException(
                status_code=400, 
                detail=f"Trip must run for at least {int(min_duration)} minutes (50% of estimated route time). {remaining} min remaining."
            )
    
    # F5: Aggregate fare from tickets
    total_fare = await db.scalar(
        select(func.coalesce(func.sum(Ticket.price), 0.0)).where(Ticket.trip_id == trip.id)
    )
    
    now = datetime.now(timezone.utc)
    trip.status = TripStatus.COMPLETED
    trip.actual_end = now
    trip.fare_collected = float(total_fare)

    # L11: Set is_late flag if trip ran past scheduled_end by more than the
    # configured grace period. Falls back to scheduled_start + route estimate
    # when scheduled_end was never set.
    sched_end = trip.scheduled_end
    if sched_end is None and trip.scheduled_start:
        from app.models.models import Route as _Route
        est_route = await db.get(_Route, trip.route_id)
        if est_route and est_route.estimated_time_minutes:
            sched_end = trip.scheduled_start + timedelta(minutes=est_route.estimated_time_minutes)
    if sched_end and now > sched_end + timedelta(minutes=settings.LATE_THRESHOLD_MINUTES):
        trip.is_late = True
    
    # F2: Sync driver status and counters
    driver.status = DriverStatus.ACTIVE
    driver.total_trips_today += 1
    driver.total_trips_all_time += 1
    driver.trips_since_last_break += 1
    
    # C4: Sync vehicle status
    vehicle = await db.get(Vehicle, trip.vehicle_id)
    if vehicle:
        vehicle.status = VehicleStatus.FREE
    
    await db.commit()
    
    # Re-query with eager loading for TripResponse serialization
    from sqlalchemy.orm import selectinload
    from app.models.models import Route
    reload_stmt = select(Trip).options(
        selectinload(Trip.route).selectinload(Route.stops),
        selectinload(Trip.vehicle),
        selectinload(Trip.driver).selectinload(Driver.user)
    ).where(Trip.id == trip_id)
    reload_result = await db.execute(reload_stmt)
    trip = reload_result.scalars().first()
    return trip

# --- Break Management ---
@router.post("/me/break/start", response_model=BreakLogResponse)
async def request_start_break(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER))):
    driver = (await db.execute(select(Driver).where(Driver.user_id == current_user.id))).scalar_one()
    try:
        log = await start_break(db, driver)
        await db.commit()
        await db.refresh(log)
        return log
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/me/break/end", response_model=DriverResponse)
async def request_end_break(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER))):
    driver = (await db.execute(select(Driver).where(Driver.user_id == current_user.id))).scalar_one()
    try:
        updated_driver = await end_break(db, driver)
        updated_driver.user = current_user
        await db.commit()
        return updated_driver
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/me/break/status")
async def get_my_break_status(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER))):
    driver = (await db.execute(select(Driver).where(Driver.user_id == current_user.id))).scalar_one()
    status = await get_break_status(driver)
    return status

@router.get("/me/breaks", response_model=List[BreakLogResponse])
async def get_my_breaks(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER)), skip: int = 0, limit: int = 50):
    driver = (await db.execute(select(Driver).where(Driver.user_id == current_user.id))).scalar_one()
    stmt = select(BreakLog).where(BreakLog.driver_id == driver.id).order_by(BreakLog.start_time.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

# --- Shift Management ---

@router.post("/me/check-in", response_model=DriverResponse)
async def driver_check_in(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER))):
    driver = (await db.execute(select(Driver).where(Driver.user_id == current_user.id))).scalar_one()
    
    if driver.status != DriverStatus.OFF_DUTY:
        raise HTTPException(status_code=400, detail=f"You are already checked in (status: {driver.status}).")

    # NOTE: We intentionally do NOT block check-in based on whether trips exist yet.
    # The correct flow is: Admin generates schedule → trips assigned to OFF_DUTY drivers →
    # driver checks in (becomes ACTIVE) → driver starts their trips.
    # Blocking check-in on trip existence creates a circular deadlock.
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    
    # L6: Reset daily counters on check-in
    driver.status = DriverStatus.ACTIVE
    driver.shift_start_time = datetime.now(timezone.utc)
    driver.shift_end_time = None
    driver.total_trips_today = 0
    driver.break_time_remaining = float(settings.BREAK_TIME_PER_SHIFT)
    driver.total_break_time_today = 0.0
    driver.trips_since_last_break = 0
    driver.current_break_number = 0
    
    await db.commit()
    await db.refresh(driver)
    driver.user = current_user
    return driver

@router.post("/me/check-out", response_model=DriverResponse)
async def driver_check_out(db: Annotated[AsyncSession, Depends(get_db)], current_user = Depends(get_current_user_with_role(UserRole.DRIVER))):
    driver = (await db.execute(select(Driver).where(Driver.user_id == current_user.id))).scalar_one()
    
    # F8: Block checkout if driver has active trips
    active_trip = await db.scalar(
        select(Trip).where(Trip.driver_id == driver.id, Trip.status == TripStatus.ACTIVE)
    )
    if active_trip:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot check out while trip #{active_trip.trip_number or active_trip.id} is still active."
        )
    
    # Auto-cancel remaining SCHEDULED trips for today on driver check-out
    today = datetime.now(timezone.utc).date()
    remaining_trips = await db.scalar(
        select(func.count(Trip.id)).where(
            Trip.driver_id == driver.id,
            Trip.status == TripStatus.SCHEDULED,
            cast(Trip.scheduled_start, Date) == today
        )
    )
    if remaining_trips and remaining_trips > 0:
        # M6: Auto-cancel remaining scheduled trips on checkout
        from sqlalchemy import update
        await db.execute(
            update(Trip).where(
                Trip.driver_id == driver.id,
                Trip.status == TripStatus.SCHEDULED,
                cast(Trip.scheduled_start, Date) == today
            ).values(status=TripStatus.CANCELLED, notes="Auto-cancelled on driver check-out")
        )
    
    driver.status = DriverStatus.OFF_DUTY
    driver.shift_end_time = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(driver)
    driver.user = current_user
    return driver


@router.post("/me/reroute", response_model=RerouteLogResponse, status_code=201)
async def request_reroute(
    body: RerouteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.DRIVER)),
):
    """Driver submits a reroute request for their active trip."""
    driver = (await db.execute(select(Driver).where(Driver.user_id == current_user.id))).scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    active_trip = (await db.execute(
        select(Trip).where(Trip.driver_id == driver.id, Trip.status == TripStatus.ACTIVE)
    )).scalar_one_or_none()

    if not active_trip:
        raise HTTPException(status_code=400, detail="You must have an active trip to request a reroute.")

    # Validate suggested_route_id: treat 0 as None, and verify the route exists
    suggested_route_id = body.suggested_route_id if body.suggested_route_id else None
    if suggested_route_id is not None:
        from app.models.models import Route
        route_exists = await db.get(Route, suggested_route_id)
        if not route_exists:
            raise HTTPException(status_code=400, detail=f"Route with id {suggested_route_id} does not exist")

    log = RerouteLog(
        driver_id=driver.id,
        trip_id=active_trip.id,
        original_route_id=active_trip.route_id,
        new_route_id=suggested_route_id,
        reason=body.reason,
        status=RerouteStatus.PENDING,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


# --- Notifications ---
@router.get("/me/notifications", response_model=List[NotificationResponse])
async def get_my_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.DRIVER)),
):
    """Fetch all notifications for the current driver, newest first."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/me/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.DRIVER)),
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


# --- Tickets (driver-side issuance) ---

def _generate_ticket_code() -> str:
    """8-char alphanumeric code, no ambiguous chars (I/O/0/1)."""
    import secrets
    allowed = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(allowed) for _ in range(8))


@router.post("/me/trips/{trip_id}/tickets", response_model=TicketResponse, status_code=201)
async def issue_ticket_for_my_trip(
    trip_id: int,
    payload: DriverTicketIssueRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.DRIVER)),
):
    """Issue a ticket for the current driver's ACTIVE trip.

    Authorization rules:
      - The driver issuing must be the driver assigned to the trip.
      - Trip must be ACTIVE (no pre-sale on SCHEDULED, no post-sale after COMPLETED).
      - Bus must not be at capacity.
      - Seat number, if provided, must not already be taken on this trip.

    Server controls price (route fare with a 15.0 fallback) and status (always ISSUED).
    """
    driver = (await db.execute(
        select(Driver).where(Driver.user_id == current_user.id)
    )).scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    trip = await db.get(Trip, trip_id)
    if not trip or trip.driver_id != driver.id:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to you")

    if trip.status != TripStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Tickets can only be issued for currently ACTIVE trips.",
        )

    vehicle = await db.get(Vehicle, trip.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=400, detail="Trip has no assigned vehicle")

    bus_capacity = vehicle.capacity or 50

    current_count = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.trip_id == trip_id)
    ) or 0
    if current_count >= bus_capacity:
        raise HTTPException(status_code=400, detail=f"Bus is full (capacity {bus_capacity}).")

    if payload.seat_number:
        seat_taken = await db.scalar(
            select(Ticket.id).where(
                Ticket.trip_id == trip_id,
                Ticket.seat_number == payload.seat_number,
            )
        )
        if seat_taken:
            raise HTTPException(
                status_code=400,
                detail=f"Seat {payload.seat_number} is already taken.",
            )

    # Generate unique ticket code (collision is statistically negligible but we still check).
    while True:
        code = _generate_ticket_code()
        if not await db.scalar(select(Ticket.id).where(Ticket.ticket_code == code)):
            break

    # Server-side price: route fare, never the client.
    route = await db.get(Route, trip.route_id)
    ticket_price = route.fare if route and route.fare > 0 else settings.DEFAULT_TICKET_FARE

    ticket = Ticket(
        trip_id=trip_id,
        passenger_name=payload.passenger_name,
        seat_number=payload.seat_number,
        price=ticket_price,
        ticket_code=code,
    )
    db.add(ticket)
    trip.passenger_count = (trip.passenger_count or 0) + 1

    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.post("/me/gps", status_code=204)
async def ingest_driver_gps(
    payload: DriverGpsIngest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.DRIVER)),
):
    """
    Driver mobile app pushes a single GPS sample.

    Resolves the driver, finds their currently active trip (if any), updates
    the vehicle's `current_latitude`/`current_longitude`, persists a
    `gps_tracking` row, and broadcasts a `gps_update` event to MANAGER and
    ADMIN over WebSocket so the live fleet feed stays in sync.
    """
    from app.core.sockets import manager
    from sqlalchemy.orm import selectinload

    driver_res = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .where(Driver.user_id == current_user.id)
    )
    driver = driver_res.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Active trip wins over assigned vehicle (driver may swap mid-shift).
    active_trip = await db.scalar(
        select(Trip)
        .where(Trip.driver_id == driver.id, Trip.status == TripStatus.ACTIVE)
        .order_by(Trip.actual_start.desc())
        .limit(1)
    )

    vehicle_id = (active_trip.vehicle_id if active_trip else driver.current_vehicle_id)
    if not vehicle_id:
        # GPS without an associated vehicle is not useful for fleet tracking.
        raise HTTPException(
            status_code=400,
            detail="No active trip or assigned vehicle for this driver.",
        )

    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    recorded_at = payload.recorded_at or datetime.now(timezone.utc)

    vehicle.current_latitude = payload.latitude
    vehicle.current_longitude = payload.longitude

    db.add(GpsTracking(
        vehicle_id=vehicle.id,
        trip_id=active_trip.id if active_trip else None,
        latitude=payload.latitude,
        longitude=payload.longitude,
        recorded_at=recorded_at,
    ))

    await db.commit()

    event = {
        "type": "gps_update",
        "driver_id": driver.id,
        "driver_name": current_user.full_name,
        "vehicle_id": vehicle.id,
        "plate_number": vehicle.plate_number,
        "trip_id": active_trip.id if active_trip else None,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "recorded_at": recorded_at.isoformat(),
    }
    await manager.broadcast_to_role("MANAGER", event)
    await manager.broadcast_to_role("ADMIN", event)
    return
