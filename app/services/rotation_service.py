from datetime import date, datetime, timedelta, time, timezone
from typing import List, Optional
from sqlalchemy import select, and_, or_, func, update
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
            trip_ids_stmt = select(Trip.id).where(cast(Trip.scheduled_start, Date) == target_date)
            rotation_ids_stmt = select(RotationAssignment.id).where(RotationAssignment.shift_date == target_date)

            # Collect affected driver/vehicle IDs before deleting
            affected = (await db.execute(
                select(Trip.driver_id, Trip.vehicle_id).where(cast(Trip.scheduled_start, Date) == target_date)
            )).all()
            driver_ids = list({r[0] for r in affected if r[0]})
            vehicle_ids = list({r[1] for r in affected if r[1]})

            # Delete DriverExchange first — FKs both rotation_assignments AND trips
            await db.execute(
                delete(DriverExchange).where(
                    or_(
                        DriverExchange.rotation_assignment_id.in_(rotation_ids_stmt),
                        DriverExchange.trip_id.in_(trip_ids_stmt)
                    )
                )
            )
            await db.execute(delete(Ticket).where(Ticket.trip_id.in_(trip_ids_stmt)))
            await db.execute(delete(Trip).where(cast(Trip.scheduled_start, Date) == target_date))
            await db.execute(delete(RotationAssignment).where(RotationAssignment.shift_date == target_date))

            # Reset affected drivers and vehicles so they're available for the new schedule
            if driver_ids:
                await db.execute(
                    update(Driver).where(Driver.id.in_(driver_ids)).values(
                        status=DriverStatus.OFF_DUTY,
                        current_vehicle_id=None,
                        current_route_id=None,
                        current_shift=None,
                        shift_start_time=None,
                        shift_end_time=None,
                    )
                )
            if vehicle_ids:
                await db.execute(
                    update(Vehicle).where(Vehicle.id.in_(vehicle_ids)).values(status=VehicleStatus.FREE)
                )

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
    skipped_routes: list[tuple[str, str]] = []  # (route_name, reason)

    # Generate schedules for both shifts based on settings
    from app.core.config import settings
    shifts = [
        (ShiftType.MORNING, settings.MORNING_SHIFT_START, settings.MORNING_SHIFT_END),
        (ShiftType.EVENING, settings.EVENING_SHIFT_START, settings.EVENING_SHIFT_END),
    ]

    for route in routes:
        for shift_type, start_hour, end_hour in shifts:
            # Don't silently break — record the skip and keep generating
            # the remaining routes/shifts so the admin sees what couldn't be staffed.
            if len(available_drivers) < 3 or len(available_vehicles) < 2:
                reason = (
                    f"insufficient pool for {shift_type.value} "
                    f"(drivers_left={len(available_drivers)}, vehicles_left={len(available_vehicles)}; "
                    f"need 3 drivers + 2 vehicles)"
                )
                logger.error(
                    f"generate_daily_schedule: route '{route.name}' (id={route.id}) skipped — {reason}"
                )
                skipped_routes.append((route.name, reason))
                continue
            
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

    # Notify admins about routes that couldn't be staffed.
    if skipped_routes:
        try:
            from app.services.notification_service import create_notification
            from app.models.models import UserRole, User
            admin_ids = (await db.execute(
                select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True)
            )).scalars().all()
            summary = "; ".join(f"{name} — {reason}" for name, reason in skipped_routes[:5])
            if len(skipped_routes) > 5:
                summary += f" (+{len(skipped_routes) - 5} more)"
            for admin_id in admin_ids:
                await create_notification(
                    db=db,
                    user_id=admin_id,
                    title=f"Schedule generation: {len(skipped_routes)} route(s) unstaffed",
                    message=summary,
                    type="SCHEDULE_GAP",
                )
            await db.commit()
        except Exception as exc:
            logger.exception(f"Failed to send schedule-gap notifications: {exc}")

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

