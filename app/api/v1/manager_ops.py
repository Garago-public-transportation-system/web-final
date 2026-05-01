from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, Trip, TripStatus, RerouteLog, RerouteStatus, Driver, User
from app.schemas.schemas import TripResponse, RerouteLogResponse, RerouteDecision

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.MANAGER, UserRole.ADMIN))])

@router.get("/trips/active", response_model=List[TripResponse])
async def get_active_trips(db: Annotated[AsyncSession, Depends(get_db)], skip: int = 0, limit: int = 100):
    """
    Returns all currently active trips to monitor real-time crowding.

    Filters out trips that have been auto-inactivated (scheduled for an
    earlier date) so stale rows never leak into operational dashboards.
    """
    from sqlalchemy.orm import selectinload
    from app.services.trip_service import active_trip_filter
    from app.models.models import Route, Vehicle
    stmt = (
        select(Trip)
        .options(
            selectinload(Trip.route).selectinload(Route.stops),
            selectinload(Trip.vehicle),
            selectinload(Trip.driver),
        )
        .where(Trip.status == TripStatus.ACTIVE, *active_trip_filter())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/reroute", response_model=List[RerouteLogResponse])
async def list_reroute_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = None,
    current_user=Depends(get_current_user_with_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """List reroute requests. Optionally filter by status (PENDING, APPROVED, REJECTED). Defaults to PENDING."""
    stmt = select(RerouteLog)
    if status:
        if status.upper() != "ALL":
            try:
                stmt = stmt.where(RerouteLog.status == RerouteStatus(status.upper()))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status '{status}'")
    else:
        stmt = stmt.where(RerouteLog.status == RerouteStatus.PENDING)
    stmt = stmt.order_by(RerouteLog.requested_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def _resolve_reroute(
    reroute_id: int,
    new_status: RerouteStatus,
    reason: Optional[str],
    db: AsyncSession,
    current_user: User,
) -> RerouteLog:
    from app.services.notification_service import create_notification

    log = await db.get(RerouteLog, reroute_id)
    if not log:
        raise HTTPException(status_code=404, detail="Reroute request not found")
    if log.status != RerouteStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Reroute is already {log.status.value}")

    log.status = new_status
    log.approved_by = current_user.id
    if reason:
        log.reason = (log.reason or "") + f" | Decision note: {reason}"

    # Notify the driver
    driver = await db.get(Driver, log.driver_id)
    if driver:
        verb = "approved" if new_status == RerouteStatus.APPROVED else "rejected"
        await create_notification(
            db, driver.user_id,
            title=f"Reroute request {verb}",
            message=f"Your reroute request has been {verb}." + (f" Note: {reason}" if reason else ""),
            type="reroute_decision",
        )

    await db.commit()
    await db.refresh(log)
    return log


@router.patch("/reroute/{reroute_id}/approve", response_model=RerouteLogResponse)
async def approve_reroute(
    reroute_id: int,
    body: RerouteDecision,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    return await _resolve_reroute(reroute_id, RerouteStatus.APPROVED, body.reason, db, current_user)


@router.patch("/reroute/{reroute_id}/reject", response_model=RerouteLogResponse)
async def reject_reroute(
    reroute_id: int,
    body: RerouteDecision,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user_with_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    return await _resolve_reroute(reroute_id, RerouteStatus.REJECTED, body.reason, db, current_user)


# --- Manager Reports (same as admin, minus audit logs) ---
@router.get("/reports/breakdown")
async def manager_report_breakdown(
    db: Annotated[AsyncSession, Depends(get_db)],
    start: Optional[str] = None,
    end: Optional[str] = None,
    report_date: Optional[str] = None,
):
    """Revenue and trip counts broken down by route and by shift."""
    from datetime import date as date_type, datetime as dt, timezone as tz
    from sqlalchemy import func as sqlfunc, cast, Date as SADate
    from app.models.models import Route, Vehicle, RotationAssignment, ShiftType

    if start and end:
        target_start = date_type.fromisoformat(start)
        target_end = date_type.fromisoformat(end)
    elif report_date:
        target_start = target_end = date_type.fromisoformat(report_date)
    else:
        target_start = target_end = dt.now(tz.utc).date()

    # Per-route breakdown
    route_rows = await db.execute(
        select(
            Route.id.label("route_id"),
            Route.name.label("route_name"),
            sqlfunc.count(Trip.id).label("trip_count"),
            sqlfunc.sum(Trip.fare_collected).label("total_revenue"),
            sqlfunc.sum(Trip.passenger_count).label("passengers"),
        )
        .join(Trip, Trip.route_id == Route.id)
        .where(
            Trip.status == TripStatus.COMPLETED,
            cast(Trip.actual_end, SADate) >= target_start,
            cast(Trip.actual_end, SADate) <= target_end,
        )
        .group_by(Route.id, Route.name)
        .order_by(Route.name)
    )
    by_route = [
        {
            "route_id": r.route_id,
            "route_name": r.route_name,
            "trip_count": r.trip_count,
            "total_revenue": round(r.total_revenue or 0, 2),
            "passengers": r.passengers or 0,
        }
        for r in route_rows
    ]

    # Per-shift breakdown
    shift_rows = await db.execute(
        select(
            RotationAssignment.shift_type.label("shift"),
            sqlfunc.count(Trip.id).label("trip_count"),
            sqlfunc.sum(Trip.fare_collected).label("total_revenue"),
        )
        .join(Trip, Trip.rotation_assignment_id == RotationAssignment.id)
        .where(
            Trip.status == TripStatus.COMPLETED,
            RotationAssignment.shift_date >= target_start,
            RotationAssignment.shift_date <= target_end,
        )
        .group_by(RotationAssignment.shift_type)
    )
    by_shift = [
        {
            "shift_type": s.shift.value if hasattr(s.shift, "value") else str(s.shift),
            "trip_count": s.trip_count,
            "total_revenue": round(s.total_revenue or 0, 2),
        }
        for s in shift_rows
    ]

    return {"date": f"{target_start} → {target_end}", "by_route": by_route, "by_shift": by_shift}


@router.get("/reports/export")
async def manager_report_export(
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = "csv",
    start: Optional[str] = None,
    end: Optional[str] = None,
    report_date: Optional[str] = None,
):
    """Export completed-trip report as PDF or CSV."""
    from fastapi.responses import StreamingResponse
    from datetime import date as date_type, datetime as dt, timezone as tz
    from sqlalchemy import cast, Date as SADate
    from app.models.models import Route, Vehicle
    import io, csv as csv_module

    if start and end:
        date_from = date_type.fromisoformat(start)
        date_to = date_type.fromisoformat(end)
    elif report_date:
        date_from = date_to = date_type.fromisoformat(report_date)
    else:
        date_from = date_to = dt.now(tz.utc).date()

    rows = (await db.execute(
        select(Trip, Route, Driver, User, Vehicle)
        .join(Route, Trip.route_id == Route.id)
        .join(Driver, Trip.driver_id == Driver.id)
        .join(User, Driver.user_id == User.id)
        .join(Vehicle, Trip.vehicle_id == Vehicle.id)
        .where(
            Trip.status == TripStatus.COMPLETED,
            cast(Trip.actual_end, SADate) >= date_from,
            cast(Trip.actual_end, SADate) <= date_to,
        )
        .order_by(Trip.actual_end)
    )).all()

    range_label = f"{date_from}" if date_from == date_to else f"{date_from}_to_{date_to}"

    if format == "pdf":
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib import colors

            buf = io.BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=A4)
            styles = getSampleStyleSheet()
            elements = [Paragraph(f"Report — {range_label}", styles["Title"]), Spacer(1, 12)]

            if not rows:
                elements.append(Paragraph("No completed trips in the selected date range.", styles["Normal"]))
            else:
                table_data = [["Trip #", "Route", "Driver", "Vehicle", "Passengers", "Fare", "End Time"]]
                for trip, route, driver, user, vehicle in rows:
                    table_data.append([
                        trip.trip_number or str(trip.id), route.name, user.full_name,
                        vehicle.plate_number, str(trip.passenger_count),
                        f"{trip.fare_collected:.2f}",
                        trip.actual_end.strftime("%H:%M") if trip.actual_end else "",
                    ])
                t = Table(table_data, repeatRows=1)
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f3ff")]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]))
                elements.append(t)

            doc.build(elements)
            buf.seek(0)
            return StreamingResponse(
                buf, media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=report_{range_label}.pdf"},
            )
        except ImportError:
            from fastapi import HTTPException as HE
            raise HE(status_code=500, detail="reportlab is not installed.")

    # Default: CSV
    buf = io.StringIO()
    writer = csv_module.writer(buf)
    writer.writerow(["Trip #", "Route", "Driver", "Vehicle", "Passengers", "Fare", "End Time"])
    for trip, route, driver, user, vehicle in rows:
        writer.writerow([
            trip.trip_number or trip.id, route.name, user.full_name,
            vehicle.plate_number, trip.passenger_count,
            f"{trip.fare_collected:.2f}",
            trip.actual_end.strftime("%Y-%m-%d %H:%M") if trip.actual_end else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{range_label}.csv"},
    )

