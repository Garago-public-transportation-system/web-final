from datetime import date, datetime, timedelta, time, timezone
from typing import List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Driver, Route, Vehicle, RotationAssignment, ShiftType, RotationPosition, DriverStatus, VehicleStatus, Trip, TripDirection, TripStatus, DriverExchange, ReplacementReason
import logging
import uuid

logger = logging.getLogger(__name__)

async def generate_daily_schedule(db: AsyncSession, target_date: date, regenerate: bool = False):
    """
    Generates rotation assignments for the target date.
    """
    # Guard: check for existing assignments to prevent duplicates
    existing_count = await db.scalar(
        select(func.count()).select_from(RotationAssignment).where(
            RotationAssignment.shift_date == target_date
        )
    )
    if existing_count:
        if not regenerate:
            logger.info(f"Assignments already exist for {target_date} ({existing_count} found), skipping.")
            return []
        else:
            logger.info(f"Regenerating assignments for {target_date}. Deleting existing {existing_count} rows.")
            from sqlalchemy import delete, cast, Date
            from app.models.models import Ticket
            # Subqueries for trip/assignment IDs on this date
            trip_ids_stmt = select(Trip.id).where(cast(Trip.scheduled_start, Date) == target_date)
            rotation_ids_stmt = select(RotationAssignment.id).where(RotationAssignment.shift_date == target_date)
            # Delete DriverExchange first — it FKs both rotation_assignments AND trips
            await db.execute(
                delete(DriverExchange).where(
                    or_(
                        DriverExchange.rotation_assignment_id.in_(rotation_ids_stmt),
                        DriverExchange.trip_id.in_(trip_ids_stmt)
                    )
                )
            )
            # Delete remaining child records
            await db.execute(delete(Ticket).where(Ticket.trip_id.in_(trip_ids_stmt)))
            # Now safe to delete trips and assignments
            await db.execute(delete(Trip).where(cast(Trip.scheduled_start, Date) == target_date))
            await db.execute(delete(RotationAssignment).where(RotationAssignment.shift_date == target_date))
            await db.commit()
    
    # 1. Fetch active routes
    stmt = select(Route).where(Route.is_active == True)
    routes = (await db.execute(stmt)).scalars().all()

    # 2. Fetch available drivers and vehicles.
    # Use OFF_DUTY drivers — these are drivers who haven't started their shift yet.
    # The correct flow is: generate schedule (assign OFF_DUTY drivers to routes) →
    # drivers check in → drivers start their trips.
    # Do NOT filter by ACTIVE: that creates a circular dependency where check-in
    # requires trips and schedule generation requires active drivers.
    stmt_drivers = select(Driver).where(Driver.status == DriverStatus.OFF_DUTY)
    available_drivers = list((await db.execute(stmt_drivers)).scalars().all())
    
    stmt_vehicles = select(Vehicle).where(Vehicle.status == VehicleStatus.FREE)
    available_vehicles = list((await db.execute(stmt_vehicles)).scalars().all())
    
    new_assignments = []
    new_trips = []

    # Generate schedules for both shifts based on settings
    from app.core.config import settings
    shifts = [
        (ShiftType.MORNING, settings.MORNING_SHIFT_START, settings.MORNING_SHIFT_END),
        (ShiftType.EVENING, settings.EVENING_SHIFT_START, settings.EVENING_SHIFT_END),
    ]
    
    for route in routes:
        for shift_type, start_hour, end_hour in shifts:
            if len(available_drivers) < 3 or len(available_vehicles) < 2:
                break
            
            # Select 3 drivers and 2 vehicles for this route/shift
            route_drivers = [available_drivers.pop(0) for _ in range(3)]
            route_vehicles = [available_vehicles.pop(0) for _ in range(2)]
        
            start_t = time(start_hour, 0)
            # Always produce timezone-aware UTC datetimes to avoid naive/aware comparison errors
            start_dt = datetime.combine(target_date, start_t, tzinfo=timezone.utc)
            # Handle end_hour=24 (midnight) — Python's time() only accepts 0..23
            if end_hour >= 24:
                end_dt = datetime.combine(target_date + timedelta(days=1), time(0, 0), tzinfo=timezone.utc)
            else:
                end_dt = datetime.combine(target_date, time(end_hour, 0), tzinfo=timezone.utc)
        
            positions = [RotationPosition.DRIVER_1, RotationPosition.DRIVER_2, RotationPosition.DRIVER_3]
            
            for i, pos in enumerate(positions):
                assignment = RotationAssignment(
                    route_id=route.id,
                    driver_id=route_drivers[i].id,
                    vehicle_id=route_vehicles[0].id if i != 2 else route_vehicles[1].id,
                    shift_type=shift_type,
                    position=pos,
                    shift_date=target_date,
                    shift_start_time=start_dt,
                    shift_end_time=end_dt,
                    is_active=(pos != RotationPosition.DRIVER_3)  # D1/D2 start active, D3 starts inactive
                )
                db.add(assignment)
                await db.flush()  # flush to obtain assignment.id before linking trips
                new_assignments.append(assignment)
                
                # Generate 2 trips per driver for the shift (Outbound and Inbound)
                route_mins = route.estimated_time_minutes
                
                if pos == RotationPosition.DRIVER_3:
                    t1_start = start_dt + timedelta(hours=settings.D3_SHIFT_OFFSET_HOURS)
                else:
                    t1_start = start_dt + timedelta(hours=i*2)
                t1_end = t1_start + timedelta(minutes=route_mins)
                
                # Validate trip doesn't exceed shift window
                if t1_end > end_dt:
                    logger.warning(f"Skipping outbound trip for driver {route_drivers[i].id} on route {route.id}: trip ends after shift ({t1_end} > {end_dt})")
                    continue
                    
                t1 = Trip(
                    driver_id=assignment.driver_id,
                    vehicle_id=assignment.vehicle_id,
                    route_id=route.id,
                    rotation_assignment_id=assignment.id,  # link trip to its assignment
                    direction=TripDirection.OUTBOUND,
                    status=TripStatus.SCHEDULED,
                    trip_number=f"TRP-{route.id}-{i}-O",
                    scheduled_start=t1_start,
                    scheduled_end=t1_end
                )
                db.add(t1)
                new_trips.append(t1)
                
                t2_start = t1_end + timedelta(minutes=15) # 15 min rest
                t2_end = t2_start + timedelta(minutes=route_mins)
                
                # Validate inbound trip doesn't exceed shift window
                if t2_end > end_dt:
                    logger.warning(f"Skipping inbound trip for driver {route_drivers[i].id} on route {route.id}: trip ends after shift ({t2_end} > {end_dt})")
                    continue
                    
                t2 = Trip(
                    driver_id=assignment.driver_id,
                    vehicle_id=assignment.vehicle_id,
                    route_id=route.id,
                    rotation_assignment_id=assignment.id,  # link trip to its assignment
                    direction=TripDirection.INBOUND,
                    status=TripStatus.SCHEDULED,
                    trip_number=f"TRP-{route.id}-{i}-I",
                    scheduled_start=t2_start,
                    scheduled_end=t2_end
                )
                db.add(t2)
                new_trips.append(t2)
    
    await db.commit()
    return new_trips