async def assign_break_replacement(
    db: AsyncSession,
    outgoing_driver: Driver,
    break_log,
) -> Optional[Driver]:
    """
    When a driver goes on break, find a replacement and hand off any of their
    SCHEDULED trips that haven't started yet.

    Replacement priority (today's roster first, then anyone available):
      1. Inactive D3 on the same route as the outgoing driver
      2. Any rostered driver today whose RotationAssignment is inactive
      3. Any ACTIVE driver not currently driving (no ACTIVE trip)
      4. Any OFF_DUTY driver who could be pulled in

    Returns the replacement Driver, or None if no replacement was found.
    """
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)

    # Outgoing driver's rotation assignment for today (used for FK + route lookup)
    outgoing_assignment = await db.scalar(
        select(RotationAssignment).where(
            RotationAssignment.driver_id == outgoing_driver.id,
            RotationAssignment.shift_date == today,
        ).limit(1)
    )

    # 1. Same-route inactive D3 (the canonical "rest" driver for that bus)
    replacement: Optional[Driver] = None
    if outgoing_assignment:
        replacement = await db.scalar(
            select(Driver)
            .join(RotationAssignment, RotationAssignment.driver_id == Driver.id)
            .where(
                RotationAssignment.shift_date == today,
                RotationAssignment.route_id == outgoing_assignment.route_id,
                RotationAssignment.position == RotationPosition.DRIVER_3,
                RotationAssignment.is_active == False,  # noqa: E712
                Driver.id != outgoing_driver.id,
                Driver.status.in_([DriverStatus.ACTIVE, DriverStatus.ON_BREAK]),
            )
            .limit(1)
            .with_for_update()
        )

    # 2. Any rostered, currently-inactive driver
    if replacement is None:
        replacement = await db.scalar(
            select(Driver)
            .join(RotationAssignment, RotationAssignment.driver_id == Driver.id)
            .where(
                RotationAssignment.shift_date == today,
                RotationAssignment.is_active == False,  # noqa: E712
                Driver.id != outgoing_driver.id,
                Driver.status == DriverStatus.ACTIVE,
            )
            .limit(1)
            .with_for_update()
        )

    # 3. Any ACTIVE driver not currently on a trip
    if replacement is None:
        busy_driver_ids = (await db.execute(
            select(Trip.driver_id).where(Trip.status == TripStatus.ACTIVE)
        )).scalars().all()
        replacement = await db.scalar(
            select(Driver)
            .where(
                Driver.id != outgoing_driver.id,
                Driver.status == DriverStatus.ACTIVE,
                ~Driver.id.in_(busy_driver_ids) if busy_driver_ids else Driver.id == Driver.id,
                Driver.fatigue_score <= 80.0,
            )
            .limit(1)
            .with_for_update()
        )

    # 4. Any OFF_DUTY driver as last resort
    if replacement is None:
        replacement = await db.scalar(
            select(Driver)
            .where(
                Driver.status == DriverStatus.OFF_DUTY,
                Driver.id != outgoing_driver.id,
                Driver.fatigue_score <= 80.0,
            )
            .limit(1)
            .with_for_update()
        )

    if replacement is None:
        logger.warning(
            f"No replacement found for break: driver={outgoing_driver.id} on {today}"
        )
        return None

    # Hand off SCHEDULED trips that haven't started yet to the replacement.
    pending_trips = (await db.execute(
        select(Trip).where(
            Trip.driver_id == outgoing_driver.id,
            Trip.status == TripStatus.SCHEDULED,
            Trip.scheduled_start >= now,
        )
    )).scalars().all()
    for t in pending_trips:
        t.driver_id = replacement.id

    # Activate replacement: flip rotation flags + driver status.
    if outgoing_assignment:
        outgoing_assignment.is_active = False
    replacement_assignment = await db.scalar(
        select(RotationAssignment).where(
            RotationAssignment.driver_id == replacement.id,
            RotationAssignment.shift_date == today,
        ).limit(1)
    )
    if replacement_assignment:
        replacement_assignment.is_active = True
        if not replacement_assignment.shift_start_time:
            replacement_assignment.shift_start_time = now

    # Replacement keeps ACTIVE; do not override ON_TRIP if they're already on one
    if replacement.status not in (DriverStatus.ON_TRIP,):
        replacement.status = DriverStatus.ACTIVE
    if replacement.status == DriverStatus.OFF_DUTY:
        replacement.shift_start_time = now

    # DriverExchange row (require a valid rotation_assignment FK)
    rotation_id_for_exchange = (
        outgoing_assignment.id if outgoing_assignment else
        (replacement_assignment.id if replacement_assignment else None)
    )
    if rotation_id_for_exchange is not None:
        db.add(DriverExchange(
            rotation_assignment_id=rotation_id_for_exchange,
            outgoing_driver_id=outgoing_driver.id,
            incoming_driver_id=replacement.id,
            reason=ReplacementReason.BREAK,
            exchange_time=now,
            trip_id=None,
            notes=f"Break replacement: covering {len(pending_trips)} pending trip(s)",
        ))

    # Annotate the BreakLog with the replacement
    if break_log is not None:
        break_log.replaced_by_driver_id = replacement.id

    # Notify both drivers
    try:
        from app.services.notification_service import create_notification
        await create_notification(
            db=db,
            user_id=replacement.user_id,
            title="You're covering a break",
            message=(
                f"Driver {outgoing_driver.id} is on break. "
                f"{len(pending_trips)} pending trip(s) reassigned to you."
            ),
            type="break_replacement",
        )
        await create_notification(
            db=db,
            user_id=outgoing_driver.user_id,
            title="Break started",
            message=f"Replacement assigned. {len(pending_trips)} pending trip(s) handed off.",
            type="break_started",
        )
    except Exception as exc:
        logger.warning(f"Break-replacement notification failed: {exc}")

    return replacement


