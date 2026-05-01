"""Shared trip-detail builder used by admin and driver endpoints.

Computes route_stops and telemetry alongside the standard Trip fields so
both routes return a consistent detail payload. Also exposes is_late_now
(view-time) for active trips that have run past the grace period.
"""
from datetime import datetime, date, timedelta, timezone
from typing import Optional

from sqlalchemy import cast, select, update, Date as SADate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.models import (
    Driver,
    Route,
    Trip,
    TripStatus,
)


def active_trip_filter(today: Optional[date] = None):
    """Return SQLAlchemy filter clauses identifying trips that are still
    considered active for listing purposes.

    Use as: `select(Trip).where(*active_trip_filter())`. This ensures both
    the persisted `is_active` flag and the date-based rule are applied
    consistently across endpoints.
    """
    today = today or datetime.now(timezone.utc).date()
    return (
        Trip.is_active == True,  # noqa: E712 — SQL boolean
        cast(Trip.scheduled_start, SADate) >= today,
    )


async def deactivate_expired_trips(db: AsyncSession, today: Optional[date] = None) -> int:
    """Set `is_active = False` for every trip whose scheduled_start date is
    earlier than today. Returns the number of rows affected.

    Idempotent — only flips rows currently flagged active.
    """
    today = today or datetime.now(timezone.utc).date()
    stmt = (
        update(Trip)
        .where(
            Trip.is_active == True,  # noqa: E712
            cast(Trip.scheduled_start, SADate) < today,
        )
        .values(is_active=False)
    )
    result = await db.execute(stmt)
    if result.rowcount:
        await db.commit()
    return int(result.rowcount or 0)


def _scheduled_end(trip: Trip) -> Optional[datetime]:
    """Resolve an effective scheduled_end, falling back to route estimate."""
    if trip.scheduled_end:
        return trip.scheduled_end
    if trip.route and trip.route.estimated_time_minutes and trip.scheduled_start:
        return trip.scheduled_start + timedelta(minutes=trip.route.estimated_time_minutes)
    return None


def compute_is_late_now(trip: Trip, now: Optional[datetime] = None) -> bool:
    """Live lateness check for active trips; persisted is_late wins for finished."""
    if trip.status != TripStatus.ACTIVE:
        return bool(trip.is_late)
    sched_end = _scheduled_end(trip)
    if not sched_end:
        return False
    now = now or datetime.now(timezone.utc)
    return now > sched_end + timedelta(minutes=settings.LATE_THRESHOLD_MINUTES)


async def update_late_trips(db: AsyncSession) -> int:
    """Persist `is_late=True` on every ACTIVE trip whose scheduled_end + grace
    has elapsed. Returns the number of rows flipped.

    Without this, DailyReport.on_time_percentage is always 100% because
    `is_late` is never written after trip creation.
    """
    from sqlalchemy.orm import selectinload

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=settings.LATE_THRESHOLD_MINUTES)

    candidates = (await db.execute(
        select(Trip)
        .options(selectinload(Trip.route), selectinload(Trip.driver).selectinload(Driver.user))
        .where(
            Trip.status == TripStatus.ACTIVE,
            Trip.is_late == False,  # noqa: E712 — SQL boolean, not Python `not`
        )
    )).scalars().all()

    flipped = 0
    newly_late_trips = []
    for trip in candidates:
        sched_end = _scheduled_end(trip)
        if not sched_end:
            continue
        # Normalise possibly-naive datetimes coming from older rows.
        if sched_end.tzinfo is None:
            sched_end = sched_end.replace(tzinfo=timezone.utc)
        if sched_end < cutoff:
            trip.is_late = True
            flipped += 1
            newly_late_trips.append(trip)

    if flipped:
        await db.commit()
        # Send notifications and WebSocket alerts for newly-late trips
        await _alert_late_trips(db, newly_late_trips)
    return flipped


