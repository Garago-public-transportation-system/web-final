from typing import Annotated, List, Optional
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, User, Driver, Vehicle, Route, RouteStop, RotationAssignment, MaintenanceRequest, AuditLog, TripDirection, MaintenanceStatus, DriverStatus, VehicleStatus, Trip, TripStatus
from app.schemas.schemas import (
    UserCreate, UserUpdate, UserResponse,
    DriverCreate, DriverUpdate, DriverResponse,
    VehicleCreate, VehicleUpdate, VehicleResponse,
    RouteCreate, RouteUpdate, RouteResponse,
    RotationAssignmentCreate, RotationAssignmentResponse,
    AdminDashboardStats, AuditLogResponse,
    UserWithDriverCreate, TicketCreate, TicketResponse,
    MaintenanceResponse
)
from app.core.security import security
from app.services.audit_service import log_action
import logging

logger = logging.getLogger(__name__)

# Enforce ADMIN role
router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN))])

# --- Dashboard ---
@router.get("/dashboard/stats", response_model=AdminDashboardStats)
async def get_dashboard_stats(db: Annotated[AsyncSession, Depends(get_db)]):
    # Simplified count queries
    # In real app, might want to optimize or cache
    from sqlalchemy import func
    from app.models.models import Trip, Route
    
    total_vehicles = await db.scalar(select(func.count(Vehicle.id)))
    total_drivers = await db.scalar(select(func.count(Driver.id)))
    total_routes = await db.scalar(select(func.count(Route.id)))
    total_users = await db.scalar(select(func.count(User.id)))
    pending_maintenance = await db.scalar(select(func.count(MaintenanceRequest.id)).where(MaintenanceRequest.status == MaintenanceStatus.PENDING))
    # Active trips: status=ACTIVE
    active_trips = await db.scalar(select(func.count(Trip.id)).where(Trip.status == TripStatus.ACTIVE))
    
    # Calculate trips per route for the chart
    stmt = select(Route.name, func.count(Trip.id)).outerjoin(Trip).group_by(Route.id, Route.name)
    res = await db.execute(stmt)
    trips_per_route = [{"name": row[0], "trips": row[1]} for row in res.all()]
    
    return {
        "total_vehicles": total_vehicles or 0,
        "total_drivers": total_drivers or 0,
        "total_routes": total_routes or 0,
        "total_users": total_users or 0,
        "pending_maintenance": pending_maintenance or 0,
        "active_trips": active_trips or 0,
        "trips_per_route": trips_per_route
    }

# M5: Users, Drivers, Vehicles, Routes CRUD has been moved to standalone files
# (users.py, drivers.py, vehicles.py, routes.py) to avoid duplication.

# --- Maintenance (Admin view: all statuses) ---
@router.get("/maintenance", response_model=List[MaintenanceResponse])
async def get_all_maintenance(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = None,
):
    """Return all maintenance requests. Optionally filter by status (PENDING, APPROVED, REJECTED)."""
    stmt = select(MaintenanceRequest)
    if status:
        try:
            stmt = stmt.where(MaintenanceRequest.status == MaintenanceStatus(status.upper()))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status '{status}'")
    stmt = stmt.order_by(MaintenanceRequest.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

# --- Rotations ---
@router.get("/rotations", response_model=List[RotationAssignmentResponse])
async def list_rotations(
    db: Annotated[AsyncSession, Depends(get_db)],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """List rotation assignments. Optionally filter by date range (inclusive)."""
    stmt = select(RotationAssignment)
    if start_date:
        stmt = stmt.where(RotationAssignment.shift_date >= start_date)
    if end_date:
        stmt = stmt.where(RotationAssignment.shift_date <= end_date)
    stmt = stmt.order_by(RotationAssignment.shift_date, RotationAssignment.shift_type)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/rotations", response_model=RotationAssignmentResponse)
async def create_assignment(
    assignment_in: RotationAssignmentCreate, 
    db: Annotated[AsyncSession, Depends(get_db)], 
    current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))
):
    assignment = RotationAssignment(**assignment_in.model_dump())
    db.add(assignment)
    await log_action(db, current_user.id, "CREATE", "RotationAssignment", 0)
    await db.commit()
    await db.refresh(assignment)
    return assignment