async def check_driver_fatigue(driver_id: int, db: AsyncSession) -> float:
    """
    Calculates fatigue score based on driving duration and intensity.
    """
    driver = await db.scalar(select(Driver).where(Driver.id == driver_id))
    if not driver:
        return 0.0
    
    # 20 points per hour driven in current session
    if driver.shift_start_time:
        now = datetime.now(timezone.utc)
        # Normalise shift_start_time to aware UTC in case a naive value was persisted
        sst = driver.shift_start_time
        if sst.tzinfo is None:
            sst = sst.replace(tzinfo=timezone.utc)
        duration = (now - sst).total_seconds() / 3600
        score = min(duration * 20.0, 100.0)
        driver.fatigue_score = score
        return score
    driver.fatigue_score = 0.0
    return 0.0

async def process_rotations(db: AsyncSession):
    """
    Background worker logic to check ongoing rotations and swap drivers.
    """
    # 1. Fetch ALL assignments for current shift (including swapped-out ones)
    now = datetime.now(timezone.utc)
    stmt = select(RotationAssignment).where(
        and_(
            RotationAssignment.shift_date == now.date(),
            RotationAssignment.shift_start_time <= now,
            RotationAssignment.shift_end_time >= now
        )
    )
    # Note: SQLAlchemy passes the aware datetime directly to PostgreSQL for comparison,
    # which handles TIMESTAMPTZ arithmetic correctly at the DB level.
    active_assignments = (await db.execute(stmt)).scalars().all()
    
    # Group by route to manage D1/D2/D3
    routes_work = {}
    for assignment in active_assignments:
        if assignment.route_id not in routes_work:
            routes_work[assignment.route_id] = []
        routes_work[assignment.route_id].append(assignment)

    for route_id, assignments in routes_work.items():
        # Map positions for easy access
        pos_map = {a.position: a for a in assignments}
        d1_a = pos_map.get(RotationPosition.DRIVER_1)
        d2_a = pos_map.get(RotationPosition.DRIVER_2)
        d3_a = pos_map.get(RotationPosition.DRIVER_3)

        if not (d1_a and d2_a and d3_a):
            continue

        # Check driving durations
        # If D1 has driven > 1h and D3 is resting -> Swap D1 with D3
        # If D2 has driven > 3h (2h since last swap) and D1 has rested > 2h -> Swap D2 with D1
        
        # Simplified swap logic for the "Ping-Pong"
        # We'll use a 'last_position_change' if we had it, but for now we'll check 
        # based on hours since shift start.
        
        # Normalise to aware UTC to guard against any legacy naive values in the column
        sst = d1_a.shift_start_time if d1_a else now
        if sst.tzinfo is None:
            sst = sst.replace(tzinfo=timezone.utc)
        hours_since_start = (now - sst).total_seconds() / 3600 if d1_a else 0

        # Stage 2: After 1 hour, D3 replaces D1
        if 1.0 <= hours_since_start < 3.0:
            if d1_a.is_active: # Driver 1 is currently driving
                await _perform_swap(db, d1_a, d3_a)
        
        # Stage 3: After 3 hours (1h in A + 2h rest for D1), D1 replaces D2
        elif 3.0 <= hours_since_start < 5.0:
            if d2_a.is_active:
                await _perform_swap(db, d2_a, d1_a)
        
        # Stage 4: After 5 hours, D2 replaces D3
        elif 5.0 <= hours_since_start < 7.0:
            if d3_a.is_active:
                await _perform_swap(db, d3_a, d2_a)

    await db.commit()

