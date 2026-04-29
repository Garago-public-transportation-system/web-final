"""Self-service profile endpoint.

Mounted at `/api/v1/users` so the route is `PATCH /api/v1/users/profile`.
Any authenticated active user can update their own `full_name`, `email`, and
`phone_number` (the underlying column is `phone`). Email changes are checked
against the unique-email invariant at the application layer to surface a
friendly 400 instead of a database constraint error.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import ProfileUpdateRequest, UserResponse
from app.services.audit_service import log_action

router = APIRouter()


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    request: Request,
    body: ProfileUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Apply a partial update to the caller's profile.

    Only fields that are explicitly provided in the request body are touched;
    omitted fields are left untouched. Validation:
      - 400 if the new email is already used by a different user.
      - 422 (Pydantic) on malformed phone or email.
    """
    # `populate_by_name=True` on the schema lets clients send either
    # `phone_number` (public name) or `phone` (internal column).
    payload = body.model_dump(exclude_unset=True, by_alias=False)
    # Re-map the alias back to the column name when the client used it.
    if "phone_number" in payload and "phone" not in payload:
        payload["phone"] = payload.pop("phone_number")

    if not payload:
        # Nothing to do — return current state untouched.
        return current_user

    new_email = payload.get("email")
    if new_email and new_email != current_user.email:
        existing = await db.scalar(
            select(User).where(User.email == new_email, User.id != current_user.id)
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use by another user.",
            )

    # Track what actually changed for the audit log.
    diff: dict[str, dict] = {}
    for key, value in payload.items():
        old_value = getattr(current_user, key, None)
        if old_value != value:
            diff[key] = {"old": old_value, "new": value}
            setattr(current_user, key, value)

    if not diff:
        return current_user

    ip = request.client.host if request.client else None
    await log_action(
        db,
        current_user.id,
        "UPDATE_PROFILE",
        "User",
        current_user.id,
        old_values={k: v["old"] for k, v in diff.items()},
        new_values={k: v["new"] for k, v in diff.items()},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(current_user)
    return current_user
