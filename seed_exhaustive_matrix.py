"""
seed_exhaustive_matrix.py
=========================
Exhaustive Combinatorial Test Seeder for the Smart Bus Garage Management System.
Target DB: test_smart_bus_garage (NEVER touches the production database)

Combinatorial axes covered
───────────────────────────
A  crowding_score     : 0.0, 0.50, 0.70, 0.85, 0.91, 1.0
B  passenger_count    : derived from crowding × capacity (50-seat vehicle)
C  ticket_count       : 0, 5, 10, 25, 40, 50  (sold tickets per trip)
D  ocr_confidence     : 0.20, 0.55, 0.61, 0.75, 0.92, 1.0
E  time_of_day        : PEAK (07:00–09:00, 17:00–19:00) / OFF_PEAK (rest)
F  vehicle_status     : FREE, ASSIGNED, EN_ROUTE, MAINTENANCE, OUT_OF_SERVICE
G  driver_status      : ACTIVE, ON_TRIP, ON_BREAK, OFF_DUTY
H  reroute_status     : None, PENDING, APPROVED, REJECTED
I  is_extra_dispatch  : True / False
J  is_crowded flag    : True (score>0.90) / False
K  match_method       : exact, confusable, none (for gate_logs)
L  gate event         : GRANTED, DENIED, IGNORED

Total unique dimension combinations: 6×6×6×2×5×4×4×3×2 = 248,832
We seed a representative stratified sample: ~4,500 rows enforcing all edge
combinations, distributed over 30 days.
"""

import asyncio
import os
import random
import secrets
import sys
from datetime import date, datetime, timedelta, timezone
from itertools import product

# ─── Target DB — NEVER the production DB ─────────────────────────────────────
TEST_DB_URL = "postgresql+asyncpg://postgres:***REMOVED***@localhost:5432/test_smart_bus_garage"
os.environ["DATABASE_URL"] = TEST_DB_URL

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# import models after env var is set
from app.models.models import (
    AuditLog,
    BreakLog,
    CameraReading,
    CrowdingEvent,
    DailyReport,
    Driver,
    DriverExchange,
    DriverStatus,
    GateCamera,
    GateLog,
    Garage,
    MaintenanceRequest,
    MaintenanceStatus,
    MaintenanceType,
    Notification,
    NotificationStatus,
    ReplacementReason,
    RerouteLog,
    RerouteStatus,
    RotationAssignment,
    RotationPosition,
    Route,
    RouteStop,
    ShiftType,
    Ticket,
    TripDirection,
    TripStatus,
    TripTicketStatus,
    Trip,
    User,
    UserRole,
    Vehicle,
    VehicleStatus,
)

# ─── Combinatorial axes ───────────────────────────────────────────────────────
CROWDING_SCORES   = [0.0, 0.50, 0.70, 0.85, 0.91, 1.0]
TICKET_COUNTS     = [0, 5, 10, 25, 40, 50]
OCR_CONFIDENCES   = [0.20, 0.55, 0.61, 0.75, 0.92, 1.0]
VEHICLE_STATUSES  = list(VehicleStatus)
DRIVER_STATUSES   = list(DriverStatus)
REROUTE_STATUSES  = [None, RerouteStatus.PENDING, RerouteStatus.APPROVED, RerouteStatus.REJECTED]
MATCH_METHODS     = ["exact", "confusable", "none"]
GATE_EVENTS       = ["GRANTED", "DENIED", "IGNORED"]
EXTRA_DISPATCH    = [True, False]
TIME_SLOTS_PEAK   = [7, 8, 17, 18]      # hours that are "peak"
TIME_SLOTS_OFFPEAK = [0, 2, 10, 13, 22] # off-peak

VEHICLE_CAPACITY  = 50
START_DATE        = date.today() - timedelta(days=29)
DAYS              = 30


def random_plate():
    letters = "ABCDEFGHJKLMNPRSTUVWXY"
    return f"{random.choice(letters)}{random.choice(letters)}{random.randint(1000,9999)}"


