"""Shared trip-detail builder used by admin and driver endpoints.

Computes route_stops and telemetry alongside the standard Trip fields so
both routes return a consistent detail payload. Also exposes is_late_now
(view-time) for active trips that have run past the grace period.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.models import (
    Driver,
    Route,
    Trip,
    TripStatus,
)


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