async def release_break_replacement(
    db: AsyncSession,
    returning_driver: Driver,
) -> Optional[Driver]:
    """
    When a driver returns from break, close out the open BREAK exchange:
      - return SCHEDULED-not-started trips to the original driver
      - set DriverExchange.return_time
      - flip rotation is_active back

    Best-effort: if the replacement is mid-trip, that trip stays with them.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    exchange = await db.scalar(
        select(DriverExchange).where(
            DriverExchange.outgoing_driver_id == returning_driver.id,
            DriverExchange.reason == ReplacementReason.BREAK,
            DriverExchange.return_time.is_(None),
        ).order_by(DriverExchange.exchange_time.desc()).limit(1)
    )
    if not exchange:
        return None

    replacement = await db.scalar(
        select(Driver).where(Driver.id == exchange.incoming_driver_id)
    )

    # Return any trips that haven't started yet to the original driver.
    if replacement is not None:
        pending_trips = (await db.execute(
            select(Trip).where(
                Trip.driver_id == replacement.id,
                Trip.status == TripStatus.SCHEDULED,
                Trip.scheduled_start >= now,
            )
        )).scalars().all()
        for t in pending_trips:
            t.driver_id = returning_driver.id

    exchange.return_time = now

    # Restore rotation flags
    outgoing_assignment = await db.scalar(
        select(RotationAssignment).where(
            RotationAssignment.driver_id == returning_driver.id,
            RotationAssignment.shift_date == today,
        ).limit(1)
    )
    if outgoing_assignment:
        outgoing_assignment.is_active = True

    if replacement is not None:
        replacement_assignment = await db.scalar(
            select(RotationAssignment).where(
                RotationAssignment.driver_id == replacement.id,
                RotationAssignment.shift_date == today,
            ).limit(1)
        )
        if replacement_assignment and replacement_assignment.position == RotationPosition.DRIVER_3:
            # D3 returns to standby unless they're mid-trip
            replacement_assignment.is_active = False

    return replacement


async def trigger_auto_dispatch(trip_id: int, db: AsyncSession) -> bool:
    """
    Finds an available driver and vehicle to dispatch for an overloaded route.
    Returns True if successful, False if no resources available.

    Driver-selection priority (fatigue_score <= 80 required):
      1. ACTIVE  drivers assigned as DRIVER_3 today (rostered)
      2. ON_BREAK drivers assigned as DRIVER_3 today (rostered)
      3. Any ACTIVE  driver rostered today
      4. Any ON_BREAK driver rostered today
      5. Fallback: any OFF_DUTY driver (not yet started shift) — used when
         no roster exists (e.g. manual/testing scenarios)
    """
    trip = await db.scalar(select(Trip).where(Trip.id == trip_id))
    if not trip:
        return False

    today = datetime.now(timezone.utc).date()

    async def _pick_rostered(status_value: DriverStatus, only_d3: bool) -> Optional[Driver]:
        stmt = (
            select(Driver)
            .join(RotationAssignment, Driver.id == RotationAssignment.driver_id)
            .where(
                Driver.status == status_value,
                RotationAssignment.shift_date == today,
                Driver.id != trip.driver_id,
                Driver.fatigue_score <= 80.0,
            )
        )
        if only_d3:
            stmt = stmt.where(RotationAssignment.position == RotationPosition.DRIVER_3)
        return await db.scalar(stmt.limit(1).with_for_update())

    async def _pick_any_off_duty() -> Optional[Driver]:
        return await db.scalar(
            select(Driver)
            .where(
                Driver.status == DriverStatus.OFF_DUTY,
                Driver.id != trip.driver_id,
                Driver.fatigue_score <= 80.0,
            )
            .limit(1)
            .with_for_update()
        )

    driver = (
        await _pick_rostered(DriverStatus.ACTIVE,   only_d3=True)
        or await _pick_rostered(DriverStatus.ON_BREAK, only_d3=True)
        or await _pick_rostered(DriverStatus.ACTIVE,   only_d3=False)
        or await _pick_rostered(DriverStatus.ON_BREAK, only_d3=False)
        or await _pick_any_off_duty()
    )
    if not driver:
        logger.warning(
            f"Auto-dispatch failed for trip {trip_id}: no available driver "
            f"(checked rostered ACTIVE/ON_BREAK and OFF_DUTY fallback; fatigue_score<=80)."
        )
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