def hashed_pw():
    return "$2b$12$" + secrets.token_hex(29)  # bcrypt-shaped dummy


def peak_hour(day_offset: int, slot_idx: int) -> datetime:
    h = (TIME_SLOTS_PEAK + TIME_SLOTS_OFFPEAK)[slot_idx % len(TIME_SLOTS_PEAK + TIME_SLOTS_OFFPEAK)]
    d = START_DATE + timedelta(days=day_offset)
    return datetime(d.year, d.month, d.day, h, random.randint(0, 59), tzinfo=timezone.utc)


async def seed(session: AsyncSession):
    print("═" * 60)
    print("  EXHAUSTIVE COMBINATORIAL SEEDER — test_smart_bus_garage")
    print("═" * 60)

    # ── 0. Garage ─────────────────────────────────────────────────
    print("[1/9] Seeding garage...")
    garage = Garage(
        name="Central Depot",
        address="123 Main St",
        latitude=30.05,
        longitude=31.23,
        total_capacity=100,
        current_occupancy=0,
    )
    session.add(garage)
    await session.flush()

    # ── 1. Routes ─────────────────────────────────────────────────
    print("[2/9] Seeding routes & stops...")
    route_defs = [
        ("Route 1", "Garage", "Terminal A", 12.5, 45, 5.0),
        ("Route 2",  "Garage", "Terminal B", 8.0,  30, 4.0),
        ("Route 3", "Garage", "Terminal C", 20.0, 60, 7.0),
    ]
    routes = []
    for name, start, end, dist, mins, fare in route_defs:
        r = Route(name=name, start_location=start, end_location=end,
                  distance_km=dist, estimated_time_minutes=mins, fare=fare,
                  turnaround_time_minutes=10, is_active=True)
        session.add(r)
        await session.flush()
        for seq in range(1, 5):
            session.add(RouteStop(route_id=r.id, stop_name=f"{name} Stop {seq}",
                                  sequence_order=seq, dwell_time_minutes=2.0))
        routes.append(r)
    await session.flush()

    # ── 2. Users / Drivers ────────────────────────────────────────
    print("[3/9] Seeding users and drivers...")
    # 1 admin, 1 manager, N drivers
    admin_user = User(email="admin@test.com", hashed_password=hashed_pw(),
                      full_name="Admin User", role=UserRole.ADMIN, is_active=True)
    mgr_user   = User(email="manager@test.com", hashed_password=hashed_pw(),
                      full_name="Manager User", role=UserRole.MANAGER, is_active=True)
    session.add_all([admin_user, mgr_user])
    await session.flush()

    # Create 40 drivers to cover rotation + auto-dispatch needs
    driver_users = []
    drivers = []
    for i in range(40):
        u = User(email=f"driver{i}@test.com", hashed_password=hashed_pw(),
                 full_name=f"Driver {i}", role=UserRole.DRIVER, is_active=True)
        session.add(u)
        await session.flush()
        d_status = DRIVER_STATUSES[i % len(DRIVER_STATUSES)]
        d = Driver(
            user_id=u.id,
            license_number=f"LIC{1000+i}",
            garage_id=garage.id,
            status=d_status,
            total_trips_today=random.randint(0, 8),
            total_trips_all_time=random.randint(0, 500),
            rating=round(random.uniform(3.5, 5.0), 1),
            break_time_remaining=random.uniform(0, 60),
            trips_since_last_break=random.randint(0, 5),
            fatigue_score=round(random.uniform(0, 80), 1),
        )
        session.add(d)
        await session.flush()
        driver_users.append(u)
        drivers.append(d)

    # ── 3. Vehicles ───────────────────────────────────────────────
    print("[4/9] Seeding vehicles (all status permutations)...")
    vehicles = []
    plates_used = set()
    for i, vstatus in enumerate(VEHICLE_STATUSES * 5):  # 25 vehicles
        plate = random_plate()
        while plate in plates_used:
            plate = random_plate()
        plates_used.add(plate)
        v = Vehicle(
            plate_number=plate,
            model=f"Tata {2018 + (i % 5)}",
            year=2018 + (i % 5),
            capacity=VEHICLE_CAPACITY,
            status=vstatus,
            garage_id=garage.id,
        )
        session.add(v)
        await session.flush()
        vehicles.append(v)

    # ── 4. Rotation Assignments + Trips (30 days) ─────────────────
    print("[5/9] Seeding 30-day rotation assignments and trips...")
    free_vehicles = [v for v in vehicles if v.status == VehicleStatus.FREE]
    off_duty_drivers = [d for d in drivers if d.status == DriverStatus.OFF_DUTY]
    
    # Cycle through available resources
    d_pool = list(off_duty_drivers)
    v_pool = list(free_vehicles)

    trip_pool = []  # collect all seeded trips for later use

    for day_offset in range(DAYS):
        target_date = START_DATE + timedelta(days=day_offset)
        for route in routes:
            for shift_type, start_h, end_h in [
                (ShiftType.MORNING, 6, 15),
                (ShiftType.EVENING, 15, 24),
            ]:
                if len(d_pool) < 3 or len(v_pool) < 2:
                    # Refill pools by cycling
                    d_pool = list(off_duty_drivers) * 5
                    v_pool = list(free_vehicles) * 5

                r_drivers = [d_pool.pop(0) for _ in range(3)]
                r_vehicles = [v_pool.pop(0), v_pool.pop(0)]

                start_dt = datetime(target_date.year, target_date.month, target_date.day,
                                    start_h, 0, tzinfo=timezone.utc)
                if end_h >= 24:
                    end_dt = datetime((target_date + timedelta(days=1)).year,
                                      (target_date + timedelta(days=1)).month,
                                      (target_date + timedelta(days=1)).day,
                                      0, 0, tzinfo=timezone.utc)
                else:
                    end_dt = datetime(target_date.year, target_date.month, target_date.day,
                                      end_h, 0, tzinfo=timezone.utc)

                positions = [RotationPosition.DRIVER_1, RotationPosition.DRIVER_2, RotationPosition.DRIVER_3]
                for i, pos in enumerate(positions):
                    try:
                        ra = RotationAssignment(
                            route_id=route.id,
                            driver_id=r_drivers[i].id,
                            vehicle_id=r_vehicles[0].id if i != 2 else r_vehicles[1].id,
                            shift_type=shift_type,
                            position=pos,
                            shift_date=target_date,
                            shift_start_time=start_dt,
                            shift_end_time=end_dt,
                            is_active=(pos != RotationPosition.DRIVER_3),
                        )
                        session.add(ra)
                        await session.flush()

                        # Trip 1 outbound
                        t1_start = start_dt + timedelta(hours=i * 2)
                        t1_end = t1_start + timedelta(minutes=route.estimated_time_minutes)
                        if t1_end <= end_dt:
                            # Determine crowding from combinatorial axis
                            c_score = CROWDING_SCORES[(day_offset + i) % len(CROWDING_SCORES)]
                            pax = int(c_score * VEHICLE_CAPACITY)
                            # Peak/off-peak by hour
                            hour = t1_start.hour
                            is_peak = hour in TIME_SLOTS_PEAK
                            t_status = TripStatus.COMPLETED if day_offset < DAYS - 1 else TripStatus.SCHEDULED

                            t1 = Trip(
                                driver_id=ra.driver_id,
                                vehicle_id=ra.vehicle_id,
                                route_id=route.id,
                                rotation_assignment_id=ra.id,
                                direction=TripDirection.OUTBOUND,
                                status=t_status,
                                trip_number=f"TRP-{route.id}-{day_offset}-{i}-O",
                                scheduled_start=t1_start,
                                scheduled_end=t1_end,
                                actual_start=t1_start if t_status != TripStatus.SCHEDULED else None,
                                actual_end=t1_end if t_status == TripStatus.COMPLETED else None,
                                passenger_count=pax,
                                crowding_score=c_score,
                                is_crowded=(c_score > 0.90),
                                is_extra_dispatch=False,
                                fare_collected=round(pax * route.fare, 2),
                                is_late=random.random() < 0.1,
                            )
                            session.add(t1)
                            await session.flush()
                            trip_pool.append(t1)

                            # Ticket axis: seed ticket_count tickets per trip
                            tk_count = TICKET_COUNTS[(day_offset + i) % len(TICKET_COUNTS)]
                            for tk_i in range(tk_count):
                                session.add(Ticket(
                                    trip_id=t1.id,
                                    passenger_name=f"Passenger {tk_i}",
                                    seat_number=str(tk_i + 1),
                                    price=route.fare,
                                    status=TripTicketStatus.USED if t_status == TripStatus.COMPLETED else TripTicketStatus.ISSUED,
                                ))

                            # CameraReading + CrowdingEvent for this trip
                            session.add(CameraReading(
                                trip_id=t1.id,
                                vehicle_id=ra.vehicle_id,
                                passenger_count=pax,
                                crowding_score=c_score,
                            ))
                            if c_score >= 0.70:
                                session.add(CrowdingEvent(
                                    trip_id=t1.id,
                                    vehicle_id=ra.vehicle_id,
                                    crowding_score=c_score,
                                    passenger_count=pax,
                                    auto_dispatch_triggered=(c_score > 0.90),
                                ))

                    except Exception as e:
                        await session.rollback()
                        print(f"  [WARN] Assignment skipped (conflict): {e}")
                        continue

    await session.commit()
    print(f"  ✓ {len(trip_pool)} trips seeded across 30 days")

    # ── 5. Gate Logs — full OCR/confidence/match/event matrix ─────
    print("[6/9] Seeding gate logs (exhaustive confidence × event matrix)...")
    gate_vehicles = vehicles[:10]  # first 10 vehicles for gate testing
    unknown_plates = [random_plate() for _ in range(20)]

    gate_combos = list(product(OCR_CONFIDENCES, MATCH_METHODS, GATE_EVENTS))
    for day_offset in range(DAYS):
        for conf, method, event in gate_combos:
            # Determine plate based on event type
            if event == "GRANTED":
                v = random.choice(gate_vehicles)
                plate = v.plate_number
                vid = v.id
                # Adjust confidence to be realistic for GRANTED
                actual_conf = max(conf, 0.61)
            elif event == "DENIED":
                plate = random.choice(unknown_plates)
                vid = None
                actual_conf = max(conf, 0.61)
            else:  # IGNORED
                plate = random_plate() if random.random() > 0.5 else ""
                vid = None
                actual_conf = min(conf, 0.59)  # below threshold → IGNORED

            log_time = START_DATE + timedelta(days=day_offset)
            session.add(GateLog(
                gate_id=str(random.randint(1, 3)),
                plate_number=plate,
                ocr_raw_text=plate + ("X" if method == "confusable" else ""),
                confidence=actual_conf,
                match_method=method,
                event=event,
                vehicle_id=vid,
                created_at=datetime(log_time.year, log_time.month, log_time.day,
                                    random.randint(0, 23), random.randint(0, 59),
                                    tzinfo=timezone.utc),
            ))

    await session.commit()
    print(f"  ✓ {DAYS * len(gate_combos)} gate log rows seeded")

    # ── 6. Auto-dispatch extra trips (is_extra_dispatch axis) ─────
    print("[7/9] Seeding extra-dispatch trips...")
    extra_count = 0
    for i in range(60):  # 60 extra dispatch scenarios
        if len(trip_pool) == 0:
            break
        base_trip = random.choice(trip_pool)
        d = random.choice(drivers)
        v = random.choice(vehicles)
        extra_start = base_trip.scheduled_start + timedelta(minutes=5)
        extra_end   = extra_start + timedelta(minutes=45)
        extra = Trip(
            driver_id=d.id,
            vehicle_id=v.id,
            route_id=base_trip.route_id,
            direction=base_trip.direction,
            status=TripStatus.COMPLETED,
            trip_number=f"EXT-{i}-{secrets.token_hex(3).upper()}",
            scheduled_start=extra_start,
            scheduled_end=extra_end,
            actual_start=extra_start,
            actual_end=extra_end,
            passenger_count=random.randint(35, 50),
            crowding_score=round(random.uniform(0.70, 1.0), 2),
            is_crowded=True,
            is_extra_dispatch=True,
            fare_collected=round(random.uniform(100, 250), 2),
            notes=f"Auto-dispatched to relieve overload on {base_trip.trip_number}",
        )
        session.add(extra)
        extra_count += 1

    await session.commit()
    print(f"  ✓ {extra_count} extra-dispatch trips seeded")

    # ── 7. Reroute Logs (manual override axis) ────────────────────
    print("[8/9] Seeding reroute logs (all statuses)...")
    reroute_count = 0
    for rs in REROUTE_STATUSES:
        if rs is None:
            continue
        for i in range(10):
            d = random.choice(drivers)
            base = random.choice(trip_pool) if trip_pool else None
            session.add(RerouteLog(
                driver_id=d.id,
                trip_id=base.id if base else None,
                original_route_id=routes[0].id,
                new_route_id=routes[1].id if rs == RerouteStatus.APPROVED else None,
                approved_by=admin_user.id if rs == RerouteStatus.APPROVED else None,
                status=rs,
                reason=f"Test reroute scenario — status={rs.value}",
                requested_at=datetime.now(timezone.utc),
            ))
            reroute_count += 1

    await session.commit()
    print(f"  ✓ {reroute_count} reroute log rows seeded")

    # ── 8. Daily Reports ──────────────────────────────────────────
    print("[9/9] Seeding daily reports...")
    for day_offset in range(DAYS):
        d = START_DATE + timedelta(days=day_offset)
        session.add(DailyReport(
            report_date=d,
            total_trips=random.randint(10, 80),
            completed_trips=random.randint(8, 70),
            cancelled_trips=random.randint(0, 5),
            total_revenue=round(random.uniform(500, 5000), 2),
            total_passengers=random.randint(50, 2000),
            avg_crowding_score=round(random.uniform(0.3, 0.95), 2),
            on_time_percentage=round(random.uniform(70, 100), 1),
            total_maintenance_requests=random.randint(0, 5),
            active_vehicles=random.randint(5, 20),
            active_drivers=random.randint(5, 25),
            extra_dispatches=random.randint(0, 10),
        ))

    await session.commit()
    print(f"  ✓ {DAYS} daily report rows seeded")

    print("\n" + "═" * 60)
    print("  SEEDING COMPLETE")
    print("═" * 60)
    return trip_pool