@router.post("/rotations/generate")
async def force_generate_schedule(
    db: Annotated[AsyncSession, Depends(get_db)],
    regenerate: bool = False
):
    from app.services.rotation_service import generate_daily_schedule
    from datetime import date
    from sqlalchemy import func as sqlfunc

    today = date.today()

    # Pre-flight checks — give actionable feedback instead of silent 0-trips success
    active_routes = await db.scalar(
        select(sqlfunc.count()).select_from(Route).where(Route.is_active == True)
    )
    if not active_routes:
        raise HTTPException(status_code=422, detail="No active routes found. Add at least one route before generating a schedule.")

    # Check for OFF_DUTY drivers — these are the drivers who will be assigned trips
    # and then check in. Requiring ACTIVE status here causes a circular deadlock:
    # check-in needs trips, schedule generation needs active drivers.
    available_drivers = await db.scalar(
        select(sqlfunc.count()).select_from(Driver).where(Driver.status == DriverStatus.OFF_DUTY)
    )
    if available_drivers < 3:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough available drivers ({available_drivers} found, need at least 3). "
                   "Drivers must be in OFF_DUTY status (not yet checked in today) to be scheduled."
        )

    free_vehicles = await db.scalar(
        select(sqlfunc.count()).select_from(Vehicle).where(Vehicle.status == VehicleStatus.FREE)
    )
    if free_vehicles < 2:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough free vehicles ({free_vehicles} found, need at least 2 per route). "
                   "Ensure vehicles have FREE status."
        )

    try:
        trips = await generate_daily_schedule(db, today, regenerate=regenerate)
    except Exception as e:
        logger.error(f"Schedule generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while regenerating schedule")

    action = "Regenerated" if regenerate else "Generated"
    if not trips and not regenerate:
        return {"message": "Schedule already exists for today. Use 'Regenerate' to overwrite.", "count": 0}

    return {"message": f"{action} {len(trips)} trips for today.", "count": len(trips)}

@router.get("/trips/{id}", response_model=dict)
async def get_trip_details(id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.services.trip_service import build_trip_detail

    detail = await build_trip_detail(id, db)
    if not detail:
        raise HTTPException(status_code=404, detail="Trip not found")
    return detail

@router.get("/trips", response_model=List[dict]) # fast simplification: returning dicts or use TripResponse
async def get_trips(db: Annotated[AsyncSession, Depends(get_db)], date_filter: Optional[date] = None):
    from app.models.models import Trip, Route, Driver, Vehicle
    from sqlalchemy.orm import selectinload
    
    target_date = date_filter or date.today()
    # Filter by scheduled_start date component
    # SQLite/Postgres date extraction varies. For now, simplistic range check or just fetching all and filtering?
    # Better: cast(Trip.scheduled_start, Date) == target_date
    from sqlalchemy import cast, Date
    
    stmt = select(Trip).options(
        selectinload(Trip.route),
        selectinload(Trip.driver).selectinload(Driver.user),
        selectinload(Trip.vehicle)
    ).where(cast(Trip.scheduled_start, Date) == target_date).order_by(Trip.scheduled_start)
    
    result = await db.execute(stmt)
    trips = result.scalars().all()
    
    # Manual serialization to include nested names easily without complex schemas
    serialized = []
    for t in trips:
        # Determine logical origin/destination based on direction
        origin = t.route.start_location if t.direction == TripDirection.OUTBOUND else t.route.end_location
        destination = t.route.end_location if t.direction == TripDirection.OUTBOUND else t.route.start_location
        
        serialized.append({
            "id": t.id,
            "trip_number": t.trip_number,
            "status": t.status,
            "direction": t.direction,
            "origin": origin,
            "destination": destination,
            "start_time": t.scheduled_start,
            "end_time": t.scheduled_end,
            "route_name": t.route.name if t.route else "Unknown",
            "driver_name": t.driver.user.full_name if t.driver and t.driver.user else "Unknown",
            "vehicle_plate": t.vehicle.plate_number if t.vehicle else "Unknown"
        })
    return serialized

# --- Audit Logs ---
@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def read_audit_logs(db: Annotated[AsyncSession, Depends(get_db)], skip: int = 0, limit: int = 100):
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()

# --- M4: Reports ---
@router.get("/reports/daily")
async def get_daily_report(db: Annotated[AsyncSession, Depends(get_db)], report_date: Optional[date] = None):
    from app.services.report_service import generate_daily_report
    target = report_date or datetime.now(timezone.utc).date()
    report = await generate_daily_report(db, target)
    return report

@router.get("/reports/query")
async def query_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    driver_id: Optional[int] = None,
    route_id: Optional[int] = None
):
    from app.services.report_service import get_dynamic_report
    return await get_dynamic_report(db, start_date, end_date, driver_id, route_id)