async def _perform_swap(db: AsyncSession, outgoing: RotationAssignment, incoming: RotationAssignment):
    """
    Swaps the driving status between two drivers.
    """
    logger.info(f"Swapping driver {outgoing.driver_id} with {incoming.driver_id}")
    outgoing.is_active = False
    incoming.is_active = True
    
    # Update Driver statuses in DB
    out_driver = await db.scalar(select(Driver).where(Driver.id == outgoing.driver_id))
    in_driver = await db.scalar(select(Driver).where(Driver.id == incoming.driver_id))
    
    if out_driver:
        out_driver.status = DriverStatus.ON_BREAK
    if in_driver:
        in_driver.status = DriverStatus.ACTIVE
        # L2: Only set shift_start_time if not already set (don't reset on swap)
        if not in_driver.shift_start_time:
            in_driver.shift_start_time = datetime.now(timezone.utc)

    exchange = DriverExchange(
        rotation_assignment_id=outgoing.id,
        outgoing_driver_id=outgoing.driver_id,
        incoming_driver_id=incoming.driver_id,
        reason=ReplacementReason.BREAK,
        exchange_time=datetime.now(timezone.utc),
        trip_id=None,
        notes="Rotation swap due to break schedule",
    )
    db.add(exchange)

async def trigger_auto_dispatch(trip_id: int, db: AsyncSession) -> bool:
    """
    Finds an available driver and vehicle to dispatch for an overloaded route.
    Returns True if successful, False if no resources available.
    """
    trip = await db.scalar(select(Trip).where(Trip.id == trip_id))
    if not trip:
        return False
        
    # C3: Only dispatch ACTIVE drivers who are assigned as DRIVER_3 today
    # Use row-level locking to prevent race conditions
    today = datetime.now(timezone.utc).date()
    driver = await db.scalar(
        select(Driver)
        .join(RotationAssignment, Driver.id == RotationAssignment.driver_id)
        .where(
            Driver.status == DriverStatus.ACTIVE,
            RotationAssignment.shift_date == today,
            RotationAssignment.position == RotationPosition.DRIVER_3
        )
        .limit(1).with_for_update()
    )
    if not driver:
        logger.warning(f"Auto-dispatch failed for trip {trip_id}: No available D3 drivers.")
        return False
        
    # Find a free vehicle with row-level locking
    vehicle = await db.scalar(
        select(Vehicle).where(Vehicle.status == VehicleStatus.FREE).limit(1).with_for_update()
    )
    if not vehicle:
        logger.warning(f"Auto-dispatch failed for trip {trip_id}: No available vehicles.")
        return False
        
    # D1: Calculate scheduled_end for the extra dispatch trip
    route = await db.scalar(select(Route).where(Route.id == trip.route_id))
    est_minutes = route.estimated_time_minutes if route else 60
    now_utc = datetime.now(timezone.utc)
    dispatch_start = now_utc + timedelta(minutes=5)
    
    new_trip = Trip(
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        route_id=trip.route_id,
        direction=trip.direction,
        status=TripStatus.SCHEDULED,
        trip_number=f"EXT-RT{trip.route_id}-{now_utc.strftime('%H%M')}-{uuid.uuid4().hex[:6]}",
        scheduled_start=dispatch_start,
        scheduled_end=dispatch_start + timedelta(minutes=est_minutes),
        is_extra_dispatch=True,
        notes=f"Auto-dispatched to relieve overload on {trip.trip_number}"
    )
    db.add(new_trip)
    
    # Mark resources as in-use
    driver.status = DriverStatus.ON_TRIP
    vehicle.status = VehicleStatus.ASSIGNED

    # Resolve the D3 rotation assignment ID for the outgoing driver.
    # We need a valid FK — query for the assignment rather than using a fallback of 0.
    outgoing_assignment_id = trip.rotation_assignment_id
    if not outgoing_assignment_id:
        outgoing_assignment = await db.scalar(
            select(RotationAssignment)
            .where(
                RotationAssignment.driver_id == trip.driver_id,
                RotationAssignment.shift_date == today,
                RotationAssignment.position == RotationPosition.DRIVER_3,
            )
            .limit(1)
        )
        if outgoing_assignment:
            outgoing_assignment_id = outgoing_assignment.id
        else:
            logger.warning(
                f"Auto-dispatch: no DRIVER_3 assignment found for driver {trip.driver_id} on {today}. "
                "DriverExchange record will be skipped to avoid FK violation."
            )
            await db.commit()
            logger.info(f"Auto-dispatch successful (no exchange record): Driver {driver.id}, Vehicle {vehicle.id}, Route {trip.route_id}")
            return True

    await db.flush()  # flush new_trip to get new_trip.id before referencing it

    exchange = DriverExchange(
        rotation_assignment_id=outgoing_assignment_id,
        outgoing_driver_id=trip.driver_id,
        incoming_driver_id=driver.id,
        reason=ReplacementReason.EMERGENCY_CROWDING,
        exchange_time=datetime.now(timezone.utc),
        trip_id=new_trip.id,
        notes=f"Auto-dispatch for crowding on trip {trip.trip_number}",
    )
    db.add(exchange)

    await db.commit()
    logger.info(f"Auto-dispatch successful: Deployed Driver {driver.id} and Vehicle {vehicle.id} on route {trip.route_id}")
    return True
