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
    from app.services.trip_service import active_trip_filter
    stmt = (
        select(Trip)
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