@router.get("/reports/breakdown")
async def get_report_breakdown(
    db: Annotated[AsyncSession, Depends(get_db)],
    report_date: Optional[date] = None,
):
    """Revenue and trip counts broken down by route and by shift."""
    from sqlalchemy import func as sqlfunc, cast, Date as SADate
    from app.models.models import RotationAssignment, ShiftType

    target = report_date or datetime.now(timezone.utc).date()

    # Per-route breakdown
    route_rows = await db.execute(
        select(
            Route.id.label("route_id"),
            Route.name.label("route_name"),
            sqlfunc.count(Trip.id).label("trip_count"),
            sqlfunc.sum(Trip.fare_collected).label("revenue"),
            sqlfunc.sum(Trip.passenger_count).label("passengers"),
        )
        .join(Trip, Trip.route_id == Route.id)
        .where(
            Trip.status == TripStatus.COMPLETED,
            cast(Trip.actual_end, SADate) == target,
        )
        .group_by(Route.id, Route.name)
        .order_by(Route.name)
    )
    by_route = [
        {
            "route_id": r.route_id,
            "route_name": r.route_name,
            "trip_count": r.trip_count,
            "revenue": round(r.revenue or 0, 2),
            "passengers": r.passengers or 0,
        }
        for r in route_rows
    ]

    # Per-shift breakdown (via rotation_assignments for the day)
    shift_rows = await db.execute(
        select(
            RotationAssignment.shift_type.label("shift"),
            sqlfunc.count(Trip.id).label("trip_count"),
            sqlfunc.sum(Trip.fare_collected).label("revenue"),
        )
        .join(Trip, Trip.rotation_assignment_id == RotationAssignment.id)
        .where(
            Trip.status == TripStatus.COMPLETED,
            RotationAssignment.shift_date == target,
        )
        .group_by(RotationAssignment.shift_type)
    )
    by_shift = [
        {
            "shift": s.shift.value if hasattr(s.shift, "value") else str(s.shift),
            "trip_count": s.trip_count,
            "revenue": round(s.revenue or 0, 2),
        }
        for s in shift_rows
    ]

    return {"date": str(target), "by_route": by_route, "by_shift": by_shift}


@router.get("/reports/export")
async def export_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = "csv",
    start: Optional[date] = None,
    end: Optional[date] = None,
    # Legacy single-date param kept for backward compatibility
    report_date: Optional[date] = None,
):
    """Export completed-trip report as PDF or CSV. Supports date range (start/end) or single day (report_date)."""
    from fastapi.responses import StreamingResponse
    import io, csv as csv_module
    from sqlalchemy import cast, Date as SADate

    # Resolve date range
    if start and end:
        date_from, date_to = start, end
    elif report_date:
        date_from = date_to = report_date
    else:
        date_from = date_to = datetime.now(timezone.utc).date()

    if date_from > date_to:
        raise HTTPException(status_code=400, detail="start date must not be after end date")

    # Fetch completed trips in the range
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
            elements = []

            elements.append(Paragraph(f"Report — {range_label}", styles["Title"]))
            elements.append(Spacer(1, 12))

            table_data = [["Trip #", "Route", "Driver", "Vehicle", "Passengers", "Fare", "End Time"]]
            for trip, route, driver, user, vehicle in rows:
                table_data.append([
                    trip.trip_number or str(trip.id),
                    route.name,
                    user.full_name,
                    vehicle.plate_number,
                    str(trip.passenger_count),
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
                buf,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=report_{range_label}.pdf"},
            )
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="reportlab is not installed. Run: pip install reportlab"
            )

    # Default: CSV
    buf = io.StringIO()
    writer = csv_module.writer(buf)
    writer.writerow(["Trip #", "Route", "Driver", "Vehicle", "Passengers", "Fare", "End Time"])
    for trip, route, driver, user, vehicle in rows:
        writer.writerow([
            trip.trip_number or trip.id,
            route.name,
            user.full_name,
            vehicle.plate_number,
            trip.passenger_count,
            f"{trip.fare_collected:.2f}",
            trip.actual_end.strftime("%Y-%m-%d %H:%M") if trip.actual_end else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{range_label}.csv"},
    )
