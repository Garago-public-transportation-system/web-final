"""Public-facing maintenance request endpoint.

Mounted at `/api/v1` so the route is `POST /api/v1/maintenance-requests`.
Any authenticated active user (admin, manager, or driver) may file a request
against a vehicle they can identify by id; the request is linked back to the
caller via `requested_by_id` and audited.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.models import (
    MaintenanceRequest,
    MaintenanceStatus,
    MaintenanceType,
    User,
    Vehicle,
)
from app.schemas.schemas import (
    MaintenanceRequestCreate,
    MaintenanceResponse,
)
from app.services.audit_service import log_action

router = APIRouter()


@router.post(
    "/maintenance-requests",
    response_model=MaintenanceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_maintenance_request(
    request: Request,
    body: MaintenanceRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Open a new maintenance request for the given vehicle.

    Validates that the vehicle exists (404 otherwise) and links the request
    to the calling user. Priority `1` is treated as an emergency and stays
    PENDING until a manager approves it; lower priorities are auto-approved
    as REGULAR work, matching the existing service behaviour."""

    vehicle = await db.get(Vehicle, body.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    is_emergency = body.priority == 1
    req_type = MaintenanceType.EMERGENCY if is_emergency else MaintenanceType.REGULAR
    req_status = MaintenanceStatus.PENDING if is_emergency else MaintenanceStatus.APPROVED

    title = (body.issue_description.strip().split("\n", 1)[0])[:255] or "Maintenance Request"

    new_request = MaintenanceRequest(
        vehicle_id=vehicle.id,
        requested_by_id=current_user.id,
        type=req_type,
        status=req_status,
        priority=body.priority,
        title=title,
        description=body.issue_description,
    )
    db.add(new_request)
    await db.flush()

    ip = request.client.host if request.client else None
    await log_action(
        db,
        current_user.id,
        "CREATE",
        "MaintenanceRequest",
        new_request.id,
        new_values={
            "vehicle_id": vehicle.id,
            "priority": body.priority,
            "type": req_type.value,
        },
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(new_request)
    return new_request