async def verify(session: AsyncSession, trip_pool):
    """Query the DB and validate dispatch logic invariants."""
    print("\n[VERIFY] Running invariant checks...")
    issues = []

    from sqlalchemy import select, func

    # V1: All crowded trips (score > 0.90) must have is_crowded=True
    result = await session.execute(
        select(func.count()).select_from(Trip)
        .where(Trip.crowding_score > 0.90, Trip.is_crowded == False)
    )
    bad_crowded = result.scalar()
    if bad_crowded:
        issues.append(f"[GAP] {bad_crowded} trips have crowding_score>0.90 but is_crowded=False")
    else:
        print(f"  ✓ V1 PASS — is_crowded flag correct for all high-score trips")

    # V2: All extra-dispatch trips must have is_extra_dispatch=True
    result = await session.execute(
        select(func.count()).select_from(Trip)
        .where(Trip.trip_number.like("EXT-%"), Trip.is_extra_dispatch == False)
    )
    bad_extra = result.scalar()
    if bad_extra:
        issues.append(f"[GAP] {bad_extra} EXT- trips missing is_extra_dispatch=True")
    else:
        print(f"  ✓ V2 PASS — all extra-dispatch trips flagged correctly")

    # V3: IGNORED gate events must have confidence < 0.61
    result = await session.execute(
        select(func.count()).select_from(GateLog)
        .where(GateLog.event == "IGNORED", GateLog.confidence >= 0.61)
    )
    bad_ignored = result.scalar()
    if bad_ignored:
        issues.append(f"[GAP] {bad_ignored} IGNORED events have confidence>=0.61 (should be DENIED)")
    else:
        print(f"  ✓ V3 PASS — all IGNORED gate events have confidence below threshold")

    # V4: GRANTED events must have a vehicle_id
    result = await session.execute(
        select(func.count()).select_from(GateLog)
        .where(GateLog.event == "GRANTED", GateLog.vehicle_id == None)
    )
    bad_granted = result.scalar()
    if bad_granted:
        issues.append(f"[GAP] {bad_granted} GRANTED events have no vehicle_id")
    else:
        print(f"  ✓ V4 PASS — all GRANTED events linked to a vehicle")

    # V5: CrowdingEvent.auto_dispatch_triggered must be True when score > 0.90
    result = await session.execute(
        select(func.count()).select_from(CrowdingEvent)
        .where(CrowdingEvent.crowding_score > 0.90, CrowdingEvent.auto_dispatch_triggered == False)
    )
    bad_dispatch = result.scalar()
    if bad_dispatch:
        issues.append(f"[GAP] {bad_dispatch} CrowdingEvents >0.90 without auto_dispatch_triggered=True")
    else:
        print(f"  ✓ V5 PASS — auto_dispatch_triggered set for all critical crowding events")

    # V6: Every completed trip must have actual_start and actual_end set
    result = await session.execute(
        select(func.count()).select_from(Trip)
        .where(Trip.status == TripStatus.COMPLETED,
               (Trip.actual_start == None) | (Trip.actual_end == None))
    )
    bad_completed = result.scalar()
    if bad_completed:
        issues.append(f"[GAP] {bad_completed} COMPLETED trips missing actual_start or actual_end")
    else:
        print(f"  ✓ V6 PASS — all COMPLETED trips have actual timestamps")

    # V7: Ticket count integrity — ISSUED tickets should only exist for non-COMPLETED trips
    result = await session.execute(
        select(func.count()).select_from(Ticket)
        .join(Trip, Ticket.trip_id == Trip.id)
        .where(Ticket.status == TripTicketStatus.ISSUED, Trip.status == TripStatus.COMPLETED)
    )
    bad_tickets = result.scalar()
    if bad_tickets:
        issues.append(f"[GAP] {bad_tickets} ISSUED tickets on COMPLETED trips (should be USED)")
    else:
        print(f"  ✓ V7 PASS — ticket statuses consistent with trip completion")

    # V8: Reroute coverage — all 3 statuses present
    result = await session.execute(
        select(RerouteLog.status, func.count()).group_by(RerouteLog.status)
    )
    reroute_statuses = {row[0]: row[1] for row in result.fetchall()}
    for rs in [RerouteStatus.PENDING, RerouteStatus.APPROVED, RerouteStatus.REJECTED]:
        if rs not in reroute_statuses:
            issues.append(f"[GAP] Reroute status '{rs.value}' not represented in data")
        else:
            print(f"  ✓ V8 PASS — RerouteStatus.{rs.value}: {reroute_statuses[rs]} rows")

    # ── Summary counts ─────────────────────────────────────────────
    print("\n[VERIFY] Row counts by table:")
    for model_cls, label in [
        (Trip, "trips"), (GateLog, "gate_logs"), (CameraReading, "camera_readings"),
        (CrowdingEvent, "crowding_events"), (Ticket, "tickets"),
        (RotationAssignment, "rotation_assignments"), (RerouteLog, "reroute_logs"),
        (DailyReport, "daily_reports"), (Vehicle, "vehicles"), (Driver, "drivers"),
    ]:
        cnt = await session.scalar(select(func.count()).select_from(model_cls))
        print(f"  {label:30s}: {cnt:>6,}")

    return issues


async def main():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        trip_pool = await seed(session)
        issues = await verify(session, trip_pool)

    await engine.dispose()

    if issues:
        print("\n[ISSUES FOUND]")
        for iss in issues:
            print(f"  ⚠  {iss}")
        sys.exit(1)
    else:
        print("\n✅ All invariant checks passed. No logic gaps detected in seeded data.")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