async def _alert_late_trips(db: AsyncSession, trips: list):
    """Send notifications to driver, managers, and admins for late trips."""
    import logging
    from app.services.notification_service import create_notification
    from app.services.audit_service import log_action
    from app.core.sockets import manager as socket_manager
    from app.models.models import User, UserRole
    from sqlalchemy import select as sa_select

    logger = logging.getLogger(__name__)

    # Fetch manager and admin user IDs once
    manager_ids = (await db.execute(
        sa_select(User.id).where(User.role == UserRole.MANAGER, User.is_active == True)
    )).scalars().all()
    admin_ids = (await db.execute(
        sa_select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True)
    )).scalars().all()

    for trip in trips:
        trip_label = trip.trip_number or f"Trip #{trip.id}"
        route_name = trip.route.name if trip.route else "Unknown route"
        sched_end = _scheduled_end(trip)
        end_str = sched_end.strftime("%H:%M") if sched_end else "N/A"
        now_str = datetime.now(timezone.utc).strftime("%H:%M")
        delay_mins = ""
        if sched_end:
            delta = datetime.now(timezone.utc) - sched_end
            delay_mins = f"{int(delta.total_seconds() // 60)} min"

        # 1. Notify the driver
        if trip.driver and trip.driver.user_id:
            try:
                await create_notification(
                    db=db,
                    user_id=trip.driver.user_id,
                    title="⚠️ Trip overdue — please finish",
                    message=(
                        f"Your trip {trip_label} on {route_name} was scheduled to end at {end_str} UTC "
                        f"but is now {delay_mins} late. Please complete it as soon as possible."
                    ),
                    type="TRIP_LATE",
                )
            except Exception as exc:
                logger.warning(f"Failed to notify driver for late trip {trip.id}: {exc}")

        # 2. Notify managers
        for uid in manager_ids:
            try:
                await create_notification(
                    db=db,
                    user_id=uid,
                    title="🔴 Late trip alert",
                    message=(
                        f"{trip_label} on {route_name} is {delay_mins} past its scheduled end ({end_str} UTC). "
                        f"Driver: {trip.driver.user.full_name if trip.driver and hasattr(trip.driver, 'user') and trip.driver.user else 'Unknown'}."
                    ),
                    type="TRIP_LATE",
                )
            except Exception as exc:
                logger.warning(f"Failed to notify manager {uid} for late trip {trip.id}: {exc}")

        # 3. Notify admins
        for uid in admin_ids:
            try:
                await create_notification(
                    db=db,
                    user_id=uid,
                    title="🔴 Late trip alert",
                    message=(
                        f"{trip_label} on {route_name} is {delay_mins} past its scheduled end ({end_str} UTC). "
                        f"Driver: {trip.driver.user.full_name if trip.driver and hasattr(trip.driver, 'user') and trip.driver.user else 'Unknown'}."
                    ),
                    type="TRIP_LATE",
                )
            except Exception as exc:
                logger.warning(f"Failed to notify admin {uid} for late trip {trip.id}: {exc}")

        # 4. Audit log entry — shows up in Dashboard "System Alerts"
        try:
            await log_action(
                db=db,
                user_id=None,  # system-generated
                action="LATE_TRIP",
                entity_type="Trip",
                entity_id=trip.id,
                new_values={
                    "trip_number": trip_label,
                    "route": route_name,
                    "delay": delay_mins,
                    "scheduled_end": end_str,
                },
            )
        except Exception as exc:
            logger.warning(f"Failed to create audit entry for late trip {trip.id}: {exc}")

        # 5. WebSocket real-time alert to MANAGER and ADMIN dashboards
        ws_payload = {
            "type": "late_trip_alert",
            "severity": "HIGH",
            "trip_id": trip.id,
            "trip_number": trip_label,
            "route_name": route_name,
            "delay_minutes": delay_mins,
            "message": f"LATE TRIP: {trip_label} on {route_name} is {delay_mins} overdue.",
        }
        try:
            await socket_manager.broadcast_to_role("MANAGER", ws_payload)
            await socket_manager.broadcast_to_role("ADMIN", ws_payload)
        except Exception as exc:
            logger.warning(f"Failed to broadcast late trip WS alert for trip {trip.id}: {exc}")

    await db.commit()


async def build_trip_detail(trip_id: int, db: AsyncSession) -> Optional[dict]:
    """Load a trip with relationships and return the full detail dict.

    Returns None when the trip does not exist. Caller is responsible for
    authorization (e.g. driver ownership check).
    """
    stmt = (
        select(Trip)
        .options(
            selectinload(Trip.route).selectinload(Route.stops),
            selectinload(Trip.driver).selectinload(Driver.user),
            selectinload(Trip.vehicle),
            selectinload(Trip.tickets),
        )
        .where(Trip.id == trip_id)
    )
    trip = await db.scalar(stmt)
    if not trip:
        return None

    route_stops: list[dict] = []
    if trip.route and trip.route.stops:
        sorted_stops = sorted(trip.route.stops, key=lambda s: s.sequence_order)
        route_stops = [
            {
                "id": s.id,
                "stop_name": s.stop_name,
                "sequence_order": s.sequence_order,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "dwell_time_minutes": s.dwell_time_minutes,
            }
            for s in sorted_stops
        ]

    return {
        "id": trip.id,
        "trip_number": trip.trip_number,
        "status": trip.status,
        "direction": trip.direction,
        "scheduled_start": trip.scheduled_start,
        "scheduled_end": trip.scheduled_end,
        "actual_start": trip.actual_start,
        "actual_end": trip.actual_end,
        "passenger_count": trip.passenger_count,
        "crowding_score": trip.crowding_score,
        "is_late": bool(trip.is_late),
        "is_late_now": compute_is_late_now(trip),
        "fare_collected": getattr(trip, "fare_collected", 0.0),
        "route": {
            "id": trip.route.id,
            "name": trip.route.name,
            "start_location": trip.route.start_location,
            "end_location": trip.route.end_location,
            "distance_km": trip.route.distance_km,
            "estimated_time_minutes": trip.route.estimated_time_minutes,
        } if trip.route else None,
        "route_stops": route_stops,
        "driver": {
            "id": trip.driver.id,
            "full_name": trip.driver.user.full_name if trip.driver and trip.driver.user else "Unknown",
            "rating": trip.driver.rating,
        } if trip.driver else None,
        "vehicle": {
            "id": trip.vehicle.id,
            "plate_number": trip.vehicle.plate_number,
            "model": trip.vehicle.model,
            "capacity": trip.vehicle.capacity,
        } if trip.vehicle else None,
        "tickets": [
            {
                "id": t.id,
                "passenger": t.passenger_name,
                "seat": t.seat_number,
                "status": t.status,
                "price": t.price,
            }
            for t in trip.tickets
        ],
        "telemetry": [],
    }
